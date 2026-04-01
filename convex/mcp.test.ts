/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("mcp executeTool", () => {
  it("rejects unauthenticated requests with unauthorized", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(api.mcp.executeTool, {
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

    const projects = await editor.mutation(api.mcp.executeTool, {
      name: "list_projects",
      args: {},
    });
    expect((projects as any[]).length).toBe(1);

    const channelsBefore = await editor.mutation(api.mcp.executeTool, {
      name: "list_input_channels",
      args: { projectId },
    });
    expect(channelsBefore as any[], "Expected at least one input channel for update test").not.toHaveLength(0);
    const firstChannel = (channelsBefore as any[])[0];

    await editor.mutation(api.mcp.executeTool, {
      name: "update_input_channel",
      args: {
        channelId: firstChannel._id,
        source: "Kick In",
      },
    });

    const channelsAfter = await editor.mutation(api.mcp.executeTool, {
      name: "list_input_channels",
      args: { projectId },
    });
    expect((channelsAfter as any[])[0].source).toBe("Kick In");
  });

  it("allows MCP calls with client credentials", async () => {
    const t = convexTest(schema, modules);
    const owner = t.withIdentity({ subject: "owner-user", issuer: "convex" });
    const editor = t.withIdentity({ subject: "editor-user", issuer: "convex" });

    const projectId = await owner.mutation(api.projects.create, { title: "MCP Credentials Project" });
    await owner.mutation(api.projects.addCollaborator, { projectId, collaboratorId: "editor-user" });

    const created = await editor.mutation(api.mcpCredentials.create, { name: "Claude Code" });
    const projects = await t.mutation(api.mcp.executeToolWithClientCredentials, {
      clientId: created.clientId,
      clientSecret: created.clientSecret,
      name: "list_projects",
      args: {},
    });

    expect((projects as any[]).length).toBe(1);
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

    await expect(
      viewer.mutation(api.mcp.executeTool, {
        name: "update_project_meta",
        args: { projectId, title: "Should fail" },
      })
    ).rejects.toThrow("MCP_ERROR:forbidden");
  });

  it("returns invalid_arguments on malformed payload and logs activity on write", async () => {
    const t = convexTest(schema, modules);
    const owner = t.withIdentity({ subject: "owner-user", issuer: "convex" });
    const projectId = await owner.mutation(api.projects.create, { title: "Audit MCP" });

    await expect(
      owner.mutation(api.mcp.executeTool, {
        name: "update_project_meta",
        args: { projectId },
      })
    ).rejects.toThrow("MCP_ERROR:invalid_arguments");

    await owner.mutation(api.mcp.executeTool, {
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
