/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("inventoryMixers", () => {
  describe("CRUD", () => {
    it("should create and list inventory mixers", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity({ subject: "test-user", issuer: "convex" });

      await asUser.mutation(api.inventoryMixers.create, {
        name: "FOH Console",
        type: "Yamaha CL5",
        stereoMode: "linked_mono",
        channelCount: 72,
        outputChannelCount: 24,
      });

      await asUser.mutation(api.inventoryMixers.create, {
        name: "Monitor Console",
        type: "Yamaha PM5D",
        stereoMode: "true_stereo",
        channelCount: 48,
      });

      const mixers = await asUser.query(api.inventoryMixers.list);
      expect(mixers).toHaveLength(2);
      expect(mixers[0].name).toBe("FOH Console");
      expect(mixers[1].name).toBe("Monitor Console");
    });

    it("should update inventory mixer", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity({ subject: "test-user", issuer: "convex" });

      const id = await asUser.mutation(api.inventoryMixers.create, {
        name: "Old Mixer",
        stereoMode: "linked_mono",
        channelCount: 48,
      });

      await asUser.mutation(api.inventoryMixers.update, {
        id,
        name: "New Mixer",
        channelCount: 72,
      });

      const mixers = await asUser.query(api.inventoryMixers.list);
      expect(mixers[0].name).toBe("New Mixer");
      expect(mixers[0].channelCount).toBe(72);
    });

    it("should remove inventory mixer", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity({ subject: "test-user", issuer: "convex" });

      const id = await asUser.mutation(api.inventoryMixers.create, {
        name: "To Delete",
        stereoMode: "linked_mono",
        channelCount: 24,
      });

      await asUser.mutation(api.inventoryMixers.remove, { id });

      const mixers = await asUser.query(api.inventoryMixers.list);
      expect(mixers).toHaveLength(0);
    });
  });

  describe("ownership", () => {
    it("should not list other user's mixers", async () => {
      const t = convexTest(schema, modules);
      const user1 = t.withIdentity({ subject: "user-1", issuer: "convex" });
      const user2 = t.withIdentity({ subject: "user-2", issuer: "convex" });

      await user1.mutation(api.inventoryMixers.create, {
        name: "User1 Mixer",
        stereoMode: "linked_mono",
        channelCount: 48,
      });

      const user2Mixers = await user2.query(api.inventoryMixers.list);
      expect(user2Mixers).toHaveLength(0);
    });

    it("should not allow deleting other user's mixer", async () => {
      const t = convexTest(schema, modules);
      const user1 = t.withIdentity({ subject: "user-1", issuer: "convex" });
      const user2 = t.withIdentity({ subject: "user-2", issuer: "convex" });

      const id = await user1.mutation(api.inventoryMixers.create, {
        name: "User1 Mixer",
        stereoMode: "linked_mono",
        channelCount: 48,
      });

      await expect(
        user2.mutation(api.inventoryMixers.remove, { id })
      ).rejects.toThrow();
    });
  });

  describe("copyToProject", () => {
    it("should copy mixer to project with channels generated", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity({ subject: "test-user", issuer: "convex" });

      const invId = await asUser.mutation(api.inventoryMixers.create, {
        name: "Monitor Console",
        type: "DiGiCo SD12",
        stereoMode: "true_stereo",
        channelCount: 48,
        outputChannelCount: 24,
      });

      const projectId = await asUser.mutation(api.projects.create, {
        title: "Test Project",
      });

      const mixerId = await asUser.mutation(api.inventoryMixers.copyToProject, {
        id: invId,
        projectId,
      });

      expect(mixerId).toBeDefined();

      // Project already has a default FOH mixer with designation "A", so new one should be "B"
      const mixers = await asUser.query(api.mixers.list, { projectId });
      const newMixer = mixers.find((m) => m._id === mixerId);
      expect(newMixer).toBeDefined();
      expect(newMixer!.name).toBe("Monitor Console");
      expect(newMixer!.designation).toBe("B");
      expect(newMixer!.stereoMode).toBe("true_stereo");

      // Verify input channels were generated
      const inputChannels = await t.run(async (ctx) => {
        return await ctx.db
          .query("inputChannels")
          .withIndex("by_mixer", (q) => q.eq("mixerId", mixerId))
          .collect();
      });
      expect(inputChannels).toHaveLength(48);

      // Verify output channels were generated
      const outputChannels = await t.run(async (ctx) => {
        return await ctx.db
          .query("outputChannels")
          .withIndex("by_mixer", (q) => q.eq("mixerId", mixerId))
          .collect();
      });
      expect(outputChannels).toHaveLength(24);
    });

    it("should auto-assign designation letters correctly", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity({ subject: "test-user", issuer: "convex" });

      const projectId = await asUser.mutation(api.projects.create, {
        title: "Test Project",
      });

      const invId = await asUser.mutation(api.inventoryMixers.create, {
        name: "Console 2",
        stereoMode: "linked_mono",
        channelCount: 24,
      });

      // Copy twice - should get B and C (A is taken by default FOH mixer)
      await asUser.mutation(api.inventoryMixers.copyToProject, { id: invId, projectId });
      await asUser.mutation(api.inventoryMixers.copyToProject, { id: invId, projectId });

      const mixers = await asUser.query(api.mixers.list, { projectId });
      const designations = mixers.map((m) => m.designation).sort();
      expect(designations).toEqual(["A", "B", "C"]);
    });
  });

  describe("saveFromProject", () => {
    it("should save project mixer to inventory", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity({ subject: "test-user", issuer: "convex" });

      const projectId = await asUser.mutation(api.projects.create, {
        title: "Test Project",
      });

      // Get the default FOH mixer
      const mixers = await asUser.query(api.mixers.list, { projectId });
      const fohMixer = mixers[0];

      await asUser.mutation(api.inventoryMixers.saveFromProject, {
        mixerId: fohMixer._id,
      });

      const invMixers = await asUser.query(api.inventoryMixers.list);
      expect(invMixers).toHaveLength(1);
      expect(invMixers[0].name).toBe("FOH");
      expect(invMixers[0].channelCount).toBe(48);
    });
  });
});
