import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { requireAuthenticatedUser } from "./_helpers/projectAccess";
import {
  constantTimeEqual,
  createMcpClientId,
  createMcpClientSecret,
  hashMcpClientSecret,
} from "./_helpers/mcpCredentials";

async function resolveActiveMcpCredential(ctx: any, clientId: string, clientSecret: string) {
  const clientSecretHash = await hashMcpClientSecret(clientId, clientSecret);
  const candidates = await ctx.db
    .query("mcpCredentials")
    .withIndex("by_clientId", (q: any) => q.eq("clientId", clientId))
    .collect();

  for (const candidate of candidates) {
    if (candidate.revokedAt) continue;
    if (constantTimeEqual(candidate.clientSecretHash, clientSecretHash)) {
      return candidate;
    }
  }

  return null;
}

export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const currentUser = await requireAuthenticatedUser(ctx);
    const clientId = createMcpClientId();
    const clientSecret = createMcpClientSecret();
    const clientSecretHash = await hashMcpClientSecret(clientId, clientSecret);
    const name = args.name.trim();
    const now = Date.now();

    if (!name) throw new Error("Credential name is required");

    const credentialId = await ctx.db.insert("mcpCredentials", {
      userId: currentUser.userId,
      name,
      clientId,
      clientSecretHash,
      createdAt: now,
    });

    return {
      credentialId,
      clientId,
      clientSecret,
      createdAt: now,
      name,
    };
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const currentUser = await requireAuthenticatedUser(ctx);
    const credentials = await ctx.db
      .query("mcpCredentials")
      .withIndex("by_user", (q: any) => q.eq("userId", currentUser.userId))
      .collect();

    return credentials
      .filter((credential) => !credential.revokedAt)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((credential) => ({
        _id: credential._id,
        name: credential.name,
        clientId: credential.clientId,
        createdAt: credential.createdAt,
        lastUsedAt: credential.lastUsedAt,
      }));
  },
});

export const remove = mutation({
  args: { credentialId: v.id("mcpCredentials") },
  handler: async (ctx, args) => {
    const currentUser = await requireAuthenticatedUser(ctx);
    const credential = await ctx.db.get(args.credentialId);
    if (!credential) throw new Error("Credential not found");
    if (credential.userId !== currentUser.userId) throw new Error("Not authorized");

    await ctx.db.delete(args.credentialId);
  },
});

export const authenticateByClientCredentials = mutation({
  args: { clientId: v.string(), clientSecret: v.string() },
  handler: async (ctx, args) => {
    const credential = await resolveActiveMcpCredential(ctx, args.clientId, args.clientSecret);
    if (!credential) return null;
    await ctx.db.patch(credential._id as Id<"mcpCredentials">, { lastUsedAt: Date.now() });
    return { userId: credential.userId, credentialId: credential._id };
  },
});
