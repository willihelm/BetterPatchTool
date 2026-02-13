import { v } from "convex/values";
import { mutation } from "./_generated/server";

// Lazy per-project migration: assign channels without mixerId to the first mixer
export const assignChannelsToDefaultMixer = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    // Find the first mixer for this project
    const mixers = await ctx.db
      .query("mixers")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    if (mixers.length === 0) return { migrated: 0 };

    // Sort by order to get the "first" mixer
    mixers.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const defaultMixer = mixers[0];

    // Also set order on the mixer if missing
    if (defaultMixer.order === undefined) {
      await ctx.db.patch(defaultMixer._id, { order: 0 });
    }

    let migrated = 0;

    // Migrate input channels
    const inputChannels = await ctx.db
      .query("inputChannels")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    for (const channel of inputChannels) {
      if (!channel.mixerId) {
        await ctx.db.patch(channel._id, { mixerId: defaultMixer._id });
        migrated++;
      }
    }

    // Migrate output channels
    const outputChannels = await ctx.db
      .query("outputChannels")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    for (const channel of outputChannels) {
      if (!channel.mixerId) {
        await ctx.db.patch(channel._id, { mixerId: defaultMixer._id });
        migrated++;
      }
    }

    return { migrated };
  },
});
