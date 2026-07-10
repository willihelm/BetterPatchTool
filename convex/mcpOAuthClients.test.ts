/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const CLAUDE_CALLBACK = "https://claude.ai/api/mcp/auth_callback";

describe("mcpOAuthClients.register", () => {
  it("registers a public client with defaults", async () => {
    const t = convexTest(schema, modules);

    const registered = await t.mutation(api.mcpOAuthClients.register, {
      clientName: "Claude",
      redirectUris: [CLAUDE_CALLBACK],
    });

    expect(registered.clientId.startsWith("bpt_client_")).toBe(true);
    expect(registered.tokenEndpointAuthMethod).toBe("none");
    expect(registered.grantTypes).toEqual(["authorization_code", "refresh_token"]);
    expect(registered.redirectUris).toEqual([CLAUDE_CALLBACK]);
    expect(registered.clientIdIssuedAt).toBeGreaterThan(0);

    const fetched = await t.query(api.mcpOAuthClients.getByClientId, {
      clientId: registered.clientId,
    });
    expect(fetched?.clientName).toBe("Claude");
    expect(fetched?.redirectUris).toEqual([CLAUDE_CALLBACK]);
  });

  it("accepts http://localhost redirect URIs (mcp-remote)", async () => {
    const t = convexTest(schema, modules);
    const registered = await t.mutation(api.mcpOAuthClients.register, {
      redirectUris: ["http://localhost:6274/oauth/callback"],
    });
    expect(registered.clientId.startsWith("bpt_client_")).toBe(true);
  });

  it("rejects empty and oversized redirect URI lists", async () => {
    const t = convexTest(schema, modules);

    await expect(t.mutation(api.mcpOAuthClients.register, { redirectUris: [] })).rejects.toThrow(
      "invalid_redirect_uri"
    );

    const tooMany = Array.from({ length: 11 }, (_, i) => `https://example.com/callback/${i}`);
    await expect(t.mutation(api.mcpOAuthClients.register, { redirectUris: tooMany })).rejects.toThrow(
      "invalid_redirect_uri"
    );
  });

  it("rejects insecure redirect URIs", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(api.mcpOAuthClients.register, { redirectUris: ["http://evil.example.com/callback"] })
    ).rejects.toThrow("invalid_redirect_uri");
    await expect(
      t.mutation(api.mcpOAuthClients.register, { redirectUris: ["not-a-url"] })
    ).rejects.toThrow("invalid_redirect_uri");
  });

  it("rejects confidential client auth methods", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(api.mcpOAuthClients.register, {
        redirectUris: [CLAUDE_CALLBACK],
        tokenEndpointAuthMethod: "client_secret_basic",
      })
    ).rejects.toThrow("invalid_client_metadata");
  });

  it("rejects unsupported grant types", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(api.mcpOAuthClients.register, {
        redirectUris: [CLAUDE_CALLBACK],
        grantTypes: ["client_credentials"],
      })
    ).rejects.toThrow("invalid_client_metadata");
  });

  it("returns null for unknown clients", async () => {
    const t = convexTest(schema, modules);
    const fetched = await t.query(api.mcpOAuthClients.getByClientId, { clientId: "bpt_client_unknown" });
    expect(fetched).toBeNull();
  });
});
