import type { Id } from "../_generated/dataModel";

export async function logProjectActivity(
  ctx: any,
  args: {
    projectId: Id<"projects">;
    actorUserId: string;
    entityType: string;
    entityId?: string;
    action: string;
    summary: string;
    metadata?: Record<string, unknown>;
  }
) {
  await ctx.db.insert("projectActivity", {
    projectId: args.projectId,
    actorUserId: args.actorUserId,
    entityType: args.entityType,
    entityId: args.entityId,
    action: args.action,
    summary: args.summary,
    metadata: args.metadata ? JSON.stringify(args.metadata) : undefined,
    createdAt: Date.now(),
  });
}
