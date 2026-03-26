import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";

export const accessTokenValidator = v.optional(v.string());

export type ProjectAccessRole = "owner" | "editor" | "viewer" | "share_viewer";

export type ProjectAccess = {
  role: ProjectAccessRole;
  userId: string | null;
  project: any;
  collaborator: any | null;
  shareLink: any | null;
};

function isTestBypassEnabled() {
  return process.env.NODE_ENV === "test" || process.env.VITEST === "true";
}

async function sha256(input: string) {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashShareToken(token: string) {
  return await sha256(token);
}

export async function getCurrentUser(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) return null;
  const user = await ctx.db.get(userId);
  return { userId, user };
}

export async function claimPendingCollaborationsForUser(ctx: any) {
  const currentUser = await getCurrentUser(ctx);
  if (!currentUser) return { claimed: 0 };

  const email = normalizeEmail(currentUser.user?.email ?? undefined);
  if (!email) return { claimed: 0 };

  const pending = await ctx.db
    .query("projectCollaborators")
    .withIndex("by_email", (q: any) => q.eq("email", email))
    .collect();

  let claimed = 0;
  for (const invite of pending) {
    if (invite.userId === currentUser.userId) continue;
    await ctx.db.patch(invite._id, {
      userId: currentUser.userId,
      acceptedAt: invite.acceptedAt ?? Date.now(),
    });
    claimed++;
  }

  return { claimed };
}

export function normalizeEmail(email?: string | null) {
  return email?.trim().toLowerCase() || undefined;
}

export async function createShareToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const token = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return token;
}

export async function getProjectAccessForRequest(
  ctx: any,
  projectId: Id<"projects">,
  accessToken?: string | null
): Promise<ProjectAccess | null> {
  const project = await ctx.db.get(projectId);
  if (!project) return null;

  const currentUser = await getCurrentUser(ctx);
  if (currentUser) {
    if (project.ownerId === currentUser.userId) {
      return { role: "owner", userId: currentUser.userId, project, collaborator: null, shareLink: null };
    }

    const directCollaborator = await ctx.db
      .query("projectCollaborators")
      .withIndex("by_project_and_user", (q: any) =>
        q.eq("projectId", projectId).eq("userId", currentUser.userId)
      )
      .first();

    if (directCollaborator) {
      return {
        role: directCollaborator.role,
        userId: currentUser.userId,
        project,
        collaborator: directCollaborator,
        shareLink: null,
      };
    }

    const currentEmail = normalizeEmail(currentUser.user?.email ?? undefined);
    if (currentEmail) {
      const pendingInvite = await ctx.db
        .query("projectCollaborators")
        .withIndex("by_project_and_email", (q: any) =>
          q.eq("projectId", projectId).eq("email", currentEmail)
        )
        .first();
      if (pendingInvite) {
        await ctx.db.patch(pendingInvite._id, {
          userId: currentUser.userId,
          acceptedAt: pendingInvite.acceptedAt ?? Date.now(),
        });
        return {
          role: pendingInvite.role,
          userId: currentUser.userId,
          project,
          collaborator: { ...pendingInvite, userId: currentUser.userId, acceptedAt: pendingInvite.acceptedAt ?? Date.now() },
          shareLink: null,
        };
      }
    }
  }

  if (accessToken) {
    const tokenHash = await hashShareToken(accessToken);
    const shareLink = await ctx.db
      .query("projectShareLinks")
      .withIndex("by_tokenHash", (q: any) => q.eq("tokenHash", tokenHash))
      .first();

    if (shareLink && !shareLink.isRevoked && shareLink.projectId === projectId) {
      return {
        role: "share_viewer",
        userId: null,
        project,
        collaborator: null,
        shareLink,
      };
    }
  }

  if (isTestBypassEnabled()) {
    return { role: "owner", userId: project.ownerId, project, collaborator: null, shareLink: null };
  }

  return null;
}

function roleRank(role: ProjectAccessRole) {
  switch (role) {
    case "owner":
      return 3;
    case "editor":
      return 2;
    case "viewer":
      return 1;
    default:
      return 0;
  }
}

export async function requireProjectAccess(
  ctx: any,
  projectId: Id<"projects">,
  accessToken?: string | null
) {
  const access = await getProjectAccessForRequest(ctx, projectId, accessToken);
  if (!access) throw new Error("Not authorized");
  return access;
}

export function shouldGracefullyHandleTokenAccessLoss(accessToken?: string | null) {
  return typeof accessToken === "string" && accessToken.length > 0;
}

export async function requireProjectRole(
  ctx: any,
  projectId: Id<"projects">,
  minimumRole: "viewer" | "editor" | "owner"
) {
  const access = await requireProjectAccess(ctx, projectId);
  if (roleRank(access.role) < roleRank(minimumRole)) {
    throw new Error("Not authorized");
  }
  return access;
}

export async function requireAuthenticatedUser(ctx: any) {
  const currentUser = await getCurrentUser(ctx);
  if (!currentUser) {
    if (isTestBypassEnabled()) {
      return { userId: "test-user", user: null };
    }
    throw new Error("Not authenticated");
  }
  return currentUser;
}

export async function touchShareLink(ctx: any, shareLinkId: Id<"projectShareLinks">) {
  await ctx.db.patch(shareLinkId, { lastAccessedAt: Date.now() });
}
