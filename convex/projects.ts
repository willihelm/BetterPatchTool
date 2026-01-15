import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get all projects for a user
export const list = query({
  args: { ownerId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("projects")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.ownerId))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();
  },
});

// Get a project
export const get = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.projectId);
  },
});

// Create new project
export const create = mutation({
  args: {
    title: v.string(),
    date: v.optional(v.string()),
    venue: v.optional(v.string()),
    ownerId: v.string(),
  },
  handler: async (ctx, args) => {
    const projectId = await ctx.db.insert("projects", {
      title: args.title,
      date: args.date,
      venue: args.venue,
      ownerId: args.ownerId,
      collaborators: [],
      isArchived: false,
    });

    // Create default "FOH" mixer
    await ctx.db.insert("mixers", {
      projectId,
      name: "FOH",
      stereoMode: "linked_mono",
      channelCount: 48,
      designation: "A",
    });

    return projectId;
  },
});

// Update project
export const update = mutation({
  args: {
    projectId: v.id("projects"),
    title: v.optional(v.string()),
    date: v.optional(v.string()),
    venue: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { projectId, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );
    await ctx.db.patch(projectId, filteredUpdates);
  },
});

// Archive project
export const archive = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.projectId, { isArchived: true });
  },
});

// Duplicate project
export const duplicate = mutation({
  args: {
    projectId: v.id("projects"),
    newTitle: v.string(),
    ownerId: v.string(),
  },
  handler: async (ctx, args) => {
    const original = await ctx.db.get(args.projectId);
    if (!original) throw new Error("Project not found");

    // Create new project
    const newProjectId = await ctx.db.insert("projects", {
      title: args.newTitle,
      date: original.date,
      venue: original.venue,
      ownerId: args.ownerId,
      collaborators: [],
      isArchived: false,
    });

    // Copy mixers
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

    // Copy stageboxes
    const stageboxes = await ctx.db
      .query("stageboxes")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const stageboxMap = new Map<string, string>();
    const portMap = new Map<string, string>();

    for (const stagebox of stageboxes) {
      const { _id, _creationTime, projectId, ...stageboxData } = stagebox;
      const newStageboxId = await ctx.db.insert("stageboxes", {
        ...stageboxData,
        projectId: newProjectId,
      });
      stageboxMap.set(_id, newStageboxId);

      // Copy ports
      const ports = await ctx.db
        .query("stageboxPorts")
        .withIndex("by_stagebox", (q) => q.eq("stageboxId", _id))
        .collect();

      for (const port of ports) {
        const { _id: portId, _creationTime: _, stageboxId, ...portData } = port;
        const newPortId = await ctx.db.insert("stageboxPorts", {
          ...portData,
          stageboxId: newStageboxId as any,
        });
        portMap.set(portId, newPortId);
      }
    }

    // Copy groups
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

    // Copy input channels
    const inputChannels = await ctx.db
      .query("inputChannels")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    for (const channel of inputChannels) {
      const { _id, _creationTime, projectId, mixerId, stageboxPortId, stageboxPortIdRight, groupId, ...channelData } = channel;
      await ctx.db.insert("inputChannels", {
        ...channelData,
        projectId: newProjectId,
        mixerId: mixerId ? (mixerMap.get(mixerId) as any) : undefined,
        stageboxPortId: stageboxPortId ? (portMap.get(stageboxPortId) as any) : undefined,
        stageboxPortIdRight: stageboxPortIdRight ? (portMap.get(stageboxPortIdRight) as any) : undefined,
        groupId: groupId ? (groupMap.get(groupId) as any) : undefined,
      });
    }

    // Copy output channels
    const outputChannels = await ctx.db
      .query("outputChannels")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    for (const channel of outputChannels) {
      const { _id, _creationTime, projectId, mixerId, stageboxPortId, ...channelData } = channel;
      await ctx.db.insert("outputChannels", {
        ...channelData,
        projectId: newProjectId,
        mixerId: mixerId ? (mixerMap.get(mixerId) as any) : undefined,
        stageboxPortId: stageboxPortId ? (portMap.get(stageboxPortId) as any) : undefined,
      });
    }

    return newProjectId;
  },
});

// Add collaborator
export const addCollaborator = mutation({
  args: {
    projectId: v.id("projects"),
    collaboratorId: v.string(),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");

    if (!project.collaborators.includes(args.collaboratorId)) {
      await ctx.db.patch(args.projectId, {
        collaborators: [...project.collaborators, args.collaboratorId],
      });
    }
  },
});
