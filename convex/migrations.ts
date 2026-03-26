import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireProjectRole } from "./_helpers/projectAccess";

// Lazy per-project migration: assign channels without mixerId to the first mixer
export const assignChannelsToDefaultMixer = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    await requireProjectRole(ctx, args.projectId, "editor");
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

export const migrateLegacyCollaborators = mutation({
  args: {},
  handler: async (ctx) => {
    const projects = await ctx.db.query("projects").collect();
    let migrated = 0;

    for (const project of projects) {
      for (const collaboratorId of project.collaborators) {
        const existing = await ctx.db
          .query("projectCollaborators")
          .withIndex("by_project_and_user", (q) =>
            q.eq("projectId", project._id).eq("userId", collaboratorId)
          )
          .first();

        if (existing) continue;

        await ctx.db.insert("projectCollaborators", {
          projectId: project._id,
          userId: collaboratorId,
          role: "editor",
          invitedBy: project.ownerId,
          createdAt: project._creationTime,
          acceptedAt: project._creationTime,
        });
        migrated++;
      }
    }

    return { migrated };
  },
});
