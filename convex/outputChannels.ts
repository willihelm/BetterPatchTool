import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  accessTokenValidator,
  getProjectAccessForRequest,
  requireProjectAccess,
  requireProjectRole,
  shouldGracefullyHandleTokenAccessLoss,
} from "./_helpers/projectAccess";
import { logProjectActivity } from "./_helpers/projectActivity";

type BusType = "group" | "aux" | "fx" | "matrix" | "master" | "cue";

interface BusConfig {
  groups?: number;
  auxes?: number;
  fx?: number;
  matrices?: number;
  masters?: number;
  cue?: number;
}

const busConfigValidator = v.optional(
  v.object({
    groups: v.optional(v.number()),
    auxes: v.optional(v.number()),
    fx: v.optional(v.number()),
    matrices: v.optional(v.number()),
    masters: v.optional(v.number()),
    cue: v.optional(v.number()),
  })
);

const BUS_ENTRIES: Array<{ key: keyof BusConfig; busType: BusType; label: string }> = [
  { key: "groups", busType: "group", label: "Grp" },
  { key: "auxes", busType: "aux", label: "Aux" },
  { key: "fx", busType: "fx", label: "FX" },
  { key: "matrices", busType: "matrix", label: "Mtx" },
  { key: "masters", busType: "master", label: "Master" },
  { key: "cue", busType: "cue", label: "Cue" },
];

function generateBusChannelList(busConfig: BusConfig): Array<{ busType: BusType; busName: string }> {
  const channels: Array<{ busType: BusType; busName: string }> = [];
  for (const { key, busType, label } of BUS_ENTRIES) {
    const count = busConfig[key] ?? 0;
    if (count <= 0) continue;
    for (let i = 1; i <= count; i++) {
      const busName =
        count === 1 && (busType === "master" || busType === "cue") ? label : `${label} ${i}`;
      channels.push({ busType, busName });
    }
  }
  return channels;
}

export const list = query({
  args: {
    projectId: v.id("projects"),
    mixerId: v.optional(v.id("mixers")),
    accessToken: accessTokenValidator,
  },
  handler: async (ctx, args) => {
    const access = await getProjectAccessForRequest(ctx, args.projectId, args.accessToken);
    if (!access) {
      if (shouldGracefullyHandleTokenAccessLoss(args.accessToken)) {
        return [];
      }
      throw new Error("Not authorized");
    }
    if (args.mixerId) {
      return await ctx.db
        .query("outputChannels")
        .withIndex("by_mixer_and_order", (q) => q.eq("mixerId", args.mixerId))
        .collect();
    }
    return await ctx.db
      .query("outputChannels")
      .withIndex("by_project_and_order", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});

export const get = query({
  args: {
    channelId: v.id("outputChannels"),
    accessToken: accessTokenValidator,
  },
  handler: async (ctx, args) => {
    const channel = await ctx.db.get(args.channelId);
    if (!channel) return null;
    await requireProjectAccess(ctx, channel.projectId, args.accessToken);
    return channel;
  },
});

export const create = mutation({
  args: {
    projectId: v.id("projects"),
    busType: v.optional(v.union(
      v.literal("group"), v.literal("aux"), v.literal("fx"),
      v.literal("matrix"), v.literal("master"), v.literal("cue")
    )),
    busName: v.string(),
    destination: v.string(),
    mixerId: v.optional(v.id("mixers")),
    ioPortId: v.optional(v.id("ioPorts")),
    ioPortIdRight: v.optional(v.id("ioPorts")),
    isStereo: v.optional(v.boolean()),
    destinationRight: v.optional(v.string()),
    ampProcessor: v.optional(v.string()),
    location: v.optional(v.string()),
    cable: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await requireProjectRole(ctx, args.projectId, "editor");
    const latestChannel = args.mixerId
      ? await ctx.db
          .query("outputChannels")
          .withIndex("by_mixer_and_order", (q) => q.eq("mixerId", args.mixerId))
          .order("desc")
          .first()
      : await ctx.db
          .query("outputChannels")
          .withIndex("by_project_and_order", (q) => q.eq("projectId", args.projectId))
          .order("desc")
          .first();

    const maxOrder = latestChannel?.order ?? 0;
    const channelId = await ctx.db.insert("outputChannels", {
      projectId: args.projectId,
      order: maxOrder + 1,
      busType: args.busType,
      busName: args.busName,
      destination: args.destination,
      mixerId: args.mixerId,
      ioPortId: args.ioPortId,
      ioPortIdRight: args.ioPortIdRight,
      isStereo: args.isStereo,
      destinationRight: args.destinationRight,
      ampProcessor: args.ampProcessor,
      location: args.location,
      cable: args.cable,
      notes: args.notes,
    });
    await logProjectActivity(ctx, {
      projectId: args.projectId,
      actorUserId: access.userId!,
      entityType: "output_channel",
      entityId: String(channelId),
      action: "created",
      summary: `Created output channel ${args.busName}`,
    });
    return channelId;
  },
});

export const update = mutation({
  args: {
    channelId: v.id("outputChannels"),
    busType: v.optional(v.union(
      v.literal("group"), v.literal("aux"), v.literal("fx"),
      v.literal("matrix"), v.literal("master"), v.literal("cue")
    )),
    busName: v.optional(v.string()),
    destination: v.optional(v.string()),
    mixerId: v.optional(v.id("mixers")),
    ioPortId: v.optional(v.id("ioPorts")),
    ioPortIdRight: v.optional(v.id("ioPorts")),
    isStereo: v.optional(v.boolean()),
    destinationRight: v.optional(v.string()),
    ampProcessor: v.optional(v.string()),
    location: v.optional(v.string()),
    cable: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const channel = await ctx.db.get(args.channelId);
    if (!channel) throw new Error("Channel not found");
    const access = await requireProjectRole(ctx, channel.projectId, "editor");
    const { channelId, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, value]) => value !== undefined)
    );
    await ctx.db.patch(channelId, filteredUpdates);
    await logProjectActivity(ctx, {
      projectId: channel.projectId,
      actorUserId: access.userId!,
      entityType: "output_channel",
      entityId: String(channelId),
      action: "updated",
      summary: `Updated output channel ${channel.busName || channel.order}`,
      metadata: filteredUpdates,
    });
  },
});

