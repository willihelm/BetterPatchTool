/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, it, expect, afterEach, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const CLAUDE_CALLBACK = "https://claude.ai/api/mcp/auth_callback";

async function sha256Base64Url(input: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function registerClient(t: ReturnType<typeof convexTest>) {
  return await t.mutation(api.mcpOAuthClients.register, {
    clientName: "Claude",
    redirectUris: [CLAUDE_CALLBACK],
  });
}

async function authorizeAndExchange(
  t: ReturnType<typeof convexTest>,
  asUser: ReturnType<ReturnType<typeof convexTest>["withIdentity"]>,
  clientId: string,
  options: { resource?: string } = {}
) {
  const verifier = `verifier-${Math.random().toString(36).slice(2)}`;
  const createdCode = await asUser.mutation(api.mcpOAuth.createAuthorizationCode, {
    clientId,
    redirectUri: CLAUDE_CALLBACK,
    codeChallenge: await sha256Base64Url(verifier),
    codeChallengeMethod: "S256",
    resource: options.resource,
  });

  return await t.mutation(api.mcpOAuth.exchangeAuthorizationCode, {
    grantType: "authorization_code",
    clientId,
    code: createdCode.code,
    redirectUri: CLAUDE_CALLBACK,
    codeVerifier: verifier,
    resource: options.resource,
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("mcpOAuth authorization code flow", () => {
  it("supports DCR -> authorize -> exchange -> MCP bearer usage", async () => {
    const t = convexTest(schema, modules);
    const asUser = t.withIdentity({ subject: "oauth-user", issuer: "convex" });

    await asUser.mutation(api.projects.create, { title: "OAuth MCP Project" });
    const client = await registerClient(t);

    const exchanged = await authorizeAndExchange(t, asUser, client.clientId);

    expect(exchanged.tokenType).toBe("Bearer");
    expect(exchanged.accessToken.startsWith("bpt_at_")).toBe(true);
    expect(exchanged.refreshToken.startsWith("bpt_rt_")).toBe(true);
    expect(exchanged.expiresIn).toBe(3600);

    const projects = await t.mutation(api.mcp.executeToolWithOAuthAccessToken, {
      accessToken: exchanged.accessToken,
      name: "list_projects",
      args: {},
    });

    expect((projects as any[]).length).toBe(1);
    expect((projects as any[])[0].title).toBe("OAuth MCP Project");
  });

  it("rejects the plain PKCE method", async () => {
    const t = convexTest(schema, modules);
    const asUser = t.withIdentity({ subject: "oauth-user", issuer: "convex" });
    const client = await registerClient(t);

    await expect(
      asUser.mutation(api.mcpOAuth.createAuthorizationCode, {
        clientId: client.clientId,
        redirectUri: CLAUDE_CALLBACK,
        codeChallenge: "plain-challenge",
        codeChallengeMethod: "plain",
      })
    ).rejects.toThrow("OAuth invalid code_challenge_method");
  });

  it("rejects unknown clients and unregistered redirect URIs", async () => {
    const t = convexTest(schema, modules);
    const asUser = t.withIdentity({ subject: "oauth-user", issuer: "convex" });
    const client = await registerClient(t);
    const challenge = await sha256Base64Url("verifier");

    await expect(
      asUser.mutation(api.mcpOAuth.createAuthorizationCode, {
        clientId: "bpt_client_unknown",
        redirectUri: CLAUDE_CALLBACK,
        codeChallenge: challenge,
        codeChallengeMethod: "S256",
      })
    ).rejects.toThrow("OAuth invalid client");

    await expect(
      asUser.mutation(api.mcpOAuth.createAuthorizationCode, {
        clientId: client.clientId,
        redirectUri: "https://attacker.example.com/callback",
        codeChallenge: challenge,
        codeChallengeMethod: "S256",
      })
    ).rejects.toThrow("OAuth invalid redirect_uri");
  });

  it("rejects wrong PKCE verifier and redirect_uri mismatch at exchange", async () => {
    const t = convexTest(schema, modules);
    const asUser = t.withIdentity({ subject: "oauth-user", issuer: "convex" });
    const client = await registerClient(t);

    const createdCode = await asUser.mutation(api.mcpOAuth.createAuthorizationCode, {
      clientId: client.clientId,
      redirectUri: CLAUDE_CALLBACK,
      codeChallenge: await sha256Base64Url("correct-verifier"),
      codeChallengeMethod: "S256",
    });

    await expect(
      t.mutation(api.mcpOAuth.exchangeAuthorizationCode, {
        grantType: "authorization_code",
        clientId: client.clientId,
        code: createdCode.code,
        redirectUri: "https://claude.ai/other/callback",
        codeVerifier: "correct-verifier",
      })
    ).rejects.toThrow("OAuth invalid redirect_uri");

    await expect(
      t.mutation(api.mcpOAuth.exchangeAuthorizationCode, {
        grantType: "authorization_code",
        clientId: client.clientId,
        code: createdCode.code,
        redirectUri: CLAUDE_CALLBACK,
        codeVerifier: "wrong-verifier",
      })
    ).rejects.toThrow("OAuth invalid code_verifier");
  });

  it("authorization codes are single-use", async () => {
    const t = convexTest(schema, modules);
    const asUser = t.withIdentity({ subject: "oauth-user", issuer: "convex" });
    const client = await registerClient(t);

    const verifier = "single-use-verifier";
    const createdCode = await asUser.mutation(api.mcpOAuth.createAuthorizationCode, {
      clientId: client.clientId,
      redirectUri: CLAUDE_CALLBACK,
      codeChallenge: await sha256Base64Url(verifier),
      codeChallengeMethod: "S256",
    });

    const exchangeArgs = {
      grantType: "authorization_code",
      clientId: client.clientId,
      code: createdCode.code,
      redirectUri: CLAUDE_CALLBACK,
      codeVerifier: verifier,
    };

    await t.mutation(api.mcpOAuth.exchangeAuthorizationCode, exchangeArgs);
    await expect(t.mutation(api.mcpOAuth.exchangeAuthorizationCode, exchangeArgs)).rejects.toThrow(
      "OAuth invalid code"
    );
  });

  it("enforces the configured resource (RFC 8707)", async () => {
    vi.stubEnv("MCP_RESOURCE_URL", "https://app.example.com/api/mcp");
    const t = convexTest(schema, modules);
    const asUser = t.withIdentity({ subject: "oauth-user", issuer: "convex" });
    const client = await registerClient(t);

    await expect(
      asUser.mutation(api.mcpOAuth.createAuthorizationCode, {
        clientId: client.clientId,
        redirectUri: CLAUDE_CALLBACK,
        codeChallenge: await sha256Base64Url("verifier"),
        codeChallengeMethod: "S256",
        resource: "https://other.example.com/api/mcp",
      })
    ).rejects.toThrow("OAuth invalid resource");

    const exchanged = await authorizeAndExchange(t, asUser, client.clientId, {
      resource: "https://app.example.com/api/mcp",
    });
    expect(exchanged.accessToken.startsWith("bpt_at_")).toBe(true);

    const validated = await t.query(api.mcpOAuth.validateAccessToken, {
      accessToken: exchanged.accessToken,
    });
    expect(validated?.clientId).toBe(client.clientId);
  });

  it("rejects audience-mismatched tokens when the resource URL changes", async () => {
    vi.stubEnv("MCP_RESOURCE_URL", "https://app.example.com/api/mcp");
    const t = convexTest(schema, modules);
    const asUser = t.withIdentity({ subject: "oauth-user", issuer: "convex" });
    const client = await registerClient(t);

    const exchanged = await authorizeAndExchange(t, asUser, client.clientId, {
      resource: "https://app.example.com/api/mcp",
    });

    vi.stubEnv("MCP_RESOURCE_URL", "https://elsewhere.example.com/api/mcp");
    const validated = await t.query(api.mcpOAuth.validateAccessToken, {
      accessToken: exchanged.accessToken,
    });
    expect(validated).toBeNull();

    await expect(
      t.mutation(api.mcp.executeToolWithOAuthAccessToken, {
        accessToken: exchanged.accessToken,
        name: "list_projects",
        args: {},
      })
    ).rejects.toThrow("MCP_ERROR:unauthorized");
  });
});

describe("mcpOAuth refresh tokens", () => {
  it("rotates refresh tokens and keeps the grant alive", async () => {
    const t = convexTest(schema, modules);
    const asUser = t.withIdentity({ subject: "oauth-user", issuer: "convex" });
    const client = await registerClient(t);

    const exchanged = await authorizeAndExchange(t, asUser, client.clientId);

    const refreshed = await t.mutation(api.mcpOAuth.refreshAccessToken, {
      grantType: "refresh_token",
      clientId: client.clientId,
      refreshToken: exchanged.refreshToken,
    });
    if ("error" in refreshed) throw new Error("expected refresh to succeed");

    expect(refreshed.accessToken.startsWith("bpt_at_")).toBe(true);
    expect(refreshed.refreshToken.startsWith("bpt_rt_")).toBe(true);
    expect(refreshed.refreshToken).not.toBe(exchanged.refreshToken);

    const validated = await t.query(api.mcpOAuth.validateAccessToken, {
      accessToken: refreshed.accessToken,
    });
    expect(validated?.clientId).toBe(client.clientId);
  });

  it("revokes the whole token family when a rotated refresh token is reused", async () => {
    const t = convexTest(schema, modules);
    const asUser = t.withIdentity({ subject: "oauth-user", issuer: "convex" });
    const client = await registerClient(t);

    const exchanged = await authorizeAndExchange(t, asUser, client.clientId);
    const refreshed = await t.mutation(api.mcpOAuth.refreshAccessToken, {
      grantType: "refresh_token",
      clientId: client.clientId,
      refreshToken: exchanged.refreshToken,
    });
    if ("error" in refreshed) throw new Error("expected refresh to succeed");

    // Replay of the rotated token trips reuse detection. The error is returned
    // as a value so the revocation writes commit.
    const replay = await t.mutation(api.mcpOAuth.refreshAccessToken, {
      grantType: "refresh_token",
      clientId: client.clientId,
      refreshToken: exchanged.refreshToken,
    });
    expect(replay).toMatchObject({ error: "invalid_grant" });

    // The whole family is dead: the newest refresh token and all access tokens.
    const afterRevocation = await t.mutation(api.mcpOAuth.refreshAccessToken, {
      grantType: "refresh_token",
      clientId: client.clientId,
      refreshToken: refreshed.refreshToken,
    });
    expect(afterRevocation).toMatchObject({ error: "invalid_grant" });

    expect(
      await t.query(api.mcpOAuth.validateAccessToken, { accessToken: refreshed.accessToken })
    ).toBeNull();
    expect(
      await t.query(api.mcpOAuth.validateAccessToken, { accessToken: exchanged.accessToken })
    ).toBeNull();
  });

  it("rejects refresh tokens presented by a different client", async () => {
    const t = convexTest(schema, modules);
    const asUser = t.withIdentity({ subject: "oauth-user", issuer: "convex" });
    const client = await registerClient(t);
    const otherClient = await t.mutation(api.mcpOAuthClients.register, {
      clientName: "Other",
      redirectUris: [CLAUDE_CALLBACK],
    });

    const exchanged = await authorizeAndExchange(t, asUser, client.clientId);

    await expect(
      t.mutation(api.mcpOAuth.refreshAccessToken, {
        grantType: "refresh_token",
        clientId: otherClient.clientId,
        refreshToken: exchanged.refreshToken,
      })
    ).rejects.toThrow("OAuth invalid refresh_token");
  });
});

describe("mcpOAuth grants management", () => {
  it("lists connected apps and revokes all tokens for a client", async () => {
    const t = convexTest(schema, modules);
    const asUser = t.withIdentity({ subject: "oauth-user", issuer: "convex" });
    const client = await registerClient(t);

    const exchanged = await authorizeAndExchange(t, asUser, client.clientId);

    const grants = await asUser.query(api.mcpOAuth.listGrants, {});
    expect(grants.length).toBe(1);
    expect(grants[0].clientId).toBe(client.clientId);
    expect(grants[0].clientName).toBe("Claude");

    await asUser.mutation(api.mcpOAuth.revokeClientGrant, { clientId: client.clientId });

    expect(
      await t.query(api.mcpOAuth.validateAccessToken, { accessToken: exchanged.accessToken })
    ).toBeNull();
    const refreshAfterRevoke = await t.mutation(api.mcpOAuth.refreshAccessToken, {
      grantType: "refresh_token",
      clientId: client.clientId,
      refreshToken: exchanged.refreshToken,
    });
    expect(refreshAfterRevoke).toMatchObject({ error: "invalid_grant" });

    const grantsAfter = await asUser.query(api.mcpOAuth.listGrants, {});
    expect(grantsAfter.length).toBe(0);
  });
});
