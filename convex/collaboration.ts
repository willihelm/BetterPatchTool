import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
  accessTokenValidator,
  claimPendingCollaborationsForUser,
  createShareToken,
  getCurrentUser,
  getProjectAccessForRequest,
  hashShareToken,
  normalizeEmail,
  requireAuthenticatedUser,
  requireProjectAccess,
  requireProjectRole,
  shouldGracefullyHandleTokenAccessLoss,
} from "./_helpers/projectAccess";
import { logProjectActivity } from "./_helpers/projectActivity";

const cursorValidator = v.optional(v.object({
  rowId: v.optional(v.string()),
  columnKey: v.optional(v.string()),
}));

async function enrichCollaborator(ctx: any, collaborator: any, project: any) {
  const user = collaborator.userId ? (await ctx.db.get(collaborator.userId as Id<"users">)) as any : null;
  return {
    ...collaborator,
    projectId: project._id,
    displayName: user?.name || collaborator.email || collaborator.userId,
    email: collaborator.email || user?.email || undefined,
    isPending: !collaborator.acceptedAt,
    isOwner: false,
  };
}

export const claimPendingInvites = mutation({
  args: {},
  handler: async (ctx) => {
    return await claimPendingCollaborationsForUser(ctx);
  },
});

export const listCollaborators = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const access = await requireProjectAccess(ctx, args.projectId);
    const collaborators = await ctx.db
      .query("projectCollaborators")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const ownerUser = (await ctx.db.get(access.project.ownerId as Id<"users">)) as any;
    const enriched = await Promise.all(collaborators.map((collaborator) => enrichCollaborator(ctx, collaborator, access.project)));

    return [
      {
        _id: `owner:${access.project.ownerId}`,
        projectId: args.projectId,
        userId: access.project.ownerId,
        role: "owner",
        displayName: ownerUser?.name || ownerUser?.email || access.project.ownerId,
        email: ownerUser?.email || undefined,
        invitedBy: access.project.ownerId,
        createdAt: access.project._creationTime,
        acceptedAt: access.project._creationTime,
        isPending: false,
        isOwner: true,
      },
      ...enriched,
    ];
  },
});

export const inviteCollaborator = mutation({
  args: {
    projectId: v.id("projects"),
    email: v.string(),
    role: v.union(v.literal("viewer"), v.literal("editor")),
  },
  handler: async (ctx, args) => {
    const access = await requireProjectRole(ctx, args.projectId, "owner");
    const currentUser = await requireAuthenticatedUser(ctx);
    const email = normalizeEmail(args.email);
    if (!email) throw new Error("Email is required");

    const ownerUser = (await ctx.db.get(access.project.ownerId as Id<"users">)) as any;
    if (normalizeEmail(ownerUser?.email) === email) {
      throw new Error("Owner already has access");
    }

    const existingByEmail = await ctx.db
      .query("projectCollaborators")
      .withIndex("by_project_and_email", (q) => q.eq("projectId", args.projectId).eq("email", email))
      .first();

    const matchedUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (existingByEmail) {
      await ctx.db.patch(existingByEmail._id, {
        role: args.role,
        userId: matchedUser?._id ?? existingByEmail.userId,
        acceptedAt: matchedUser ? (existingByEmail.acceptedAt ?? Date.now()) : existingByEmail.acceptedAt,
      });
      await logProjectActivity(ctx, {
        projectId: args.projectId,
        actorUserId: currentUser.userId,
        entityType: "collaborator",
        entityId: String(existingByEmail._id),
        action: "updated",
        summary: `Updated collaborator ${email} to ${args.role}`,
      });
      return existingByEmail._id;
    }

    const collaboratorId = await ctx.db.insert("projectCollaborators", {
      projectId: args.projectId,
      userId: matchedUser?._id,
      email,
      role: args.role,
      invitedBy: currentUser.userId,
      createdAt: Date.now(),
      acceptedAt: matchedUser ? Date.now() : undefined,
    });

    await logProjectActivity(ctx, {
      projectId: args.projectId,
      actorUserId: currentUser.userId,
      entityType: "collaborator",
      entityId: String(collaboratorId),
      action: "invited",
      summary: `Invited ${email} as ${args.role}`,
    });

    return collaboratorId;
  },
});

export const updateCollaboratorRole = mutation({
  args: {
    collaboratorId: v.id("projectCollaborators"),
    role: v.union(v.literal("viewer"), v.literal("editor")),
  },
  handler: async (ctx, args) => {
    const collaborator = await ctx.db.get(args.collaboratorId);
    if (!collaborator) throw new Error("Collaborator not found");
    const access = await requireProjectRole(ctx, collaborator.projectId, "owner");
    const currentUser = await requireAuthenticatedUser(ctx);

    await ctx.db.patch(args.collaboratorId, { role: args.role });
    await logProjectActivity(ctx, {
      projectId: collaborator.projectId,
      actorUserId: currentUser.userId,
      entityType: "collaborator",
      entityId: String(args.collaboratorId),
      action: "updated",
      summary: `Changed collaborator role to ${args.role}`,
      metadata: { previousRole: collaborator.role },
    });

    return access.project._id;
  },
});

export const removeCollaborator = mutation({
  args: { collaboratorId: v.id("projectCollaborators") },
  handler: async (ctx, args) => {
    const collaborator = await ctx.db.get(args.collaboratorId);
    if (!collaborator) throw new Error("Collaborator not found");
    await requireProjectRole(ctx, collaborator.projectId, "owner");
    const currentUser = await requireAuthenticatedUser(ctx);

    await ctx.db.delete(args.collaboratorId);
    await logProjectActivity(ctx, {
      projectId: collaborator.projectId,
      actorUserId: currentUser.userId,
      entityType: "collaborator",
      entityId: String(args.collaboratorId),
      action: "removed",
      summary: `Removed collaborator ${collaborator.email || collaborator.userId}`,
    });
  },
});

