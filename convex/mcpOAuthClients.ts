import { mutation, query } from "./_generated/server";
// ConvexError so error codes survive prod redaction and reach the OAuth endpoints.
import { ConvexError, v } from "convex/values";
import { createOpaqueToken, isSupportedRedirectUri } from "./_helpers/mcpOAuth";

const MAX_REDIRECT_URIS = 10;
const MAX_STRING_LENGTH = 512;

const SUPPORTED_GRANT_TYPES = ["authorization_code", "refresh_token"] as const;

function isValidOptionalString(value: string | undefined) {
  return value === undefined || (value.length > 0 && value.length <= MAX_STRING_LENGTH);
}

// Open Dynamic Client Registration (RFC 7591). Intentionally unauthenticated:
// MCP clients (e.g. Claude) self-register before the user ever logs in. Only
// public clients are accepted — no secrets are issued or stored — and unused
// registrations decay via the daily cleanup cron.
export const register = mutation({
  args: {
    clientName: v.optional(v.string()),
    redirectUris: v.array(v.string()),
    tokenEndpointAuthMethod: v.optional(v.string()),
    grantTypes: v.optional(v.array(v.string())),
    clientUri: v.optional(v.string()),
    logoUri: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.redirectUris.length < 1 || args.redirectUris.length > MAX_REDIRECT_URIS) {
      throw new ConvexError(`OAuth invalid_redirect_uri: between 1 and ${MAX_REDIRECT_URIS} redirect_uris are required`);
    }
    for (const redirectUri of args.redirectUris) {
      if (redirectUri.length > MAX_STRING_LENGTH || !isSupportedRedirectUri(redirectUri)) {
        throw new ConvexError("OAuth invalid_redirect_uri: redirect_uris must use https (or http on localhost)");
      }
    }

    const authMethod = args.tokenEndpointAuthMethod ?? "none";
    if (authMethod !== "none") {
      throw new ConvexError('OAuth invalid_client_metadata: only token_endpoint_auth_method "none" is supported');
    }

    const grantTypes = args.grantTypes ?? [...SUPPORTED_GRANT_TYPES];
    for (const grantType of grantTypes) {
      if (!SUPPORTED_GRANT_TYPES.includes(grantType as (typeof SUPPORTED_GRANT_TYPES)[number])) {
        throw new ConvexError(`OAuth invalid_client_metadata: unsupported grant_type "${grantType}"`);
      }
    }

    if (
      !isValidOptionalString(args.clientName) ||
      !isValidOptionalString(args.clientUri) ||
      !isValidOptionalString(args.logoUri)
    ) {
      throw new ConvexError("OAuth invalid_client_metadata: metadata fields must be non-empty and at most 512 characters");
    }

    const now = Date.now();
    const clientId = createOpaqueToken("bpt_client");

    await ctx.db.insert("mcpOAuthClients", {
      clientId,
      clientName: args.clientName,
      redirectUris: args.redirectUris,
      tokenEndpointAuthMethod: "none",
      grantTypes,
      clientUri: args.clientUri,
      logoUri: args.logoUri,
      createdAt: now,
      lastUsedAt: now,
    });

    return {
      clientId,
      clientName: args.clientName,
      redirectUris: args.redirectUris,
      tokenEndpointAuthMethod: "none" as const,
      grantTypes,
      clientUri: args.clientUri,
      logoUri: args.logoUri,
      clientIdIssuedAt: Math.floor(now / 1000),
    };
  },
});

export const getByClientId = query({
  args: { clientId: v.string() },
  handler: async (ctx, args) => {
    const client = await ctx.db
      .query("mcpOAuthClients")
      .withIndex("by_clientId", (q) => q.eq("clientId", args.clientId))
      .unique();

    if (!client) return null;
    return {
      clientId: client.clientId,
      clientName: client.clientName,
      redirectUris: client.redirectUris,
      clientUri: client.clientUri,
      logoUri: client.logoUri,
    };
  },
});
