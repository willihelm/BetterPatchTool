import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  accessTokenValidator,
  requireAuthenticatedUser,
  requireProjectAccess,
  requireProjectRole,
} from "./_helpers/projectAccess";
import { logProjectActivity } from "./_helpers/projectActivity";

type BusType = "group" | "aux" | "fx" | "matrix" | "master" | "cue";

interface BusConfig {
  groups?: number;
  auxes?: number;
  fx?: number;
  matrices?: number;
  masters?: number;
  cue?: number;
}

const BUS_ENTRIES: Array<{ key: keyof BusConfig; busType: BusType; label: string }> = [
  { key: "groups", busType: "group", label: "Grp" },
  { key: "auxes", busType: "aux", label: "Aux" },
  { key: "fx", busType: "fx", label: "FX" },
  { key: "matrices", busType: "matrix", label: "Mtx" },
  { key: "masters", busType: "master", label: "Master" },
  { key: "cue", busType: "cue", label: "Cue" },
];

function generateBusChannelList(busConfig: BusConfig): Array<{ busType: BusType; busName: string }> {
  const channels: Array<{ busType: BusType; busName: string }> = [];
  for (const { key, busType, label } of BUS_ENTRIES) {
    const count = busConfig[key] ?? 0;
    if (count <= 0) continue;
    for (let i = 1; i <= count; i++) {
      const busName =
        count === 1 && (busType === "master" || busType === "cue") ? label : `${label} ${i}`;
      channels.push({ busType, busName });
    }
  }
  return channels;
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const currentUser = await requireAuthenticatedUser(ctx);
    const ownedProjects = await ctx.db
      .query("projects")
      .withIndex("by_owner_and_archived", (q) =>
        q.eq("ownerId", currentUser.userId).eq("isArchived", false)
      )
      .collect();

    const memberships = await ctx.db
      .query("projectCollaborators")
      .withIndex("by_user", (q) => q.eq("userId", currentUser.userId))
      .collect();

    const sharedProjects = await Promise.all(
      memberships.map(async (membership) => {
        const project = await ctx.db.get(membership.projectId);
        if (!project || project.isArchived) return null;
        return {
          ...project,
          accessRole: membership.role,
          isOwned: false,
        };
      })
    );

    return [
      ...ownedProjects.map((project) => ({
        ...project,
        accessRole: "owner" as const,
        isOwned: true,
      })),
      ...sharedProjects.filter(Boolean),
    ];
  },
});

export const get = query({
  args: {
    projectId: v.id("projects"),
    accessToken: accessTokenValidator,
  },
  handler: async (ctx, args) => {
    const access = await requireProjectAccess(ctx, args.projectId, args.accessToken);
    return {
      ...access.project,
      accessRole: access.role,
      isOwned: access.role === "owner",
    };
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    date: v.optional(v.string()),
    venue: v.optional(v.string()),
    channelCount: v.optional(v.number()),
    busConfig: v.optional(v.object({
      groups: v.optional(v.number()),
      auxes: v.optional(v.number()),
      fx: v.optional(v.number()),
      matrices: v.optional(v.number()),
      masters: v.optional(v.number()),
      cue: v.optional(v.number()),
    })),
  },
  handler: async (ctx, args) => {
    const currentUser = await requireAuthenticatedUser(ctx);
    const channelCount = args.channelCount ?? 48;
    const config = args.busConfig ?? { auxes: 24 };

    const projectId = await ctx.db.insert("projects", {
      title: args.title,
      date: args.date,
      venue: args.venue,
      ownerId: currentUser.userId,
      collaborators: [],
      isArchived: false,
    });

    const mixerId = await ctx.db.insert("mixers", {
      projectId,
      name: "FOH",
      stereoMode: "linked_mono",
      channelCount,
      designation: "A",
      order: 0,
    });

    for (let i = 0; i < channelCount; i++) {
      await ctx.db.insert("inputChannels", {
        projectId,
        mixerId,
        order: i + 1,
        channelNumber: i + 1,
        source: "",
        patched: false,
      });
    }

    const busChannels = generateBusChannelList(config);
    for (let i = 0; i < busChannels.length; i++) {
      await ctx.db.insert("outputChannels", {
        projectId,
        mixerId,
        order: i + 1,
        busType: busChannels[i].busType,
        busName: busChannels[i].busName,
        destination: "",
      });
    }

    await logProjectActivity(ctx, {
      projectId,
      actorUserId: currentUser.userId,
      entityType: "project",
      entityId: String(projectId),
      action: "created",
      summary: `Created project "${args.title}"`,
    });

    return projectId;
  },
});

export const update = mutation({
  args: {
    projectId: v.id("projects"),
    title: v.optional(v.string()),
    date: v.optional(v.string()),
    venue: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await requireProjectRole(ctx, args.projectId, "editor");
    const { projectId, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, value]) => value !== undefined)
    );
    await ctx.db.patch(projectId, filteredUpdates);
    await logProjectActivity(ctx, {
      projectId,
      actorUserId: access.userId!,
      entityType: "project",
      entityId: String(projectId),
      action: "updated",
      summary: `Updated project "${access.project.title}"`,
      metadata: filteredUpdates,
    });
  },
});

