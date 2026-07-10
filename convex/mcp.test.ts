/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
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

// Runs the full DCR -> authorize -> exchange flow so tests exercise the same
// OAuth access-token path the transport route uses in production.
async function accessTokenFor(
  t: ReturnType<typeof convexTest>,
  asUser: ReturnType<ReturnType<typeof convexTest>["withIdentity"]>
) {
  const client = await t.mutation(api.mcpOAuthClients.register, {
    clientName: "Claude",
    redirectUris: [CLAUDE_CALLBACK],
  });

  const verifier = `verifier-${Math.random().toString(36).slice(2)}`;
  const createdCode = await asUser.mutation(api.mcpOAuth.createAuthorizationCode, {
    clientId: client.clientId,
    redirectUri: CLAUDE_CALLBACK,
    codeChallenge: await sha256Base64Url(verifier),
    codeChallengeMethod: "S256",
  });

  const exchanged = await t.mutation(api.mcpOAuth.exchangeAuthorizationCode, {
    grantType: "authorization_code",
    clientId: client.clientId,
    code: createdCode.code,
    redirectUri: CLAUDE_CALLBACK,
    codeVerifier: verifier,
  });

  return exchanged.accessToken;
}

describe("mcp executeToolWithOAuthAccessToken", () => {
  it("rejects invalid access tokens with unauthorized", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(api.mcp.executeToolWithOAuthAccessToken, {
        accessToken: "bpt_at_not-a-real-token",
        name: "list_projects",
        args: {},
      })
    ).rejects.toThrow("MCP_ERROR:unauthorized");
  });

  it("allows read-write-read flow for an editor user", async () => {
    const t = convexTest(schema, modules);
    const owner = t.withIdentity({ subject: "owner-user", issuer: "convex" });
    const editor = t.withIdentity({ subject: "editor-user", issuer: "convex" });

    const projectId = await owner.mutation(api.projects.create, { title: "MCP Project" });
    await owner.mutation(api.projects.addCollaborator, { projectId, collaboratorId: "editor-user" });

    const editorToken = await accessTokenFor(t, editor);

    const projects = await t.mutation(api.mcp.executeToolWithOAuthAccessToken, {
      accessToken: editorToken,
      name: "list_projects",
      args: {},
    });
    expect((projects as any[]).length).toBe(1);

    const channelsBefore = await t.mutation(api.mcp.executeToolWithOAuthAccessToken, {
      accessToken: editorToken,
      name: "list_input_channels",
      args: { projectId },
    });
    expect(channelsBefore as any[], "Expected at least one input channel for update test").not.toHaveLength(0);
    const firstChannel = (channelsBefore as any[])[0];

    await t.mutation(api.mcp.executeToolWithOAuthAccessToken, {
      accessToken: editorToken,
      name: "update_input_channel",
      args: {
        channelId: firstChannel._id,
        source: "Kick In",
      },
    });

    const channelsAfter = await t.mutation(api.mcp.executeToolWithOAuthAccessToken, {
      accessToken: editorToken,
      name: "list_input_channels",
      args: { projectId },
    });
    expect((channelsAfter as any[])[0].source).toBe("Kick In");
  });

  it("blocks write tools for viewers", async () => {
    const t = convexTest(schema, modules);
    const owner = t.withIdentity({ subject: "owner-user", issuer: "convex" });
    const viewer = t.withIdentity({ subject: "viewer-user", issuer: "convex" });

    const projectId = await owner.mutation(api.projects.create, { title: "View-only MCP" });
    await owner.mutation(api.projects.addCollaborator, {
      projectId,
      collaboratorId: "viewer-user",
    });

    await t.run(async (ctx) => {
      const collaborator = await ctx.db
        .query("projectCollaborators")
        .withIndex("by_project_and_user", (q) => q.eq("projectId", projectId).eq("userId", "viewer-user"))
        .first();
      if (collaborator) {
        await ctx.db.patch(collaborator._id, { role: "viewer" });
      }
    });

    const viewerToken = await accessTokenFor(t, viewer);

    await expect(
      t.mutation(api.mcp.executeToolWithOAuthAccessToken, {
        accessToken: viewerToken,
        name: "update_project_meta",
        args: { projectId, title: "Should fail" },
      })
    ).rejects.toThrow("MCP_ERROR:forbidden");
  });

  it("returns invalid_arguments on malformed payload and logs activity on write", async () => {
    const t = convexTest(schema, modules);
    const owner = t.withIdentity({ subject: "owner-user", issuer: "convex" });
    const projectId = await owner.mutation(api.projects.create, { title: "Audit MCP" });
    const ownerToken = await accessTokenFor(t, owner);

    await expect(
      t.mutation(api.mcp.executeToolWithOAuthAccessToken, {
        accessToken: ownerToken,
        name: "update_project_meta",
        args: { projectId },
      })
    ).rejects.toThrow("MCP_ERROR:invalid_arguments");

    await t.mutation(api.mcp.executeToolWithOAuthAccessToken, {
      accessToken: ownerToken,
      name: "update_project_meta",
      args: { projectId, venue: "Arena" },
    });

    const activity = await t.run(async (ctx) => {
      return await ctx.db
        .query("projectActivity")
        .withIndex("by_project", (q) => q.eq("projectId", projectId))
        .collect();
    });

    expect(activity.some((entry) => entry.summary.includes("via MCP"))).toBe(true);
  });
});
