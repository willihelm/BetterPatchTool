/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("projects", () => {
  describe("create", () => {
    it("should create a new project with default channels", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity({ subject: "test-user", issuer: "convex" });

      const projectId = await asUser.mutation(api.projects.create, {
        title: "Test Concert",
      });

      expect(projectId).toBeDefined();

      const project = await asUser.query(api.projects.get, { projectId });
      expect(project?.title).toBe("Test Concert");
      expect(project?.isArchived).toBe(false);
      expect(project?.collaborators).toEqual([]);
    });

    it("should create default mixer with project", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity({ subject: "test-user", issuer: "convex" });

      const projectId = await asUser.mutation(api.projects.create, {
        title: "Test Concert",
      });

      const mixers = await t.run(async (ctx) => {
        return await ctx.db
          .query("mixers")
          .withIndex("by_project", (q) => q.eq("projectId", projectId))
          .collect();
      });

      expect(mixers).toHaveLength(1);
      expect(mixers[0].name).toBe("FOH");
      expect(mixers[0].channelCount).toBe(48);
    });

    it("should create initial input channels", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity({ subject: "test-user", issuer: "convex" });

      const projectId = await asUser.mutation(api.projects.create, {
        title: "Test Concert",
        channelCount: 24,
      });

      const channels = await t.query(api.inputChannels.list, { projectId });
      expect(channels).toHaveLength(24);
    });

    it("should create initial output channels", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity({ subject: "test-user", issuer: "convex" });

      const projectId = await asUser.mutation(api.projects.create, {
        title: "Test Concert",
        outputChannelCount: 12,
      });

      const channels = await t.query(api.outputChannels.list, { projectId });
      expect(channels).toHaveLength(12);
    });

    it("should accept optional fields", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity({ subject: "test-user", issuer: "convex" });

      const projectId = await asUser.mutation(api.projects.create, {
        title: "Test Concert",
        date: "2025-06-15",
        venue: "Madison Square Garden",
      });

      const project = await asUser.query(api.projects.get, { projectId });
      expect(project?.date).toBe("2025-06-15");
      expect(project?.venue).toBe("Madison Square Garden");
    });
  });

  describe("list", () => {
    it("should return only non-archived projects for owner", async () => {
      const t = convexTest(schema, modules);
      const asUser1 = t.withIdentity({ subject: "user-1", issuer: "convex" });
      const asUser2 = t.withIdentity({ subject: "user-2", issuer: "convex" });

      await asUser1.mutation(api.projects.create, { title: "Project 1" });
      await asUser1.mutation(api.projects.create, { title: "Project 2" });
      await asUser2.mutation(api.projects.create, { title: "Project 3" });

      const projects = await asUser1.query(api.projects.list, {});
      expect(projects).toHaveLength(2);
    });

    it("should not return archived projects", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity({ subject: "user-1", issuer: "convex" });

      const projectId = await asUser.mutation(api.projects.create, { title: "Project 1" });
      await asUser.mutation(api.projects.create, { title: "Project 2" });

      await asUser.mutation(api.projects.archive, { projectId });

      const projects = await asUser.query(api.projects.list, {});
      expect(projects).toHaveLength(1);
      expect(projects[0].title).toBe("Project 2");
    });
  });

  describe("update", () => {
    it("should update project fields", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity({ subject: "test-user", issuer: "convex" });

      const projectId = await asUser.mutation(api.projects.create, {
        title: "Original Title",
      });

      await asUser.mutation(api.projects.update, {
        projectId,
        title: "Updated Title",
        venue: "New Venue",
      });

      const project = await asUser.query(api.projects.get, { projectId });
      expect(project?.title).toBe("Updated Title");
      expect(project?.venue).toBe("New Venue");
    });
  });

  describe("archive", () => {
    it("should archive a project", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity({ subject: "test-user", issuer: "convex" });

      const projectId = await asUser.mutation(api.projects.create, {
        title: "Test Project",
      });

      await asUser.mutation(api.projects.archive, { projectId });

      const project = await asUser.query(api.projects.get, { projectId });
      expect(project?.isArchived).toBe(true);
    });
  });

  describe("duplicate", () => {
    it("should duplicate a project with new title", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity({ subject: "test-user", issuer: "convex" });

      const originalId = await asUser.mutation(api.projects.create, {
        title: "Original Project",
        venue: "Original Venue",
      });

      const duplicatedId = await asUser.mutation(api.projects.duplicate, {
        projectId: originalId,
        newTitle: "Duplicated Project",
      });

      const duplicated = await asUser.query(api.projects.get, { projectId: duplicatedId });
      expect(duplicated?.title).toBe("Duplicated Project");
      expect(duplicated?.venue).toBe("Original Venue");
    });

    it("should duplicate input channels", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity({ subject: "test-user", issuer: "convex" });

      const originalId = await asUser.mutation(api.projects.create, {
        title: "Original",
        channelCount: 10,
      });

      // Modify first channel
      const originalChannels = await t.query(api.inputChannels.list, { projectId: originalId });
      await t.mutation(api.inputChannels.update, {
        channelId: originalChannels[0]._id,
        source: "Kick Drum",
      });

      const duplicatedId = await asUser.mutation(api.projects.duplicate, {
        projectId: originalId,
        newTitle: "Duplicated",
      });

      const duplicatedChannels = await t.query(api.inputChannels.list, { projectId: duplicatedId });
      expect(duplicatedChannels).toHaveLength(10);
      expect(duplicatedChannels[0].source).toBe("Kick Drum");
    });
  });

  describe("addCollaborator", () => {
    it("should add a collaborator to the project", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity({ subject: "owner-user", issuer: "convex" });

      const projectId = await asUser.mutation(api.projects.create, {
        title: "Test Project",
      });

      await asUser.mutation(api.projects.addCollaborator, {
        projectId,
        collaboratorId: "collab-user",
      });

      const project = await asUser.query(api.projects.get, { projectId });
      expect(project?.collaborators).toContain("collab-user");
    });

    it("should not add duplicate collaborators", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity({ subject: "owner-user", issuer: "convex" });

      const projectId = await asUser.mutation(api.projects.create, {
        title: "Test Project",
      });

      await asUser.mutation(api.projects.addCollaborator, {
        projectId,
        collaboratorId: "collab-user",
      });

      await asUser.mutation(api.projects.addCollaborator, {
        projectId,
        collaboratorId: "collab-user",
      });

      const project = await asUser.query(api.projects.get, { projectId });
      expect(project?.collaborators).toHaveLength(1);
    });
  });
});
