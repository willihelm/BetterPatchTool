import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
// ConvexError so error codes survive prod redaction and reach the OAuth endpoints.
import { ConvexError, v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { constantTimeEqual } from "./_helpers/mcpCredentials";
import {
  createOpaqueToken,
  isAllowedTokenAudience,
  isSupportedRedirectUri,
  sha256Base64Url,
} from "./_helpers/mcpOAuth";

const AUTH_CODE_TTL_MS = 10 * 60 * 1000;
const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

async function requireAuthenticatedUserId(ctx: MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new ConvexError("OAuth unauthorized");
  }
  return userId;
}

async function getRegisteredClient(ctx: QueryCtx, clientId: string) {
  return await ctx.db
    .query("mcpOAuthClients")
    .withIndex("by_clientId", (q) => q.eq("clientId", clientId))
    .unique();
}

// RFC 8707: a requested resource must match this deployment's MCP endpoint.
// When MCP_RESOURCE_URL is unset (local dev), the value is stored unverified.
function validateRequestedResource(resource: string | undefined) {
  if (resource === undefined) return undefined;
  const expected = process.env.MCP_RESOURCE_URL;
  if (expected && resource !== expected) {
    throw new ConvexError("OAuth invalid resource");
  }
  return resource;
}

async function issueTokenPair(
  ctx: MutationCtx,
  grant: { userId: string; clientId: string; scope?: string; resource?: string }
) {
  const now = Date.now();

  const accessToken = createOpaqueToken("bpt_at");
  await ctx.db.insert("mcpOAuthAccessTokens", {
    tokenHash: await sha256Base64Url(accessToken),
    userId: grant.userId,
    clientId: grant.clientId,
    scope: grant.scope,
    resource: grant.resource,
    createdAt: now,
    expiresAt: now + ACCESS_TOKEN_TTL_MS,
  });

  const refreshToken = createOpaqueToken("bpt_rt");
  await ctx.db.insert("mcpOAuthRefreshTokens", {
    tokenHash: await sha256Base64Url(refreshToken),
    userId: grant.userId,
    clientId: grant.clientId,
    scope: grant.scope,
    resource: grant.resource,
    createdAt: now,
    expiresAt: now + REFRESH_TOKEN_TTL_MS,
  });

  return {
    accessToken,
    refreshToken,
    tokenType: "Bearer" as const,
    expiresIn: Math.floor(ACCESS_TOKEN_TTL_MS / 1000),
    scope: grant.scope,
  };
}

async function revokeTokenFamily(ctx: MutationCtx, userId: string, clientId: string) {
  const now = Date.now();
  const refreshTokens = ctx.db
    .query("mcpOAuthRefreshTokens")
    .withIndex("by_user_and_clientId", (q) => q.eq("userId", userId).eq("clientId", clientId));
  for await (const token of refreshTokens) {
    if (!token.revokedAt) {
      await ctx.db.patch(token._id, { revokedAt: now });
    }
  }

  const accessTokens = ctx.db
    .query("mcpOAuthAccessTokens")
    .withIndex("by_user_and_clientId", (q) => q.eq("userId", userId).eq("clientId", clientId));
  for await (const token of accessTokens) {
    if (!token.revokedAt) {
      await ctx.db.patch(token._id, { revokedAt: now });
    }
  }
}

export const createAuthorizationCode = mutation({
  args: {
    clientId: v.string(),
    redirectUri: v.string(),
    codeChallenge: v.string(),
    codeChallengeMethod: v.string(),
    scope: v.optional(v.string()),
    resource: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthenticatedUserId(ctx);

    // OAuth 2.1 drops "plain"; existing rows keep the wider schema union until Step 7.
    if (args.codeChallengeMethod !== "S256") {
      throw new ConvexError("OAuth invalid code_challenge_method");
    }

    const client = await getRegisteredClient(ctx, args.clientId);
    if (!client) {
      throw new ConvexError("OAuth invalid client");
    }
    if (!isSupportedRedirectUri(args.redirectUri) || !client.redirectUris.includes(args.redirectUri)) {
      throw new ConvexError("OAuth invalid redirect_uri");
    }

    const resource = validateRequestedResource(args.resource);

    const now = Date.now();
    const code = createOpaqueToken("bpt_oac");

    await ctx.db.insert("mcpOAuthAuthorizationCodes", {
      codeHash: await sha256Base64Url(code),
      userId,
      clientId: args.clientId,
      redirectUri: args.redirectUri,
      codeChallenge: args.codeChallenge,
      codeChallengeMethod: "S256",
      scope: args.scope,
      resource,
      createdAt: now,
      expiresAt: now + AUTH_CODE_TTL_MS,
    });

    await ctx.db.patch(client._id, { lastUsedAt: now });

    return {
      code,
      expiresIn: Math.floor(AUTH_CODE_TTL_MS / 1000),
    };
  },
});

