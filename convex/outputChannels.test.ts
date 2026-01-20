/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("outputChannels", () => {
  async function setupProject(t: ReturnType<typeof convexTest>) {
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
    it("should create a new output channel", async () => {
      const t = convexTest(schema, modules);
      const projectId = await setupProject(t);

      const channelId = await t.mutation(api.outputChannels.create, {
        projectId,
        busName: "Main L",
        destination: "PA Left",
      });

      expect(channelId).toBeDefined();

      const channel = await t.query(api.outputChannels.get, { channelId });
      expect(channel?.busName).toBe("Main L");
      expect(channel?.destination).toBe("PA Left");
      expect(channel?.order).toBe(1);
    });

    it("should auto-increment order", async () => {
      const t = convexTest(schema, modules);
      const projectId = await setupProject(t);

      await t.mutation(api.outputChannels.create, {
        projectId,
        busName: "Main L",
        destination: "PA Left",
      });

      const secondChannelId = await t.mutation(api.outputChannels.create, {
        projectId,
        busName: "Main R",
        destination: "PA Right",
      });

      const channel = await t.query(api.outputChannels.get, { channelId: secondChannelId });
      expect(channel?.order).toBe(2);
    });

    it("should accept optional fields", async () => {
      const t = convexTest(schema, modules);
      const projectId = await setupProject(t);

      const channelId = await t.mutation(api.outputChannels.create, {
        projectId,
        busName: "Sub",
        destination: "Subwoofer",
        ampProcessor: "Lab Gruppen",
        location: "Stage Right",
        cable: "NL4 30m",
        notes: "LF only",
      });

      const channel = await t.query(api.outputChannels.get, { channelId });
      expect(channel?.ampProcessor).toBe("Lab Gruppen");
      expect(channel?.location).toBe("Stage Right");
      expect(channel?.cable).toBe("NL4 30m");
      expect(channel?.notes).toBe("LF only");
    });
  });

  describe("list", () => {
    it("should return channels sorted by order", async () => {
      const t = convexTest(schema, modules);
      const projectId = await setupProject(t);

      await t.mutation(api.outputChannels.create, { projectId, busName: "Main L", destination: "PA L" });
      await t.mutation(api.outputChannels.create, { projectId, busName: "Main R", destination: "PA R" });
      await t.mutation(api.outputChannels.create, { projectId, busName: "Sub", destination: "Subs" });

      const channels = await t.query(api.outputChannels.list, { projectId });
      expect(channels).toHaveLength(3);
      expect(channels[0].busName).toBe("Main L");
      expect(channels[1].busName).toBe("Main R");
      expect(channels[2].busName).toBe("Sub");
    });
  });

  describe("update", () => {
    it("should update channel fields", async () => {
      const t = convexTest(schema, modules);
      const projectId = await setupProject(t);

      const channelId = await t.mutation(api.outputChannels.create, {
        projectId,
        busName: "Main L",
        destination: "PA Left",
      });

      await t.mutation(api.outputChannels.update, {
        channelId,
        busName: "Main Left",
        ampProcessor: "Crown",
      });

      const channel = await t.query(api.outputChannels.get, { channelId });
      expect(channel?.busName).toBe("Main Left");
      expect(channel?.ampProcessor).toBe("Crown");
    });
  });

  describe("remove", () => {
    it("should delete a channel", async () => {
      const t = convexTest(schema, modules);
      const projectId = await setupProject(t);

      const channelId = await t.mutation(api.outputChannels.create, {
        projectId,
        busName: "Main",
        destination: "PA",
      });

      await t.mutation(api.outputChannels.remove, { channelId });

      const channel = await t.query(api.outputChannels.get, { channelId });
      expect(channel).toBeNull();
    });
  });

  describe("generateChannelsUpTo", () => {
    it("should generate empty channels up to target count", async () => {
      const t = convexTest(schema, modules);
      const projectId = await setupProject(t);

      const result = await t.mutation(api.outputChannels.generateChannelsUpTo, {
        projectId,
        targetCount: 5,
      });

      expect(result.added).toBe(5);
      expect(result.total).toBe(5);

      const channels = await t.query(api.outputChannels.list, { projectId });
      expect(channels).toHaveLength(5);
    });
  });

  describe("moveChannel", () => {
    it("should swap channel data when moving", async () => {
      const t = convexTest(schema, modules);
      const projectId = await setupProject(t);

      await t.mutation(api.outputChannels.create, { projectId, busName: "Main L", destination: "PA L" });
      const secondId = await t.mutation(api.outputChannels.create, { projectId, busName: "Main R", destination: "PA R" });

      await t.mutation(api.outputChannels.moveChannel, {
        channelId: secondId,
        direction: "up",
      });

      const channels = await t.query(api.outputChannels.list, { projectId });
      expect(channels[0].busName).toBe("Main R");
      expect(channels[1].busName).toBe("Main L");
    });
  });
});
