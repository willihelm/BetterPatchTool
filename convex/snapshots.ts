import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { accessTokenValidator, requireProjectAccess, requireProjectRole } from "./_helpers/projectAccess";
import { logProjectActivity } from "./_helpers/projectActivity";

const SNAPSHOT_DATA_VERSION = 1;

type ProjectSnapshotPayload = {
  project: {
    title: string;
    date?: string;
    venue?: string;
  };
  mixers: any[];
  ioDevices: any[];
  ioPorts: any[];
  groups: any[];
  inputChannels: any[];
  outputChannels: any[];
};

export const list = query({
  args: { projectId: v.id("projects"), accessToken: accessTokenValidator },
  handler: async (ctx, args) => {
    await requireProjectAccess(ctx, args.projectId, args.accessToken);
    return await ctx.db
      .query("projectSnapshots")
      .withIndex("by_project_and_createdAt", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .collect();
  },
});

export const get = query({
  args: { snapshotId: v.id("projectSnapshots"), accessToken: accessTokenValidator },
  handler: async (ctx, args) => {
    const snapshot = await ctx.db.get(args.snapshotId);
    if (!snapshot) return null;
    await requireProjectAccess(ctx, snapshot.projectId, args.accessToken);
    const data = await ctx.db
      .query("projectSnapshotData")
      .withIndex("by_snapshot", (q) => q.eq("snapshotId", args.snapshotId))
      .first();
    if (!data) return null;

    return {
      snapshot,
      payload: JSON.parse(data.blob) as ProjectSnapshotPayload,
    };
  },
});

export const create = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await requireProjectRole(ctx, args.projectId, "editor");
    const project = access.project;

    const mixers = await ctx.db
      .query("mixers")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const ioDevices = await ctx.db
      .query("ioDevices")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const ioPortsArrays = await Promise.all(
      ioDevices.map((device) =>
        ctx.db.query("ioPorts").withIndex("by_ioDevice", (q) => q.eq("ioDeviceId", device._id)).collect()
      )
    );
    const groups = await ctx.db
      .query("groups")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const inputChannels = await ctx.db
      .query("inputChannels")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const outputChannels = await ctx.db
      .query("outputChannels")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const snapshotId = await ctx.db.insert("projectSnapshots", {
      projectId: args.projectId,
      createdBy: access.userId!,
      createdAt: Date.now(),
      name: args.name,
      note: args.note,
      dataVersion: SNAPSHOT_DATA_VERSION,
    });

    await ctx.db.insert("projectSnapshotData", {
      snapshotId,
      blob: JSON.stringify({
        project: { title: project.title, date: project.date, venue: project.venue },
        mixers,
        ioDevices,
        ioPorts: ioPortsArrays.flat(),
        groups,
        inputChannels,
        outputChannels,
      } satisfies ProjectSnapshotPayload),
      compression: "none",
    });

    await logProjectActivity(ctx, {
      projectId: args.projectId,
      actorUserId: access.userId!,
      entityType: "snapshot",
      entityId: String(snapshotId),
      action: "created",
      summary: `Created savepoint "${args.name}"`,
    });

    return snapshotId;
  },
});

export const remove = mutation({
  args: { snapshotId: v.id("projectSnapshots") },
  handler: async (ctx, args) => {
    const snapshot = await ctx.db.get(args.snapshotId);
    if (!snapshot) throw new Error("Snapshot not found");
    const access = await requireProjectRole(ctx, snapshot.projectId, "editor");

    const data = await ctx.db
      .query("projectSnapshotData")
      .withIndex("by_snapshot", (q) => q.eq("snapshotId", args.snapshotId))
      .collect();

    for (const entry of data) {
      await ctx.db.delete(entry._id);
    }
    await ctx.db.delete(args.snapshotId);
    await logProjectActivity(ctx, {
      projectId: snapshot.projectId,
      actorUserId: access.userId!,
      entityType: "snapshot",
      entityId: String(args.snapshotId),
      action: "removed",
      summary: `Removed savepoint "${snapshot.name}"`,
    });
  },
});