export const remove = mutation({
  args: { channelId: v.id("outputChannels") },
  handler: async (ctx, args) => {
    const channel = await ctx.db.get(args.channelId);
    if (!channel) return;
    const access = await requireProjectRole(ctx, channel.projectId, "editor");
    await ctx.db.delete(args.channelId);
    await logProjectActivity(ctx, {
      projectId: channel.projectId,
      actorUserId: access.userId!,
      entityType: "output_channel",
      entityId: String(args.channelId),
      action: "removed",
      summary: `Removed output channel ${channel.busName || channel.order}`,
    });
  },
});

export const generateChannelsUpTo = mutation({
  args: {
    projectId: v.id("projects"),
    mixerId: v.optional(v.id("mixers")),
    targetCount: v.number(),
  },
  handler: async (ctx, args) => {
    await requireProjectRole(ctx, args.projectId, "editor");
    const existingChannels = args.mixerId
      ? await ctx.db
          .query("outputChannels")
          .withIndex("by_mixer_and_order", (q) => q.eq("mixerId", args.mixerId))
          .collect()
      : await ctx.db
          .query("outputChannels")
          .withIndex("by_project_and_order", (q) => q.eq("projectId", args.projectId))
          .collect();

    const currentCount = existingChannels.length;
    if (currentCount >= args.targetCount) {
      return { added: 0, total: currentCount };
    }

    const maxOrder = existingChannels.length > 0
      ? Math.max(...existingChannels.map((channel) => channel.order))
      : 0;

    const channelsToAdd = args.targetCount - currentCount;
    for (let i = 0; i < channelsToAdd; i++) {
      await ctx.db.insert("outputChannels", {
        projectId: args.projectId,
        mixerId: args.mixerId,
        order: maxOrder + i + 1,
        busName: "",
        destination: "",
      });
    }

    return { added: channelsToAdd, total: args.targetCount };
  },
});

