import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

const SNAPSHOT_DATA_VERSION = 1;

type ProjectSnapshotPayload = {
  project: {
    title: string;
    date?: string;
    venue?: string;
  };
  mixers: any[];
  ioDevices: any[];
  ioPorts: any[];
  groups: any[];
  inputChannels: any[];
  outputChannels: any[];
};

export const list = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("projectSnapshots")
      .withIndex("by_project_and_createdAt", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .collect();
  },
});

export const get = query({
  args: { snapshotId: v.id("projectSnapshots") },
  handler: async (ctx, args) => {
    const snapshot = await ctx.db.get(args.snapshotId);
    if (!snapshot) return null;

    const data = await ctx.db
      .query("projectSnapshotData")
      .withIndex("by_snapshot", (q) => q.eq("snapshotId", args.snapshotId))
      .first();

    if (!data) return null;

    const payload = JSON.parse(data.blob) as ProjectSnapshotPayload;

    return {
      snapshot,
      payload,
    };
  },
});

export const create = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    const mixers = await ctx.db
      .query("mixers")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const ioDevices = await ctx.db
      .query("ioDevices")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const ioPortsArrays = await Promise.all(
      ioDevices.map((device) =>
        ctx.db
          .query("ioPorts")
          .withIndex("by_ioDevice", (q) => q.eq("ioDeviceId", device._id))
          .collect()
      )
    );
    const ioPorts = ioPortsArrays.flat();

    const groups = await ctx.db
      .query("groups")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const inputChannels = await ctx.db
      .query("inputChannels")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const outputChannels = await ctx.db
      .query("outputChannels")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const payload: ProjectSnapshotPayload = {
      project: {
        title: project.title,
        date: project.date,
        venue: project.venue,
      },
      mixers,
      ioDevices,
      ioPorts,
      groups,
      inputChannels,
      outputChannels,
    };

    const snapshotId = await ctx.db.insert("projectSnapshots", {
      projectId: args.projectId,
      createdBy: userId,
      createdAt: Date.now(),
      name: args.name,
      note: args.note,
      dataVersion: SNAPSHOT_DATA_VERSION,
    });

    await ctx.db.insert("projectSnapshotData", {
      snapshotId,
      blob: JSON.stringify(payload),
      compression: "none",
    });

    return snapshotId;
  },
});

export const remove = mutation({
  args: { snapshotId: v.id("projectSnapshots") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const snapshot = await ctx.db.get(args.snapshotId);
    if (!snapshot) throw new Error("Snapshot not found");
    const project = await ctx.db.get(snapshot.projectId);
    if (!project) throw new Error("Project not found");
    if (project.ownerId !== userId && !project.collaborators.includes(userId)) {
      throw new Error("Not authorized");
    }

    const data = await ctx.db
      .query("projectSnapshotData")
      .withIndex("by_snapshot", (q) => q.eq("snapshotId", args.snapshotId))
      .collect();

    for (const entry of data) {
      await ctx.db.delete(entry._id);
    }

    await ctx.db.delete(args.snapshotId);
  },
});

export const restore = mutation({
  args: { snapshotId: v.id("projectSnapshots") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const snapshot = await ctx.db.get(args.snapshotId);
    if (!snapshot) throw new Error("Snapshot not found");
    const project = await ctx.db.get(snapshot.projectId);
    if (!project) throw new Error("Project not found");
    if (project.ownerId !== userId && !project.collaborators.includes(userId)) {
      throw new Error("Not authorized");
    }

    const data = await ctx.db
      .query("projectSnapshotData")
      .withIndex("by_snapshot", (q) => q.eq("snapshotId", args.snapshotId))
      .first();

    if (!data) {
      throw new Error("Snapshot data not found");
    }

    const payload = JSON.parse(data.blob) as ProjectSnapshotPayload;

    const projectId = snapshot.projectId;

    // Remove current data
    const inputChannels = await ctx.db
      .query("inputChannels")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
    for (const channel of inputChannels) {
      await ctx.db.delete(channel._id);
    }

    const outputChannels = await ctx.db
      .query("outputChannels")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
    for (const channel of outputChannels) {
      await ctx.db.delete(channel._id);
    }

    const groups = await ctx.db
      .query("groups")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
    for (const group of groups) {
      await ctx.db.delete(group._id);
    }

    const mixers = await ctx.db
      .query("mixers")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
    for (const mixer of mixers) {
      await ctx.db.delete(mixer._id);
    }

    const ioDevices = await ctx.db
      .query("ioDevices")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();

    for (const device of ioDevices) {
      const ports = await ctx.db
        .query("ioPorts")
        .withIndex("by_ioDevice", (q) => q.eq("ioDeviceId", device._id))
        .collect();
      for (const port of ports) {
        await ctx.db.delete(port._id);
      }
      await ctx.db.delete(device._id);
    }

    // Recreate data with new IDs
    const mixerMap = new Map<string, string>();
    for (const mixer of payload.mixers) {
      const { _id, _creationTime, projectId: _, ...mixerData } = mixer;
      const newId = await ctx.db.insert("mixers", {
        ...mixerData,
        projectId,
      });
      mixerMap.set(_id, newId);
    }

    const ioDeviceMap = new Map<string, string>();
    const ioPortMap = new Map<string, string>();
    for (const device of payload.ioDevices) {
      const { _id, _creationTime, projectId: _, ...deviceData } = device;
      const newId = await ctx.db.insert("ioDevices", {
        ...deviceData,
        projectId,
      });
      ioDeviceMap.set(_id, newId);
    }

    for (const port of payload.ioPorts) {
      const { _id, _creationTime, ioDeviceId, ...portData } = port;
      const newPortId = await ctx.db.insert("ioPorts", {
        ...portData,
        ioDeviceId: ioDeviceMap.get(ioDeviceId) as any,
      });
      ioPortMap.set(_id, newPortId);
    }

    const groupMap = new Map<string, string>();
    for (const group of payload.groups) {
      const { _id, _creationTime, projectId: _, ...groupData } = group;
      const newId = await ctx.db.insert("groups", {
        ...groupData,
        projectId,
      });
      groupMap.set(_id, newId);
    }

    for (const channel of payload.inputChannels) {
      const {
        _id,
        _creationTime,
        projectId: _,
        mixerId,
        ioPortId,
        ioPortIdRight,
        groupId,
        ...channelData
      } = channel;
      await ctx.db.insert("inputChannels", {
        ...channelData,
        projectId,
        mixerId: mixerId ? (mixerMap.get(mixerId) as any) : undefined,
        ioPortId: ioPortId ? (ioPortMap.get(ioPortId) as any) : undefined,
        ioPortIdRight: ioPortIdRight ? (ioPortMap.get(ioPortIdRight) as any) : undefined,
        groupId: groupId ? (groupMap.get(groupId) as any) : undefined,
      });
    }

    for (const channel of payload.outputChannels) {
      const {
        _id,
        _creationTime,
        projectId: _,
        mixerId,
        ioPortId,
        ioPortIdRight,
        ...channelData
      } = channel;
      await ctx.db.insert("outputChannels", {
        ...channelData,
        projectId,
        mixerId: mixerId ? (mixerMap.get(mixerId) as any) : undefined,
        ioPortId: ioPortId ? (ioPortMap.get(ioPortId) as any) : undefined,
        ioPortIdRight: ioPortIdRight ? (ioPortMap.get(ioPortIdRight) as any) : undefined,
      });
    }

    await ctx.db.patch(projectId, {
      title: payload.project.title,
      date: payload.project.date,
      venue: payload.project.venue,
    });

    return { restored: true };
  },
});
