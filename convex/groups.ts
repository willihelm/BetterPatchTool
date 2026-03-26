import { v } from "convex/values";
import { query } from "./_generated/server";
import { accessTokenValidator, requireProjectAccess } from "./_helpers/projectAccess";

export const list = query({
  args: {
    projectId: v.id("projects"),
    accessToken: accessTokenValidator,
  },
  handler: async (ctx, args) => {
    await requireProjectAccess(ctx, args.projectId, args.accessToken);
    return await ctx.db
      .query("groups")
      .withIndex("by_project_and_order", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});