export const applyBusConfigToMixer = mutation({
  args: {
    projectId: v.id("projects"),
    mixerId: v.id("mixers"),
    busConfig: busConfigValidator,
  },
  handler: async (ctx, args) => {
    const access = await requireProjectRole(ctx, args.projectId, "editor");
    const mixer = await ctx.db.get(args.mixerId);
    if (!mixer || mixer.projectId !== args.projectId) {
      throw new Error("Mixer not found");
    }

    const effectiveConfig: BusConfig = args.busConfig ?? { auxes: 24 };
    const desiredBusChannels = generateBusChannelList(effectiveConfig);

    const existingChannels = await ctx.db
      .query("outputChannels")
      .withIndex("by_mixer_and_order", (q) => q.eq("mixerId", args.mixerId))
      .collect();

    const sortedExisting = existingChannels.sort((a, b) => a.order - b.order);
    const overlapCount = Math.min(sortedExisting.length, desiredBusChannels.length);

    for (let i = 0; i < overlapCount; i++) {
      const existing = sortedExisting[i];
      const desired = desiredBusChannels[i];
      await ctx.db.patch(existing._id, {
        busType: desired.busType,
        busName: desired.busName,
      });
    }

    if (sortedExisting.length > desiredBusChannels.length) {
      for (let i = desiredBusChannels.length; i < sortedExisting.length; i++) {
        await ctx.db.delete(sortedExisting[i]._id);
      }
    }

    if (desiredBusChannels.length > sortedExisting.length) {
      const maxOrder = sortedExisting.length > 0
        ? Math.max(...sortedExisting.map((channel) => channel.order))
        : 0;

      for (let i = sortedExisting.length; i < desiredBusChannels.length; i++) {
        const desired = desiredBusChannels[i];
        await ctx.db.insert("outputChannels", {
          projectId: args.projectId,
          mixerId: args.mixerId,
          order: maxOrder + (i - sortedExisting.length) + 1,
          busType: desired.busType,
          busName: desired.busName,
          destination: "",
        });
      }
    }

    await logProjectActivity(ctx, {
      projectId: args.projectId,
      actorUserId: access.userId!,
      entityType: "output_channel",
      action: "applied_bus_config",
      summary: `Applied bus config to mixer ${mixer.name}`,
    });
  },
});

export const toggleStereo = mutation({
  args: { channelId: v.id("outputChannels") },
  handler: async (ctx, args) => {
    const channel = await ctx.db.get(args.channelId);
    if (!channel) throw new Error("Channel not found");
    const access = await requireProjectRole(ctx, channel.projectId, "editor");
    const newIsStereo = !channel.isStereo;
    if (newIsStereo) {
      await ctx.db.patch(args.channelId, { isStereo: true });
    } else {
      await ctx.db.patch(args.channelId, {
        isStereo: false,
        ioPortIdRight: undefined,
        destinationRight: undefined,
      });
    }
    await logProjectActivity(ctx, {
      projectId: channel.projectId,
      actorUserId: access.userId!,
      entityType: "output_channel",
      entityId: String(args.channelId),
      action: "toggled_stereo",
      summary: `Toggled stereo for output channel ${channel.busName || channel.order}`,
    });
  },
});

export const moveChannel = mutation({
  args: {
    channelId: v.id("outputChannels"),
    direction: v.union(v.literal("up"), v.literal("down")),
  },
  handler: async (ctx, args) => {
    const channel = await ctx.db.get(args.channelId);
    if (!channel) throw new Error("Channel not found");
    const access = await requireProjectRole(ctx, channel.projectId, "editor");

    const allChannels = channel.mixerId
      ? await ctx.db
          .query("outputChannels")
          .withIndex("by_mixer_and_order", (q) => q.eq("mixerId", channel.mixerId))
          .collect()
      : await ctx.db
          .query("outputChannels")
          .withIndex("by_project_and_order", (q) => q.eq("projectId", channel.projectId))
          .collect();
    const currentIndex = allChannels.findIndex((row) => row._id === args.channelId);
    const targetIndex = args.direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= allChannels.length) return;

    const targetChannel = allChannels[targetIndex];
    const { _id, _creationTime, projectId, order, ...currentData } = channel;
    const { _id: targetId, _creationTime: targetCreatedAt, projectId: targetProjectId, order: targetOrder, ...targetData } = targetChannel;
    await ctx.db.patch(args.channelId, targetData);
    await ctx.db.patch(targetChannel._id, currentData);
    await logProjectActivity(ctx, {
      projectId: channel.projectId,
      actorUserId: access.userId!,
      entityType: "output_channel",
      entityId: String(args.channelId),
      action: "moved",
      summary: `Moved output channel ${channel.busName || channel.order} ${args.direction}`,
    });
  },
});
