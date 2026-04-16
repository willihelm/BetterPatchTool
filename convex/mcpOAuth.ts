import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { constantTimeEqual, hashMcpClientSecret } from "./_helpers/mcpCredentials";
import { createOpaqueToken, isSupportedRedirectUri, sha256Base64Url } from "./_helpers/mcpOAuth";

const AUTH_CODE_TTL_MS = 10 * 60 * 1000;
const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000;

async function requireAuthenticatedUserId(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("OAuth unauthorized");
  }
  return userId;
}

async function findActiveCredentialByClientId(ctx: any, clientId: string) {
  const credentials = await ctx.db
    .query("mcpCredentials")
    .withIndex("by_clientId", (q: any) => q.eq("clientId", clientId))
    .collect();

  return credentials.find((credential: any) => !credential.revokedAt) ?? null;
}

export const createAuthorizationCode = mutation({
  args: {
    clientId: v.string(),
    redirectUri: v.string(),
    codeChallenge: v.string(),
    codeChallengeMethod: v.union(v.literal("S256"), v.literal("plain")),
    scope: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthenticatedUserId(ctx);

    if (!isSupportedRedirectUri(args.redirectUri)) {
      throw new Error("OAuth invalid redirect_uri");
    }

    const credential = await findActiveCredentialByClientId(ctx, args.clientId);
    if (!credential || credential.userId !== userId) {
      throw new Error("OAuth invalid client");
    }

    const now = Date.now();
    const code = createOpaqueToken("bpt_oac");
    const codeHash = await sha256Base64Url(code);

    await ctx.db.insert("mcpOAuthAuthorizationCodes", {
      codeHash,
      userId,
      clientId: args.clientId,
      redirectUri: args.redirectUri,
      codeChallenge: args.codeChallenge,
      codeChallengeMethod: args.codeChallengeMethod,
      scope: args.scope,
      createdAt: now,
      expiresAt: now + AUTH_CODE_TTL_MS,
    });

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
    clientSecret: v.optional(v.string()),
    codeVerifier: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.grantType !== "authorization_code") {
      throw new Error("OAuth unsupported grant_type");
    }

    if (!isSupportedRedirectUri(args.redirectUri)) {
      throw new Error("OAuth invalid redirect_uri");
    }

    const credential = await findActiveCredentialByClientId(ctx, args.clientId);
    if (!credential) {
      throw new Error("OAuth invalid client");
    }

    if (args.clientSecret !== undefined) {
      const secretHash = await hashMcpClientSecret(args.clientId, args.clientSecret);
      if (!constantTimeEqual(secretHash, credential.clientSecretHash)) {
        throw new Error("OAuth invalid client");
      }
    }

    const codeHash = await sha256Base64Url(args.code);
    const authorizationCode = await ctx.db
      .query("mcpOAuthAuthorizationCodes")
      .withIndex("by_codeHash", (q: any) => q.eq("codeHash", codeHash))
      .first();

    if (!authorizationCode) {
      throw new Error("OAuth invalid code");
    }
    if (authorizationCode.usedAt || authorizationCode.revokedAt || authorizationCode.expiresAt <= Date.now()) {
      throw new Error("OAuth invalid code");
    }
    if (authorizationCode.clientId !== args.clientId) {
      throw new Error("OAuth invalid code");
    }
    if (authorizationCode.redirectUri !== args.redirectUri) {
      throw new Error("OAuth invalid redirect_uri");
    }

    const expectedChallenge =
      authorizationCode.codeChallengeMethod === "S256"
        ? await sha256Base64Url(args.codeVerifier)
        : args.codeVerifier;

    if (!constantTimeEqual(expectedChallenge, authorizationCode.codeChallenge)) {
      throw new Error("OAuth invalid code_verifier");
    }

    const now = Date.now();
    await ctx.db.patch(authorizationCode._id, { usedAt: now });

    const accessToken = createOpaqueToken("bpt_at");
    const tokenHash = await sha256Base64Url(accessToken);

    await ctx.db.insert("mcpOAuthAccessTokens", {
      tokenHash,
      userId: authorizationCode.userId,
      clientId: authorizationCode.clientId,
      scope: authorizationCode.scope,
      createdAt: now,
      expiresAt: now + ACCESS_TOKEN_TTL_MS,
    });

    return {
      accessToken,
      tokenType: "Bearer",
      expiresIn: Math.floor(ACCESS_TOKEN_TTL_MS / 1000),
      scope: authorizationCode.scope,
    };
  },
});
