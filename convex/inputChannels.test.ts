/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("inputChannels", () => {
  async function setupProject(t: ReturnType<typeof convexTest>) {
    // Create a project first
    const projectId = await t.run(async (ctx) => {
      return await ctx.db.insert("projects", {
        title: "Test Project",
        ownerId: "test-user",
        collaborators: [],
        isArchived: false,
      });
    });
    return projectId;
  }

  describe("create", () => {
    it("should create a new input channel", async () => {
      const t = convexTest(schema, modules);
      const projectId = await setupProject(t);

      const channelId = await t.mutation(api.inputChannels.create, {
        projectId,
        source: "Kick Drum",
      });

      expect(channelId).toBeDefined();

      const channel = await t.query(api.inputChannels.get, { channelId });
      expect(channel).toBeDefined();
      expect(channel?.source).toBe("Kick Drum");
      expect(channel?.channelNumber).toBe(1);
      expect(channel?.order).toBe(1);
      expect(channel?.patched).toBe(false);
    });

    it("should auto-increment order and channelNumber", async () => {
      const t = convexTest(schema, modules);
      const projectId = await setupProject(t);

      await t.mutation(api.inputChannels.create, {
        projectId,
        source: "Kick",
      });

      const secondChannelId = await t.mutation(api.inputChannels.create, {
        projectId,
        source: "Snare",
      });

      const channel = await t.query(api.inputChannels.get, { channelId: secondChannelId });
      expect(channel?.channelNumber).toBe(2);
      expect(channel?.order).toBe(2);
    });

    it("should accept optional fields", async () => {
      const t = convexTest(schema, modules);
      const projectId = await setupProject(t);

      const channelId = await t.mutation(api.inputChannels.create, {
        projectId,
        source: "Vocal",
        uhf: "Ch 1",
        micInputDev: "SM58",
        location: "Stage Left",
        cable: "XLR 10m",
        stand: "Boom",
        notes: "Lead singer",
      });

      const channel = await t.query(api.inputChannels.get, { channelId });
      expect(channel?.uhf).toBe("Ch 1");
      expect(channel?.micInputDev).toBe("SM58");
      expect(channel?.location).toBe("Stage Left");
      expect(channel?.cable).toBe("XLR 10m");
      expect(channel?.stand).toBe("Boom");
      expect(channel?.notes).toBe("Lead singer");
    });
  });

  describe("list", () => {
    it("should return channels sorted by order", async () => {
      const t = convexTest(schema, modules);
      const projectId = await setupProject(t);

      await t.mutation(api.inputChannels.create, { projectId, source: "Kick" });
      await t.mutation(api.inputChannels.create, { projectId, source: "Snare" });
      await t.mutation(api.inputChannels.create, { projectId, source: "Hi-Hat" });

      const channels = await t.query(api.inputChannels.list, { projectId });
      expect(channels).toHaveLength(3);
      expect(channels[0].source).toBe("Kick");
      expect(channels[1].source).toBe("Snare");
      expect(channels[2].source).toBe("Hi-Hat");
    });

    it("should return empty array for project with no channels", async () => {
      const t = convexTest(schema, modules);
      const projectId = await setupProject(t);

      const channels = await t.query(api.inputChannels.list, { projectId });
      expect(channels).toHaveLength(0);
    });
  });

  describe("update", () => {
    it("should update channel fields", async () => {
      const t = convexTest(schema, modules);
      const projectId = await setupProject(t);

      const channelId = await t.mutation(api.inputChannels.create, {
        projectId,
        source: "Kick Drum",
      });

      await t.mutation(api.inputChannels.update, {
        channelId,
        source: "Kick In",
        micInputDev: "Beta 52A",
      });

      const channel = await t.query(api.inputChannels.get, { channelId });
      expect(channel?.source).toBe("Kick In");
      expect(channel?.micInputDev).toBe("Beta 52A");
    });

    it("should only update provided fields", async () => {
      const t = convexTest(schema, modules);
      const projectId = await setupProject(t);

      const channelId = await t.mutation(api.inputChannels.create, {
        projectId,
        source: "Kick",
        location: "Stage Center",
      });

      await t.mutation(api.inputChannels.update, {
        channelId,
        source: "Kick In",
      });

      const channel = await t.query(api.inputChannels.get, { channelId });
      expect(channel?.source).toBe("Kick In");
      expect(channel?.location).toBe("Stage Center"); // unchanged
    });
  });

  describe("remove", () => {
    it("should delete a channel", async () => {
      const t = convexTest(schema, modules);
      const projectId = await setupProject(t);

      const channelId = await t.mutation(api.inputChannels.create, {
        projectId,
        source: "Kick",
      });

      await t.mutation(api.inputChannels.remove, { channelId });

      const channel = await t.query(api.inputChannels.get, { channelId });
      expect(channel).toBeNull();
    });
  });

  describe("generateChannelsUpTo", () => {
    it("should generate empty channels up to target count", async () => {
      const t = convexTest(schema, modules);
      const projectId = await setupProject(t);

      const result = await t.mutation(api.inputChannels.generateChannelsUpTo, {
        projectId,
        targetCount: 5,
      });

      expect(result.added).toBe(5);
      expect(result.total).toBe(5);

      const channels = await t.query(api.inputChannels.list, { projectId });
      expect(channels).toHaveLength(5);
    });

    it("should not add channels if target is already met", async () => {
      const t = convexTest(schema, modules);
      const projectId = await setupProject(t);

      // Create 3 channels
      await t.mutation(api.inputChannels.create, { projectId, source: "1" });
      await t.mutation(api.inputChannels.create, { projectId, source: "2" });
      await t.mutation(api.inputChannels.create, { projectId, source: "3" });

      const result = await t.mutation(api.inputChannels.generateChannelsUpTo, {
        projectId,
        targetCount: 2,
      });

      expect(result.added).toBe(0);
      expect(result.total).toBe(3);
    });

    it("should continue numbering from existing channels", async () => {
      const t = convexTest(schema, modules);
      const projectId = await setupProject(t);

      await t.mutation(api.inputChannels.create, { projectId, source: "Kick" });
      await t.mutation(api.inputChannels.create, { projectId, source: "Snare" });

      await t.mutation(api.inputChannels.generateChannelsUpTo, {
        projectId,
        targetCount: 5,
      });

      const channels = await t.query(api.inputChannels.list, { projectId });
      expect(channels).toHaveLength(5);
      expect(channels[0].channelNumber).toBe(1);
      expect(channels[4].channelNumber).toBe(5);
    });
  });

  describe("moveChannel", () => {
    it("should swap channel data when moving up", async () => {
      const t = convexTest(schema, modules);
      const projectId = await setupProject(t);

      await t.mutation(api.inputChannels.create, { projectId, source: "Kick" });
      const secondChannelId = await t.mutation(api.inputChannels.create, { projectId, source: "Snare" });

      await t.mutation(api.inputChannels.moveChannel, {
        channelId: secondChannelId,
        direction: "up",
      });

      const channels = await t.query(api.inputChannels.list, { projectId });
      // After swap, the data is exchanged but positions stay the same
      expect(channels[0].source).toBe("Snare");
      expect(channels[1].source).toBe("Kick");
    });

    it("should swap channel data when moving down", async () => {
      const t = convexTest(schema, modules);
      const projectId = await setupProject(t);

      const firstChannelId = await t.mutation(api.inputChannels.create, { projectId, source: "Kick" });
      await t.mutation(api.inputChannels.create, { projectId, source: "Snare" });

      await t.mutation(api.inputChannels.moveChannel, {
        channelId: firstChannelId,
        direction: "down",
      });

      const channels = await t.query(api.inputChannels.list, { projectId });
      expect(channels[0].source).toBe("Snare");
      expect(channels[1].source).toBe("Kick");
    });

    it("should do nothing when moving first channel up", async () => {
      const t = convexTest(schema, modules);
      const projectId = await setupProject(t);

      const firstChannelId = await t.mutation(api.inputChannels.create, { projectId, source: "Kick" });
      await t.mutation(api.inputChannels.create, { projectId, source: "Snare" });

      await t.mutation(api.inputChannels.moveChannel, {
        channelId: firstChannelId,
        direction: "up",
      });

      const channels = await t.query(api.inputChannels.list, { projectId });
      expect(channels[0].source).toBe("Kick");
      expect(channels[1].source).toBe("Snare");
    });
  });

  describe("insertMany", () => {
    it("should insert multiple channels at once", async () => {
      const t = convexTest(schema, modules);
      const projectId = await setupProject(t);

      const insertedIds = await t.mutation(api.inputChannels.insertMany, {
        projectId,
        afterOrder: 0,
        channels: [
          { source: "Kick" },
          { source: "Snare" },
          { source: "Hi-Hat" },
        ],
      });

      expect(insertedIds).toHaveLength(3);

      const channels = await t.query(api.inputChannels.list, { projectId });
      expect(channels).toHaveLength(3);
      expect(channels[0].source).toBe("Kick");
      expect(channels[1].source).toBe("Snare");
      expect(channels[2].source).toBe("Hi-Hat");
    });

    it("should shift existing channels when inserting in the middle", async () => {
      const t = convexTest(schema, modules);
      const projectId = await setupProject(t);

      // Create initial channels
      await t.mutation(api.inputChannels.create, { projectId, source: "Kick" });
      await t.mutation(api.inputChannels.create, { projectId, source: "Overheads" });

      // Insert after position 1 (after Kick)
      await t.mutation(api.inputChannels.insertMany, {
        projectId,
        afterOrder: 1,
        channels: [
          { source: "Snare" },
          { source: "Hi-Hat" },
        ],
      });

      const channels = await t.query(api.inputChannels.list, { projectId });
      expect(channels).toHaveLength(4);
      expect(channels[0].source).toBe("Kick");
      expect(channels[1].source).toBe("Snare");
      expect(channels[2].source).toBe("Hi-Hat");
      expect(channels[3].source).toBe("Overheads");
    });
  });

  describe("swapOrder", () => {
    it("should swap data between two channels", async () => {
      const t = convexTest(schema, modules);
      const projectId = await setupProject(t);

      const channel1Id = await t.mutation(api.inputChannels.create, {
        projectId,
        source: "Kick",
        micInputDev: "Beta 52",
      });
      const channel2Id = await t.mutation(api.inputChannels.create, {
        projectId,
        source: "Snare",
        micInputDev: "SM57",
      });

      await t.mutation(api.inputChannels.swapOrder, {
        channelId1: channel1Id,
        channelId2: channel2Id,
      });

      const channel1 = await t.query(api.inputChannels.get, { channelId: channel1Id });
      const channel2 = await t.query(api.inputChannels.get, { channelId: channel2Id });

      // Data is swapped
      expect(channel1?.source).toBe("Snare");
      expect(channel1?.micInputDev).toBe("SM57");
      expect(channel2?.source).toBe("Kick");
      expect(channel2?.micInputDev).toBe("Beta 52");

      // But channel numbers stay the same
      expect(channel1?.channelNumber).toBe(1);
      expect(channel2?.channelNumber).toBe(2);
    });
  });
});
