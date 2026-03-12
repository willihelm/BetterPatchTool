/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function setupProject(
  t: ReturnType<typeof convexTest>,
  asUser: ReturnType<ReturnType<typeof convexTest>["withIdentity"]>
) {
  // Create project via authenticated mutation so ownerId matches the auth user
  const projectId = await asUser.mutation(api.projects.create, {
    title: "Snapshot Project",
    channelCount: 1,
    busConfig: { auxes: 1 },
  });

  // Get the mixer that was auto-created
  const mixers = await t.run(async (ctx) => {
    return await ctx.db
      .query("mixers")
      .filter((q) => q.eq(q.field("projectId"), projectId))
      .collect();
  });
  const mixerId = mixers[0]._id;

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

  // Update the auto-created input channel with test data, and add IO device/group refs
  await t.run(async (ctx) => {
    const channel = await ctx.db
      .query("inputChannels")
      .filter((q) => q.eq(q.field("projectId"), projectId))
      .first();
    if (channel) {
      await ctx.db.patch(channel._id, {
        source: "Kick",
        patched: true,
        ioPortId,
        groupId,
      });
    }
    const outChannel = await ctx.db
      .query("outputChannels")
      .filter((q) => q.eq(q.field("projectId"), projectId))
      .first();
    if (outChannel) {
      await ctx.db.patch(outChannel._id, {
        busName: "Mon 1",
        destination: "Drums",
      });
    }
  });

  return { projectId, mixerId };
}

describe("snapshots", () => {
  it("should create a snapshot with payload data", async () => {
    const t = convexTest(schema, modules);
    const asUser = t.withIdentity({ subject: "demo-user", issuer: "convex" });
    const { projectId } = await setupProject(t, asUser);

    const snapshotId = await asUser.mutation(api.snapshots.create, {
      projectId,
      name: "Initial",
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
    const asUser = t.withIdentity({ subject: "demo-user", issuer: "convex" });
    const { projectId } = await setupProject(t, asUser);

    const snapshotId = await asUser.mutation(api.snapshots.create, {
      projectId,
      name: "Before Changes",
    });

    await t.run(async (ctx) => {
      const project = await ctx.db.get(projectId);
      if (project) {
        await ctx.db.patch(projectId, { title: "Modified Project" });
      }
      const channel = await ctx.db
        .query("inputChannels")
        .filter((q) => q.eq(q.field("projectId"), projectId))
        .first();
      if (channel) {
        await ctx.db.patch(channel._id, { source: "Snare" });
      }
    });

    await asUser.mutation(api.snapshots.restore, { snapshotId });

    const restoredProject = await asUser.query(api.projects.get, { projectId });
    expect(restoredProject?.title).toBe("Snapshot Project");

    const channels = await t.query(api.inputChannels.list, { projectId });
    expect(channels).toHaveLength(1);
    expect(channels[0].source).toBe("Kick");
  });

  it("should delete a snapshot and its data", async () => {
    const t = convexTest(schema, modules);
    const asUser = t.withIdentity({ subject: "demo-user", issuer: "convex" });
    const { projectId } = await setupProject(t, asUser);

    const snapshotId = await asUser.mutation(api.snapshots.create, {
      projectId,
      name: "Delete Me",
    });

    await asUser.mutation(api.snapshots.remove, { snapshotId });

    const list = await t.query(api.snapshots.list, { projectId });
    expect(list).toHaveLength(0);

    const result = await t.query(api.snapshots.get, { snapshotId });
    expect(result).toBeNull();
  });
});