export const exchangeAuthorizationCode = mutation({
  args: {
    grantType: v.string(),
    code: v.string(),
    redirectUri: v.string(),
    clientId: v.string(),
    codeVerifier: v.string(),
    resource: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.grantType !== "authorization_code") {
      throw new ConvexError("OAuth unsupported grant_type");
    }

    // Public client: identity is client_id match only, proof of possession is PKCE.
    const client = await getRegisteredClient(ctx, args.clientId);
    if (!client) {
      throw new ConvexError("OAuth invalid client");
    }

    const codeHash = await sha256Base64Url(args.code);
    const authorizationCode = await ctx.db
      .query("mcpOAuthAuthorizationCodes")
      .withIndex("by_codeHash", (q) => q.eq("codeHash", codeHash))
      .first();

    if (!authorizationCode) {
      throw new ConvexError("OAuth invalid code");
    }
    if (authorizationCode.usedAt || authorizationCode.revokedAt || authorizationCode.expiresAt <= Date.now()) {
      throw new ConvexError("OAuth invalid code");
    }
    if (authorizationCode.clientId !== args.clientId) {
      throw new ConvexError("OAuth invalid code");
    }
    if (authorizationCode.redirectUri !== args.redirectUri) {
      throw new ConvexError("OAuth invalid redirect_uri");
    }
    if (authorizationCode.codeChallengeMethod !== "S256") {
      // Legacy pre-migration codes with "plain" are no longer exchangeable.
      throw new ConvexError("OAuth invalid code");
    }

    const expectedChallenge = await sha256Base64Url(args.codeVerifier);
    if (!constantTimeEqual(expectedChallenge, authorizationCode.codeChallenge)) {
      throw new ConvexError("OAuth invalid code_verifier");
    }

    const requestedResource = validateRequestedResource(args.resource);
    if (
      requestedResource !== undefined &&
      authorizationCode.resource !== undefined &&
      requestedResource !== authorizationCode.resource
    ) {
      throw new ConvexError("OAuth invalid resource");
    }

    await ctx.db.patch(authorizationCode._id, { usedAt: Date.now() });

    return await issueTokenPair(ctx, {
      userId: authorizationCode.userId,
      clientId: authorizationCode.clientId,
      scope: authorizationCode.scope,
      resource: requestedResource ?? authorizationCode.resource,
    });
  },
});

export const refreshAccessToken = mutation({
  args: {
    grantType: v.string(),
    refreshToken: v.string(),
    clientId: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.grantType !== "refresh_token") {
      throw new ConvexError("OAuth unsupported grant_type");
    }

    const client = await getRegisteredClient(ctx, args.clientId);
    if (!client) {
      throw new ConvexError("OAuth invalid client");
    }

    const tokenHash = await sha256Base64Url(args.refreshToken);
    const tokenDoc = await ctx.db
      .query("mcpOAuthRefreshTokens")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
      .first();

    if (!tokenDoc || tokenDoc.clientId !== args.clientId) {
      throw new ConvexError("OAuth invalid refresh_token");
    }

    if (tokenDoc.rotatedAt || tokenDoc.revokedAt) {
      // OAuth 2.1 rotation-reuse detection: a replayed refresh token means the
      // family may be compromised, so every token for this user+client is
      // revoked. A client retrying after a lost response gets signed out and
      // must re-authorize — accepted trade-off.
      // Returned as a value, not thrown: a throw would roll back the
      // revocation writes (Convex mutations are transactions).
      await revokeTokenFamily(ctx, tokenDoc.userId, tokenDoc.clientId);
      return {
        error: "invalid_grant" as const,
        errorDescription: "OAuth invalid refresh_token: reuse detected, grant revoked",
      };
    }
    if (tokenDoc.expiresAt <= Date.now()) {
      throw new ConvexError("OAuth invalid refresh_token");
    }

    await ctx.db.patch(tokenDoc._id, { rotatedAt: Date.now() });
    await ctx.db.patch(client._id, { lastUsedAt: Date.now() });

    return await issueTokenPair(ctx, {
      userId: tokenDoc.userId,
      clientId: tokenDoc.clientId,
      scope: tokenDoc.scope,
      resource: tokenDoc.resource,
    });
  },
});