export const archive = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const access = await requireProjectRole(ctx, args.projectId, "owner");
    await ctx.db.patch(args.projectId, { isArchived: true });
    await logProjectActivity(ctx, {
      projectId: args.projectId,
      actorUserId: access.userId!,
      entityType: "project",
      entityId: String(args.projectId),
      action: "archived",
      summary: `Archived project "${access.project.title}"`,
    });
  },
});

export const duplicate = mutation({
  args: {
    projectId: v.id("projects"),
    newTitle: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await requireProjectAccess(ctx, args.projectId);
    const currentUser = await requireAuthenticatedUser(ctx);
    const original = access.project;

    const newProjectId = await ctx.db.insert("projects", {
      title: args.newTitle,
      date: original.date,
      venue: original.venue,
      ownerId: currentUser.userId,
      collaborators: [],
      isArchived: false,
    });

    const mixers = await ctx.db
      .query("mixers")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const mixerMap = new Map<string, string>();
    for (const mixer of mixers) {
      const { _id, _creationTime, projectId, ...mixerData } = mixer;
      const newMixerId = await ctx.db.insert("mixers", {
        ...mixerData,
        projectId: newProjectId,
      });
      mixerMap.set(_id, newMixerId);
    }

    const ioDevices = await ctx.db
      .query("ioDevices")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const ioDeviceMap = new Map<string, string>();
    const portMap = new Map<string, string>();

    for (const ioDevice of ioDevices) {
      const { _id, _creationTime, projectId, ...ioDeviceData } = ioDevice;
      const newIODeviceId = await ctx.db.insert("ioDevices", {
        ...ioDeviceData,
        projectId: newProjectId,
      });
      ioDeviceMap.set(_id, newIODeviceId);

      const ports = await ctx.db
        .query("ioPorts")
        .withIndex("by_ioDevice", (q) => q.eq("ioDeviceId", _id))
        .collect();

      for (const port of ports) {
        const { _id: portId, _creationTime, ioDeviceId, ...portData } = port;
        const newPortId = await ctx.db.insert("ioPorts", {
          ...portData,
          ioDeviceId: newIODeviceId as any,
        });
        portMap.set(portId, newPortId);
      }
    }

    const groups = await ctx.db
      .query("groups")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const groupMap = new Map<string, string>();
    for (const group of groups) {
      const { _id, _creationTime, projectId, ...groupData } = group;
      const newGroupId = await ctx.db.insert("groups", {
        ...groupData,
        projectId: newProjectId,
      });
      groupMap.set(_id, newGroupId);
    }

    const inputChannels = await ctx.db
      .query("inputChannels")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    for (const channel of inputChannels) {
      const {
        _id,
        _creationTime,
        projectId,
        mixerId,
        ioPortId,
        ioPortIdRight,
        groupId,
        ...channelData
      } = channel;
      await ctx.db.insert("inputChannels", {
        ...channelData,
        projectId: newProjectId,
        mixerId: mixerId ? (mixerMap.get(mixerId) as any) : undefined,
        ioPortId: ioPortId ? (portMap.get(ioPortId) as any) : undefined,
        ioPortIdRight: ioPortIdRight ? (portMap.get(ioPortIdRight) as any) : undefined,
        groupId: groupId ? (groupMap.get(groupId) as any) : undefined,
      });
    }

    const outputChannels = await ctx.db
      .query("outputChannels")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    for (const channel of outputChannels) {
      const { _id, _creationTime, projectId, mixerId, ioPortId, ioPortIdRight, ...channelData } = channel;
      await ctx.db.insert("outputChannels", {
        ...channelData,
        projectId: newProjectId,
        mixerId: mixerId ? (mixerMap.get(mixerId) as any) : undefined,
        ioPortId: ioPortId ? (portMap.get(ioPortId) as any) : undefined,
        ioPortIdRight: ioPortIdRight ? (portMap.get(ioPortIdRight) as any) : undefined,
      });
    }

    await logProjectActivity(ctx, {
      projectId: newProjectId,
      actorUserId: currentUser.userId,
      entityType: "project",
      entityId: String(newProjectId),
      action: "created",
      summary: `Duplicated project "${original.title}" to "${args.newTitle}"`,
    });

    return newProjectId;
  },
});

export const addCollaborator = mutation({
  args: {
    projectId: v.id("projects"),
    collaboratorId: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await requireProjectRole(ctx, args.projectId, "owner");
    const existing = await ctx.db
      .query("projectCollaborators")
      .withIndex("by_project_and_user", (q) =>
        q.eq("projectId", args.projectId).eq("userId", args.collaboratorId)
      )
      .first();

    if (!existing) {
      await ctx.db.insert("projectCollaborators", {
        projectId: args.projectId,
        userId: args.collaboratorId,
        role: "editor",
        invitedBy: access.userId!,
        createdAt: Date.now(),
        acceptedAt: Date.now(),
      });
    }

    if (!access.project.collaborators.includes(args.collaboratorId)) {
      await ctx.db.patch(args.projectId, {
        collaborators: [...access.project.collaborators, args.collaboratorId],
      });
    }
  },
});
