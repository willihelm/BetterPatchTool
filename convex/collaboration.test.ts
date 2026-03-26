/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("collaboration", () => {
  it("lets invited collaborators see shared projects in the dashboard", async () => {
    const t = convexTest(schema, modules);
    const owner = t.withIdentity({ subject: "owner-user", issuer: "convex" });
    const editor = t.withIdentity({ subject: "editor-user", issuer: "convex" });

    const projectId = await owner.mutation(api.projects.create, { title: "Shared Project" });
    await owner.mutation(api.projects.addCollaborator, {
      projectId,
      collaboratorId: "editor-user",
    });

    const projects = await editor.query(api.projects.list, {});
    expect(projects).toHaveLength(1);
    expect(projects[0].title).toBe("Shared Project");
    expect(projects[0].accessRole).toBe("editor");
    expect(projects[0].isOwned).toBe(false);
  });

  it("prevents viewers from editing project content", async () => {
    const t = convexTest(schema, modules);
    const owner = t.withIdentity({ subject: "owner-user", issuer: "convex" });
    const viewer = t.withIdentity({ subject: "viewer-user", issuer: "convex" });

    const projectId = await owner.mutation(api.projects.create, { title: "View Only Project" });
    const collaboratorId = await owner.mutation(api.collaboration.inviteCollaborator, {
      projectId,
      email: "viewer@example.com",
      role: "viewer",
    });

    await t.run(async (ctx) => {
      await ctx.db.patch(collaboratorId, {
        userId: "viewer-user",
        acceptedAt: Date.now(),
      });
    });

    const channels = await viewer.query(api.inputChannels.list, { projectId });

    await expect(
      viewer.mutation(api.inputChannels.update, {
        channelId: channels[0]._id,
        source: "Should Fail",
      })
    ).rejects.toThrow("Not authorized");
  });

  it("allows editors to update channels", async () => {
    const t = convexTest(schema, modules);
    const owner = t.withIdentity({ subject: "owner-user", issuer: "convex" });
    const editor = t.withIdentity({ subject: "editor-user", issuer: "convex" });

    const projectId = await owner.mutation(api.projects.create, { title: "Editor Project" });
    await owner.mutation(api.projects.addCollaborator, {
      projectId,
      collaboratorId: "editor-user",
    });

    const channels = await editor.query(api.inputChannels.list, { projectId });
    await editor.mutation(api.inputChannels.update, {
      channelId: channels[0]._id,
      source: "Kick",
    });

    const updated = await editor.query(api.inputChannels.get, { channelId: channels[0]._id });
    expect(updated?.source).toBe("Kick");
  });

  it("resolves public share links as read-only access", async () => {
    const t = convexTest(schema, modules);
    const owner = t.withIdentity({ subject: "owner-user", issuer: "convex" });

    const projectId = await owner.mutation(api.projects.create, { title: "Public Share Project" });
    const channels = await owner.query(api.inputChannels.list, { projectId });
    const link = await owner.mutation(api.collaboration.createShareLink, {
      projectId,
      label: "Public",
    });

    const resolved = await t.query(api.collaboration.resolveShareLink, { token: link.token });
    expect(resolved?.project.accessRole).toBe("share_viewer");

    const sharedChannels = await t.query(api.inputChannels.list, {
      projectId,
      accessToken: link.token,
    });
    expect(sharedChannels).toHaveLength(channels.length);
  });

  it("returns the share token when listing links for owners", async () => {
    const t = convexTest(schema, modules);
    const owner = t.withIdentity({ subject: "owner-user", issuer: "convex" });

    const projectId = await owner.mutation(api.projects.create, { title: "Copyable Share Project" });
    const created = await owner.mutation(api.collaboration.createShareLink, {
      projectId,
      label: "Copy me",
    });

    const shareLinks = await owner.query(api.collaboration.listShareLinks, { projectId });
    expect(shareLinks).toHaveLength(1);
    expect(shareLinks[0].token).toBe(created.token);
  });

  it("returns empty read models after a share link is revoked", async () => {
    const t = convexTest(schema, modules);
    const owner = t.withIdentity({ subject: "owner-user", issuer: "convex" });

    const projectId = await owner.mutation(api.projects.create, { title: "Revoked Share Project" });
    const { shareLinkId, token } = await owner.mutation(api.collaboration.createShareLink, {
      projectId,
      label: "Public",
    });

    expect(
      await t.query(api.inputChannels.list, {
        projectId,
        accessToken: token,
      })
    ).not.toHaveLength(0);

    await owner.mutation(api.collaboration.revokeShareLink, { shareLinkId });

    const originalNodeEnv = process.env.NODE_ENV;
    const originalVitest = process.env.VITEST;
    process.env.NODE_ENV = "development";
    process.env.VITEST = "false";
    try {
      await expect(t.query(api.collaboration.resolveShareLink, { token })).resolves.toBeNull();
      await expect(
        t.query(api.inputChannels.list, {
          projectId,
          accessToken: token,
        })
      ).resolves.toEqual([]);
      await expect(
        t.query(api.mixers.list, {
          projectId,
          accessToken: token,
        })
      ).resolves.toEqual([]);
      await expect(
        t.query(api.collaboration.listPresence, {
          projectId,
          accessToken: token,
        })
      ).resolves.toEqual([]);
      await expect(
        t.query(api.patching.getAllPatchingData, {
          projectId,
          accessToken: token,
        })
      ).resolves.toEqual({
        portInfoMap: {},
        portUsageMap: {},
        inputPortGroups: [],
        outputPortGroups: [],
      });
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
      process.env.VITEST = originalVitest;
    }
  });
});
