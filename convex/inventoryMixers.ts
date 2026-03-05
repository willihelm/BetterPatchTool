import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const mixers = await ctx.db
      .query("inventoryMixers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return mixers.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    type: v.optional(v.string()),
    stereoMode: v.union(v.literal("linked_mono"), v.literal("true_stereo")),
    channelCount: v.number(),
    outputChannelCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("inventoryMixers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const maxOrder = existing.reduce((max, m) => Math.max(max, m.order ?? 0), 0);

    return await ctx.db.insert("inventoryMixers", {
      userId,
      name: args.name,
      type: args.type,
      stereoMode: args.stereoMode,
      channelCount: args.channelCount,
      outputChannelCount: args.outputChannelCount ?? 24,
      order: maxOrder + 1,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("inventoryMixers"),
    name: v.optional(v.string()),
    type: v.optional(v.string()),
    stereoMode: v.optional(v.union(v.literal("linked_mono"), v.literal("true_stereo"))),
    channelCount: v.optional(v.number()),
    outputChannelCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const mixer = await ctx.db.get(args.id);
    if (!mixer || mixer.userId !== userId) throw new Error("Not found");

    const { id, ...updates } = args;
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );
    await ctx.db.patch(id, filtered);
  },
});

export const remove = mutation({
  args: { id: v.id("inventoryMixers") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const mixer = await ctx.db.get(args.id);
    if (!mixer || mixer.userId !== userId) throw new Error("Not found");

    await ctx.db.delete(args.id);
  },
});

export const copyToProject = mutation({
  args: {
    id: v.id("inventoryMixers"),
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const invMixer = await ctx.db.get(args.id);
    if (!invMixer || invMixer.userId !== userId) throw new Error("Not found");

    // Auto-assign next designation letter
    const existingMixers = await ctx.db
      .query("mixers")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const usedDesignations = new Set(existingMixers.map((m) => m.designation));
    let designation = "A";
    for (let i = 0; i < 26; i++) {
      const letter = String.fromCharCode(65 + i);
      if (!usedDesignations.has(letter)) {
        designation = letter;
        break;
      }
    }

    const maxOrder = existingMixers.length > 0
      ? Math.max(...existingMixers.map((m) => m.order ?? 0))
      : -1;

    const mixerId = await ctx.db.insert("mixers", {
      projectId: args.projectId,
      name: invMixer.name,
      type: invMixer.type,
      stereoMode: invMixer.stereoMode,
      channelCount: invMixer.channelCount,
      designation,
      order: maxOrder + 1,
    });

    // Auto-generate empty input channels
    for (let i = 0; i < invMixer.channelCount; i++) {
      await ctx.db.insert("inputChannels", {
        projectId: args.projectId,
        mixerId,
        order: i + 1,
        channelNumber: i + 1,
        source: "",
        patched: false,
      });
    }

    // Auto-generate empty output channels
    const outputCount = invMixer.outputChannelCount ?? 24;
    for (let i = 0; i < outputCount; i++) {
      await ctx.db.insert("outputChannels", {
        projectId: args.projectId,
        mixerId,
        order: i + 1,
        busName: "",
        destination: "",
      });
    }

    return mixerId;
  },
});

export const saveFromProject = mutation({
  args: { mixerId: v.id("mixers") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const mixer = await ctx.db.get(args.mixerId);
    if (!mixer) throw new Error("Mixer not found");

    const existing = await ctx.db
      .query("inventoryMixers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const maxOrder = existing.reduce((max, m) => Math.max(max, m.order ?? 0), 0);

    return await ctx.db.insert("inventoryMixers", {
      userId,
      name: mixer.name,
      type: mixer.type,
      stereoMode: mixer.stereoMode,
      channelCount: mixer.channelCount,
      outputChannelCount: 24, // default, not stored on project mixer
      order: maxOrder + 1,
    });
  },
});
