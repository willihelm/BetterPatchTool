/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function setupProject(t: ReturnType<typeof convexTest>) {
  const projectId = await t.run(async (ctx) => {
    return await ctx.db.insert("projects", {
      title: "Snapshot Project",
      ownerId: "demo-user",
      collaborators: [],
      isArchived: false,
    });
  });

  const mixerId = await t.run(async (ctx) => {
    return await ctx.db.insert("mixers", {
      projectId,
      name: "FOH",
      stereoMode: "linked_mono",
      channelCount: 8,
      designation: "A",
    });
  });

  const groupId = await t.run(async (ctx) => {
    return await ctx.db.insert("groups", {
      projectId,
      name: "Drums",
      color: "#ff0000",
      order: 1,
    });
  });

  const ioDeviceId = await t.run(async (ctx) => {
    return await ctx.db.insert("ioDevices", {
      projectId,
      name: "IOX-D",
      shortName: "IOX-D",
      color: "#90EE90",
      inputCount: 2,
      outputCount: 1,
      order: 1,
    });
  });

  const ioPortId = await t.run(async (ctx) => {
    return await ctx.db.insert("ioPorts", {
      ioDeviceId,
      type: "input",
      portNumber: 1,
      label: "IOX-D-I1",
    });
  });

  await t.run(async (ctx) => {
    await ctx.db.insert("inputChannels", {
      projectId,
      order: 1,
      channelNumber: 1,
      mixerId,
      ioPortId,
      source: "Kick",
      patched: true,
      groupId,
    });
    await ctx.db.insert("outputChannels", {
      projectId,
      order: 1,
      busName: "Mon 1",
      destination: "Drums",
    });
  });

  return { projectId, mixerId };
}

describe("snapshots", () => {
  it("should create a snapshot with payload data", async () => {
    const t = convexTest(schema, modules);
    const { projectId } = await setupProject(t);

    const snapshotId = await t.mutation(api.snapshots.create, {
      projectId,
      name: "Initial",
      createdBy: "demo-user",
    });

    const list = await t.query(api.snapshots.list, { projectId });
    expect(list).toHaveLength(1);
    expect(list[0]._id).toBe(snapshotId);

    const result = await t.query(api.snapshots.get, { snapshotId });
    expect(result).not.toBeNull();
    expect(result?.payload.project.title).toBe("Snapshot Project");
    expect(result?.payload.inputChannels).toHaveLength(1);
    expect(result?.payload.outputChannels).toHaveLength(1);
  });

  it("should restore project data from a snapshot", async () => {
    const t = convexTest(schema, modules);
    const { projectId } = await setupProject(t);

    const snapshotId = await t.mutation(api.snapshots.create, {
      projectId,
      name: "Before Changes",
      createdBy: "demo-user",
    });

    await t.run(async (ctx) => {
      const project = await ctx.db.get(projectId);
      if (project) {
        await ctx.db.patch(projectId, { title: "Modified Project" });
      }
      const channel = await ctx.db
        .query("inputChannels")
        .withIndex("by_project", (q) => q.eq("projectId", projectId))
        .first();
      if (channel) {
        await ctx.db.patch(channel._id, { source: "Snare" });
      }
    });

    await t.mutation(api.snapshots.restore, { snapshotId });

    const restoredProject = await t.query(api.projects.get, { projectId });
    expect(restoredProject?.title).toBe("Snapshot Project");

    const channels = await t.query(api.inputChannels.list, { projectId });
    expect(channels).toHaveLength(1);
    expect(channels[0].source).toBe("Kick");
  });

  it("should delete a snapshot and its data", async () => {
    const t = convexTest(schema, modules);
    const { projectId } = await setupProject(t);

    const snapshotId = await t.mutation(api.snapshots.create, {
      projectId,
      name: "Delete Me",
      createdBy: "demo-user",
    });

    await t.mutation(api.snapshots.remove, { snapshotId });

    const list = await t.query(api.snapshots.list, { projectId });
    expect(list).toHaveLength(0);

    const result = await t.query(api.snapshots.get, { snapshotId });
    expect(result).toBeNull();
  });
});
