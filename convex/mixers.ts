import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get all mixers for a project
export const list = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("mixers")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});

// Get mixer
export const get = query({
  args: { mixerId: v.id("mixers") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.mixerId);
  },
});

// Create mixer
export const create = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.string(),
    type: v.optional(v.string()),
    stereoMode: v.union(v.literal("linked_mono"), v.literal("true_stereo")),
    channelCount: v.number(),
    designation: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("mixers", {
      projectId: args.projectId,
      name: args.name,
      type: args.type,
      stereoMode: args.stereoMode,
      channelCount: args.channelCount,
      designation: args.designation,
    });
  },
});

// Update mixer
export const update = mutation({
  args: {
    mixerId: v.id("mixers"),
    name: v.optional(v.string()),
    type: v.optional(v.string()),
    stereoMode: v.optional(v.union(v.literal("linked_mono"), v.literal("true_stereo"))),
    channelCount: v.optional(v.number()),
    designation: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { mixerId, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );
    await ctx.db.patch(mixerId, filteredUpdates);
  },
});

// Delete mixer
export const remove = mutation({
  args: { mixerId: v.id("mixers") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.mixerId);
  },
});
