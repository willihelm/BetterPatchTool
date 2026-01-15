import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get all stageboxes for a project
export const list = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("stageboxes")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});

// Get stagebox with ports
export const getWithPorts = query({
  args: { stageboxId: v.id("stageboxes") },
  handler: async (ctx, args) => {
    const stagebox = await ctx.db.get(args.stageboxId);
    if (!stagebox) return null;

    const ports = await ctx.db
      .query("stageboxPorts")
      .withIndex("by_stagebox", (q) => q.eq("stageboxId", args.stageboxId))
      .collect();

    return {
      ...stagebox,
      inputPorts: ports.filter((p) => p.type === "input").sort((a, b) => a.portNumber - b.portNumber),
      outputPorts: ports.filter((p) => p.type === "output").sort((a, b) => a.portNumber - b.portNumber),
    };
  },
});

// Get all ports for a project (for dropdowns)
export const listAllPorts = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const stageboxes = await ctx.db
      .query("stageboxes")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const result = [];
    for (const stagebox of stageboxes) {
      const ports = await ctx.db
        .query("stageboxPorts")
        .withIndex("by_stagebox", (q) => q.eq("stageboxId", stagebox._id))
        .collect();

      for (const port of ports) {
        result.push({
          ...port,
          stageboxName: stagebox.name,
          stageboxColor: stagebox.color,
        });
      }
    }

    return result;
  },
});

// Create stagebox (with automatic port generation)
export const create = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.string(),
    shortName: v.string(),
    color: v.string(),
    inputCount: v.number(),
    outputCount: v.number(),
    position: v.optional(v.object({ x: v.number(), y: v.number() })),
  },
  handler: async (ctx, args) => {
    const stageboxId = await ctx.db.insert("stageboxes", {
      projectId: args.projectId,
      name: args.name,
      shortName: args.shortName,
      color: args.color,
      inputCount: args.inputCount,
      outputCount: args.outputCount,
      position: args.position,
    });

    // Create input ports
    for (let i = 1; i <= args.inputCount; i++) {
      await ctx.db.insert("stageboxPorts", {
        stageboxId,
        type: "input",
        portNumber: i,
        label: `${args.shortName}-I${i}`,
      });
    }

    // Create output ports
    for (let i = 1; i <= args.outputCount; i++) {
      await ctx.db.insert("stageboxPorts", {
        stageboxId,
        type: "output",
        portNumber: i,
        label: `${args.shortName}-O${i}`,
      });
    }

    return stageboxId;
  },
});

// Update stagebox
export const update = mutation({
  args: {
    stageboxId: v.id("stageboxes"),
    name: v.optional(v.string()),
    shortName: v.optional(v.string()),
    color: v.optional(v.string()),
    position: v.optional(v.object({ x: v.number(), y: v.number() })),
  },
  handler: async (ctx, args) => {
    const { stageboxId, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );
    await ctx.db.patch(stageboxId, filteredUpdates);
  },
});

// Delete stagebox (with all ports)
export const remove = mutation({
  args: { stageboxId: v.id("stageboxes") },
  handler: async (ctx, args) => {
    // First delete all ports
    const ports = await ctx.db
      .query("stageboxPorts")
      .withIndex("by_stagebox", (q) => q.eq("stageboxId", args.stageboxId))
      .collect();

    for (const port of ports) {
      await ctx.db.delete(port._id);
    }

    // Then delete the stagebox
    await ctx.db.delete(args.stageboxId);
  },
});

// Update port label
export const updatePortLabel = mutation({
  args: {
    portId: v.id("stageboxPorts"),
    label: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.portId, { label: args.label });
  },
});