// Bearer-token check for the Next.js MCP transport (withMcpAuth verifyToken).
// Read-only by design; lastUsedAt bookkeeping happens in executeToolWithOAuthAccessToken.
export const validateAccessToken = query({
  args: { accessToken: v.string() },
  handler: async (ctx, args) => {
    const tokenHash = await sha256Base64Url(args.accessToken);
    const tokenDoc = await ctx.db
      .query("mcpOAuthAccessTokens")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
      .first();

    if (!tokenDoc || tokenDoc.revokedAt || tokenDoc.expiresAt <= Date.now()) {
      return null;
    }
    if (!isAllowedTokenAudience(tokenDoc.resource)) {
      return null;
    }

    return {
      userId: tokenDoc.userId,
      clientId: tokenDoc.clientId,
      scope: tokenDoc.scope,
      expiresAt: tokenDoc.expiresAt,
    };
  },
});

const MAX_GRANT_TOKENS = 500;

// Connected apps for the settings UI: one entry per client that still holds a
// live (non-revoked, non-expired) token for the current user.
export const listGrants = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const now = Date.now();
    const grants = new Map<string, { lastUsedAt?: number; createdAt: number; scope?: string }>();

    const accessTokens = await ctx.db
      .query("mcpOAuthAccessTokens")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(MAX_GRANT_TOKENS);
    for (const token of accessTokens) {
      if (token.revokedAt || token.expiresAt <= now) continue;
      const existing = grants.get(token.clientId);
      const usedTimes = [existing?.lastUsedAt, token.lastUsedAt].filter((t): t is number => t !== undefined);
      grants.set(token.clientId, {
        createdAt: Math.min(existing?.createdAt ?? token.createdAt, token.createdAt),
        lastUsedAt: usedTimes.length > 0 ? Math.max(...usedTimes) : undefined,
        scope: token.scope ?? existing?.scope,
      });
    }

    const refreshTokens = await ctx.db
      .query("mcpOAuthRefreshTokens")
      .withIndex("by_user_and_clientId", (q) => q.eq("userId", userId))
      .take(MAX_GRANT_TOKENS);
    for (const token of refreshTokens) {
      if (token.revokedAt || token.expiresAt <= now) continue;
      const existing = grants.get(token.clientId);
      grants.set(token.clientId, {
        createdAt: Math.min(existing?.createdAt ?? token.createdAt, token.createdAt),
        lastUsedAt: existing?.lastUsedAt,
        scope: token.scope ?? existing?.scope,
      });
    }

    const result = [];
    for (const [clientId, grant] of grants) {
      const client = await ctx.db
        .query("mcpOAuthClients")
        .withIndex("by_clientId", (q) => q.eq("clientId", clientId))
        .unique();
      result.push({
        clientId,
        clientName: client?.clientName,
        clientUri: client?.clientUri,
        connectedAt: grant.createdAt,
        lastUsedAt: grant.lastUsedAt,
        scope: grant.scope,
      });
    }
    return result.sort((a, b) => (b.lastUsedAt ?? b.connectedAt) - (a.lastUsedAt ?? a.connectedAt));
  },
});

export const revokeClientGrant = mutation({
  args: { clientId: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireAuthenticatedUserId(ctx);
    await revokeTokenFamily(ctx, userId, args.clientId);
    return { ok: true };
  },
});
