/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function sha256Base64Url(input: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

describe("mcpOAuth", () => {
  it("supports authorization_code + PKCE flow and MCP bearer usage", async () => {
    const t = convexTest(schema, modules);
    const asUser = t.withIdentity({ subject: "oauth-user", issuer: "convex" });

    await asUser.mutation(api.projects.create, { title: "OAuth MCP Project" });
    const createdCredential = await asUser.mutation(api.mcpCredentials.create, { name: "Claude OAuth" });

    const verifier = "test-verifier-1234567890";
    const challenge = await sha256Base64Url(verifier);

    const createdCode = await asUser.mutation(api.mcpOAuth.createAuthorizationCode, {
      clientId: createdCredential.clientId,
      redirectUri: "https://claude.ai/api/mcp/auth_callback",
      codeChallenge: challenge,
      codeChallengeMethod: "S256",
    });

    const exchanged = await t.mutation(api.mcpOAuth.exchangeAuthorizationCode, {
      grantType: "authorization_code",
      clientId: createdCredential.clientId,
      clientSecret: createdCredential.clientSecret,
      code: createdCode.code,
      redirectUri: "https://claude.ai/api/mcp/auth_callback",
      codeVerifier: verifier,
    });

    expect(exchanged.tokenType).toBe("Bearer");
    expect(exchanged.accessToken.startsWith("bpt_at_")).toBe(true);

    const projects = await t.mutation(api.mcp.executeToolWithOAuthAccessToken, {
      accessToken: exchanged.accessToken,
      name: "list_projects",
      args: {},
    });

    expect((projects as any[]).length).toBe(1);
    expect((projects as any[])[0].title).toBe("OAuth MCP Project");
  });

  it("rejects wrong PKCE verifier", async () => {
    const t = convexTest(schema, modules);
    const asUser = t.withIdentity({ subject: "oauth-user", issuer: "convex" });

    const createdCredential = await asUser.mutation(api.mcpCredentials.create, { name: "Claude OAuth" });

    const createdCode = await asUser.mutation(api.mcpOAuth.createAuthorizationCode, {
      clientId: createdCredential.clientId,
      redirectUri: "https://claude.ai/api/mcp/auth_callback",
      codeChallenge: await sha256Base64Url("correct-verifier"),
      codeChallengeMethod: "S256",
    });

    await expect(
      t.mutation(api.mcpOAuth.exchangeAuthorizationCode, {
        grantType: "authorization_code",
        clientId: createdCredential.clientId,
        clientSecret: createdCredential.clientSecret,
        code: createdCode.code,
        redirectUri: "https://claude.ai/api/mcp/auth_callback",
        codeVerifier: "wrong-verifier",
      })
    ).rejects.toThrow("OAuth invalid code_verifier");
  });
});
