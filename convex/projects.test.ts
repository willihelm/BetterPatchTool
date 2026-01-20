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

      const projectId = await t.mutation(api.projects.create, {
        title: "Test Concert",
        ownerId: "test-user",
      });

      expect(projectId).toBeDefined();

      const project = await t.query(api.projects.get, { projectId });
      expect(project?.title).toBe("Test Concert");
      expect(project?.ownerId).toBe("test-user");
      expect(project?.isArchived).toBe(false);
      expect(project?.collaborators).toEqual([]);
    });

    it("should create default mixer with project", async () => {
      const t = convexTest(schema, modules);

      const projectId = await t.mutation(api.projects.create, {
        title: "Test Concert",
        ownerId: "test-user",
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

      const projectId = await t.mutation(api.projects.create, {
        title: "Test Concert",
        ownerId: "test-user",
        channelCount: 24,
      });

      const channels = await t.query(api.inputChannels.list, { projectId });
      expect(channels).toHaveLength(24);
    });

    it("should create initial output channels", async () => {
      const t = convexTest(schema, modules);

      const projectId = await t.mutation(api.projects.create, {
        title: "Test Concert",
        ownerId: "test-user",
        outputChannelCount: 12,
      });

      const channels = await t.query(api.outputChannels.list, { projectId });
      expect(channels).toHaveLength(12);
    });

    it("should accept optional fields", async () => {
      const t = convexTest(schema, modules);

      const projectId = await t.mutation(api.projects.create, {
        title: "Test Concert",
        ownerId: "test-user",
        date: "2025-06-15",
        venue: "Madison Square Garden",
      });

      const project = await t.query(api.projects.get, { projectId });
      expect(project?.date).toBe("2025-06-15");
      expect(project?.venue).toBe("Madison Square Garden");
    });
  });

  describe("list", () => {
    it("should return only non-archived projects for owner", async () => {
      const t = convexTest(schema, modules);

      await t.mutation(api.projects.create, { title: "Project 1", ownerId: "user-1" });
      await t.mutation(api.projects.create, { title: "Project 2", ownerId: "user-1" });
      await t.mutation(api.projects.create, { title: "Project 3", ownerId: "user-2" });

      const projects = await t.query(api.projects.list, { ownerId: "user-1" });
      expect(projects).toHaveLength(2);
    });

    it("should not return archived projects", async () => {
      const t = convexTest(schema, modules);

      const projectId = await t.mutation(api.projects.create, { title: "Project 1", ownerId: "user-1" });
      await t.mutation(api.projects.create, { title: "Project 2", ownerId: "user-1" });

      await t.mutation(api.projects.archive, { projectId });

      const projects = await t.query(api.projects.list, { ownerId: "user-1" });
      expect(projects).toHaveLength(1);
      expect(projects[0].title).toBe("Project 2");
    });
  });

  describe("update", () => {
    it("should update project fields", async () => {
      const t = convexTest(schema, modules);

      const projectId = await t.mutation(api.projects.create, {
        title: "Original Title",
        ownerId: "test-user",
      });

      await t.mutation(api.projects.update, {
        projectId,
        title: "Updated Title",
        venue: "New Venue",
      });

      const project = await t.query(api.projects.get, { projectId });
      expect(project?.title).toBe("Updated Title");
      expect(project?.venue).toBe("New Venue");
    });
  });

  describe("archive", () => {
    it("should archive a project", async () => {
      const t = convexTest(schema, modules);

      const projectId = await t.mutation(api.projects.create, {
        title: "Test Project",
        ownerId: "test-user",
      });

      await t.mutation(api.projects.archive, { projectId });

      const project = await t.query(api.projects.get, { projectId });
      expect(project?.isArchived).toBe(true);
    });
  });

  describe("duplicate", () => {
    it("should duplicate a project with new title", async () => {
      const t = convexTest(schema, modules);

      const originalId = await t.mutation(api.projects.create, {
        title: "Original Project",
        ownerId: "test-user",
        venue: "Original Venue",
      });

      const duplicatedId = await t.mutation(api.projects.duplicate, {
        projectId: originalId,
        newTitle: "Duplicated Project",
        ownerId: "test-user",
      });

      const duplicated = await t.query(api.projects.get, { projectId: duplicatedId });
      expect(duplicated?.title).toBe("Duplicated Project");
      expect(duplicated?.venue).toBe("Original Venue");
    });

    it("should duplicate input channels", async () => {
      const t = convexTest(schema, modules);

      const originalId = await t.mutation(api.projects.create, {
        title: "Original",
        ownerId: "test-user",
        channelCount: 10,
      });

      // Modify first channel
      const originalChannels = await t.query(api.inputChannels.list, { projectId: originalId });
      await t.mutation(api.inputChannels.update, {
        channelId: originalChannels[0]._id,
        source: "Kick Drum",
      });

      const duplicatedId = await t.mutation(api.projects.duplicate, {
        projectId: originalId,
        newTitle: "Duplicated",
        ownerId: "test-user",
      });

      const duplicatedChannels = await t.query(api.inputChannels.list, { projectId: duplicatedId });
      expect(duplicatedChannels).toHaveLength(10);
      expect(duplicatedChannels[0].source).toBe("Kick Drum");
    });
  });

  describe("addCollaborator", () => {
    it("should add a collaborator to the project", async () => {
      const t = convexTest(schema, modules);

      const projectId = await t.mutation(api.projects.create, {
        title: "Test Project",
        ownerId: "owner-user",
      });

      await t.mutation(api.projects.addCollaborator, {
        projectId,
        collaboratorId: "collab-user",
      });

      const project = await t.query(api.projects.get, { projectId });
      expect(project?.collaborators).toContain("collab-user");
    });

    it("should not add duplicate collaborators", async () => {
      const t = convexTest(schema, modules);

      const projectId = await t.mutation(api.projects.create, {
        title: "Test Project",
        ownerId: "owner-user",
      });

      await t.mutation(api.projects.addCollaborator, {
        projectId,
        collaboratorId: "collab-user",
      });

      await t.mutation(api.projects.addCollaborator, {
        projectId,
        collaboratorId: "collab-user",
      });

      const project = await t.query(api.projects.get, { projectId });
      expect(project?.collaborators).toHaveLength(1);
    });
  });
});