export const restore = mutation({
  args: { snapshotId: v.id("projectSnapshots") },
  handler: async (ctx, args) => {
    const snapshot = await ctx.db.get(args.snapshotId);
    if (!snapshot) throw new Error("Snapshot not found");
    const access = await requireProjectRole(ctx, snapshot.projectId, "editor");

    const data = await ctx.db
      .query("projectSnapshotData")
      .withIndex("by_snapshot", (q) => q.eq("snapshotId", args.snapshotId))
      .first();
    if (!data) throw new Error("Snapshot data not found");

    const payload = JSON.parse(data.blob) as ProjectSnapshotPayload;
    const projectId = snapshot.projectId;

    const inputChannels = await ctx.db
      .query("inputChannels")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
    for (const channel of inputChannels) await ctx.db.delete(channel._id);

    const outputChannels = await ctx.db
      .query("outputChannels")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
    for (const channel of outputChannels) await ctx.db.delete(channel._id);

    const groups = await ctx.db
      .query("groups")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
    for (const group of groups) await ctx.db.delete(group._id);

    const mixers = await ctx.db
      .query("mixers")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
    for (const mixer of mixers) await ctx.db.delete(mixer._id);

    const ioDevices = await ctx.db
      .query("ioDevices")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
    for (const device of ioDevices) {
      const ports = await ctx.db
        .query("ioPorts")
        .withIndex("by_ioDevice", (q) => q.eq("ioDeviceId", device._id))
        .collect();
      for (const port of ports) await ctx.db.delete(port._id);
      await ctx.db.delete(device._id);
    }

    const mixerMap = new Map<string, string>();
    for (const mixer of payload.mixers) {
      const { _id, _creationTime, projectId: _, ...mixerData } = mixer;
      const newId = await ctx.db.insert("mixers", { ...mixerData, projectId });
      mixerMap.set(_id, newId);
    }

    const ioDeviceMap = new Map<string, string>();
    const ioPortMap = new Map<string, string>();
    for (const device of payload.ioDevices) {
      const { _id, _creationTime, projectId: _, ...deviceData } = device;
      const newId = await ctx.db.insert("ioDevices", { ...deviceData, projectId });
      ioDeviceMap.set(_id, newId);
    }

    for (const port of payload.ioPorts) {
      const { _id, _creationTime, ioDeviceId, ...portData } = port;
      const newPortId = await ctx.db.insert("ioPorts", {
        ...portData,
        ioDeviceId: ioDeviceMap.get(ioDeviceId) as any,
      });
      ioPortMap.set(_id, newPortId);
    }

    const groupMap = new Map<string, string>();
    for (const group of payload.groups) {
      const { _id, _creationTime, projectId: _, ...groupData } = group;
      const newId = await ctx.db.insert("groups", { ...groupData, projectId });
      groupMap.set(_id, newId);
    }

    for (const channel of payload.inputChannels) {
      const { _id, _creationTime, projectId: _, mixerId, ioPortId, ioPortIdRight, groupId, ...channelData } = channel;
      await ctx.db.insert("inputChannels", {
        ...channelData,
        projectId,
        mixerId: mixerId ? (mixerMap.get(mixerId) as any) : undefined,
        ioPortId: ioPortId ? (ioPortMap.get(ioPortId) as any) : undefined,
        ioPortIdRight: ioPortIdRight ? (ioPortMap.get(ioPortIdRight) as any) : undefined,
        groupId: groupId ? (groupMap.get(groupId) as any) : undefined,
      });
    }

    for (const channel of payload.outputChannels) {
      const { _id, _creationTime, projectId: _, mixerId, ioPortId, ioPortIdRight, ...channelData } = channel;
      await ctx.db.insert("outputChannels", {
        ...channelData,
        projectId,
        mixerId: mixerId ? (mixerMap.get(mixerId) as any) : undefined,
        ioPortId: ioPortId ? (ioPortMap.get(ioPortId) as any) : undefined,
        ioPortIdRight: ioPortIdRight ? (ioPortMap.get(ioPortIdRight) as any) : undefined,
      });
    }

    await ctx.db.patch(projectId, {
      title: payload.project.title,
      date: payload.project.date,
      venue: payload.project.venue,
    });

    await logProjectActivity(ctx, {
      projectId,
      actorUserId: access.userId!,
      entityType: "snapshot",
      entityId: String(args.snapshotId),
      action: "restored",
      summary: `Restored savepoint "${snapshot.name}"`,
    });
  },
});