export const listShareLinks = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    await requireProjectRole(ctx, args.projectId, "owner");
    return await ctx.db
      .query("projectShareLinks")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});

export const createShareLink = mutation({
  args: {
    projectId: v.id("projects"),
    label: v.string(),
  },
  handler: async (ctx, args) => {
    await requireProjectRole(ctx, args.projectId, "owner");
    const currentUser = await requireAuthenticatedUser(ctx);
    const token = await createShareToken();
    const tokenHash = await hashShareToken(token);

    const shareLinkId = await ctx.db.insert("projectShareLinks", {
      projectId: args.projectId,
      tokenHash,
      token,
      label: args.label.trim() || "Public view",
      isRevoked: false,
      createdBy: currentUser.userId,
      createdAt: Date.now(),
    });

    await logProjectActivity(ctx, {
      projectId: args.projectId,
      actorUserId: currentUser.userId,
      entityType: "share_link",
      entityId: String(shareLinkId),
      action: "created",
      summary: `Created share link "${args.label.trim() || "Public view"}"`,
    });

    return { shareLinkId, token };
  },
});

export const revokeShareLink = mutation({
  args: { shareLinkId: v.id("projectShareLinks") },
  handler: async (ctx, args) => {
    const shareLink = await ctx.db.get(args.shareLinkId);
    if (!shareLink) throw new Error("Share link not found");
    await requireProjectRole(ctx, shareLink.projectId, "owner");
    const currentUser = await requireAuthenticatedUser(ctx);
    await ctx.db.patch(args.shareLinkId, { isRevoked: true });
    await logProjectActivity(ctx, {
      projectId: shareLink.projectId,
      actorUserId: currentUser.userId,
      entityType: "share_link",
      entityId: String(args.shareLinkId),
      action: "revoked",
      summary: `Revoked share link "${shareLink.label}"`,
    });
  },
});

export const resolveShareLink = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const tokenHash = await hashShareToken(args.token);
    const shareLink = await ctx.db
      .query("projectShareLinks")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
      .first();
    if (!shareLink || shareLink.isRevoked) return null;

    const access = await getProjectAccessForRequest(ctx, shareLink.projectId, args.token);
    if (!access) return null;
    return {
      project: {
        ...access.project,
        accessRole: access.role,
        isOwned: false,
      },
      shareLink: {
        _id: shareLink._id,
        label: shareLink.label,
        createdAt: shareLink.createdAt,
      },
    };
  },
});

export const listPresence = query({
  args: {
    projectId: v.id("projects"),
    accessToken: accessTokenValidator,
  },
  handler: async (ctx, args) => {
    const access = await getProjectAccessForRequest(ctx, args.projectId, args.accessToken);
    if (!access) {
      if (shouldGracefullyHandleTokenAccessLoss(args.accessToken)) {
        return [];
      }
      throw new Error("Not authorized");
    }
    const onlineSince = Date.now() - 30_000;
    const entries = await ctx.db
      .query("projectPresence")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const recentEntries = entries.filter((entry) => entry.lastSeenAt >= onlineSince);
    const users = await Promise.all(
      recentEntries.map((entry) => ctx.db.get(entry.userId as Id<"users">))
    ) as any[];

    return recentEntries.map((entry, index) => ({
      ...entry,
      displayName: users[index]?.name || users[index]?.email || entry.displayName,
    }));
  },
});

export const heartbeat = mutation({
  args: {
    projectId: v.id("projects"),
    sessionId: v.string(),
    activeArea: v.optional(v.string()),
    cursor: cursorValidator,
  },
  handler: async (ctx, args) => {
    const access = await requireProjectAccess(ctx, args.projectId);
    if (!access.userId) throw new Error("Not authenticated");
    const currentUser = await requireAuthenticatedUser(ctx);

    const existing = await ctx.db
      .query("projectPresence")
      .withIndex("by_project_and_session", (q) =>
        q.eq("projectId", args.projectId).eq("sessionId", args.sessionId)
      )
      .first();

    const payload = {
      userId: currentUser.userId,
      displayName: currentUser.user?.name || currentUser.user?.email || currentUser.userId,
      activeArea: args.activeArea,
      cursor: args.cursor,
      lastSeenAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    }

    return await ctx.db.insert("projectPresence", {
      projectId: args.projectId,
      sessionId: args.sessionId,
      ...payload,
    });
  },
});

export const leavePresence = mutation({
  args: {
    projectId: v.id("projects"),
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireProjectAccess(ctx, args.projectId);
    const existing = await ctx.db
      .query("projectPresence")
      .withIndex("by_project_and_session", (q) =>
        q.eq("projectId", args.projectId).eq("sessionId", args.sessionId)
      )
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

export const listActivity = query({
  args: {
    projectId: v.id("projects"),
    accessToken: accessTokenValidator,
  },
  handler: async (ctx, args) => {
    const access = await getProjectAccessForRequest(ctx, args.projectId, args.accessToken);
    if (!access) {
      if (shouldGracefullyHandleTokenAccessLoss(args.accessToken)) {
        return [];
      }
      throw new Error("Not authorized");
    }
    const entries = await ctx.db
      .query("projectActivity")
      .withIndex("by_project_and_createdAt", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .take(50);

    const users = await Promise.all(
      entries.map((entry) => ctx.db.get(entry.actorUserId as Id<"users">))
    ) as any[];
    return entries.map((entry, index) => ({
      ...entry,
      actorName: users[index]?.name || users[index]?.email || entry.actorUserId,
      metadata: entry.metadata ? JSON.parse(entry.metadata) : undefined,
    }));
  },
});
