import { v } from "convex/values";
import { query } from "./_generated/server";

// Get all groups for a project
export const list = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("groups")
      .withIndex("by_project_and_order", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});
