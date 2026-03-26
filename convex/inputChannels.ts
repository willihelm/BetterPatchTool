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
        .query("inputChannels")
        .withIndex("by_mixer_and_order", (q) => q.eq("mixerId", args.mixerId))
        .collect();
    }
    return await ctx.db
      .query("inputChannels")
      .withIndex("by_project_and_order", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});

export const get = query({
  args: {
    channelId: v.id("inputChannels"),
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
    source: v.string(),
    channelNumber: v.optional(v.number()),
    mixerId: v.optional(v.id("mixers")),
    ioPortId: v.optional(v.id("ioPorts")),
    ioPortIdRight: v.optional(v.id("ioPorts")),
    isStereo: v.optional(v.boolean()),
    sourceRight: v.optional(v.string()),
    uhf: v.optional(v.string()),
    micInputDev: v.optional(v.string()),
    patched: v.optional(v.boolean()),
    location: v.optional(v.string()),
    cable: v.optional(v.string()),
    stand: v.optional(v.string()),
    notes: v.optional(v.string()),
    groupId: v.optional(v.id("groups")),
  },
  handler: async (ctx, args) => {
    const access = await requireProjectRole(ctx, args.projectId, "editor");
    const channels = args.mixerId
      ? await ctx.db
          .query("inputChannels")
          .withIndex("by_mixer_and_order", (q) => q.eq("mixerId", args.mixerId))
          .collect()
      : await ctx.db
          .query("inputChannels")
          .withIndex("by_project_and_order", (q) => q.eq("projectId", args.projectId))
          .collect();

    const maxOrder = channels.length > 0 ? Math.max(...channels.map((channel) => channel.order)) : 0;
    const maxChannel = channels.length > 0 ? Math.max(...channels.map((channel) => channel.channelNumber)) : 0;

    const channelId = await ctx.db.insert("inputChannels", {
      projectId: args.projectId,
      order: maxOrder + 1,
      channelNumber: args.channelNumber ?? maxChannel + 1,
      source: args.source,
      mixerId: args.mixerId,
      ioPortId: args.ioPortId,
      ioPortIdRight: args.ioPortIdRight,
      isStereo: args.isStereo,
      sourceRight: args.sourceRight,
      uhf: args.uhf,
      micInputDev: args.micInputDev,
      patched: args.patched ?? false,
      location: args.location,
      cable: args.cable,
      stand: args.stand,
      notes: args.notes,
      groupId: args.groupId,
    });

    await logProjectActivity(ctx, {
      projectId: args.projectId,
      actorUserId: access.userId!,
      entityType: "input_channel",
      entityId: String(channelId),
      action: "created",
      summary: `Created input channel ${args.source || maxChannel + 1}`,
    });

    return channelId;
  },
});

export const update = mutation({
  args: {
    channelId: v.id("inputChannels"),
    source: v.optional(v.string()),
    channelNumber: v.optional(v.number()),
    mixerId: v.optional(v.id("mixers")),
    ioPortId: v.optional(v.id("ioPorts")),
    ioPortIdRight: v.optional(v.id("ioPorts")),
    isStereo: v.optional(v.boolean()),
    sourceRight: v.optional(v.string()),
    uhf: v.optional(v.string()),
    micInputDev: v.optional(v.string()),
    patched: v.optional(v.boolean()),
    location: v.optional(v.string()),
    cable: v.optional(v.string()),
    stand: v.optional(v.string()),
    notes: v.optional(v.string()),
    groupId: v.optional(v.id("groups")),
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
      entityType: "input_channel",
      entityId: String(channelId),
      action: "updated",
      summary: `Updated input channel ${channel.channelNumber}`,
      metadata: filteredUpdates,
    });
  },
});

export const remove = mutation({
  args: { channelId: v.id("inputChannels") },
  handler: async (ctx, args) => {
    const channel = await ctx.db.get(args.channelId);
    if (!channel) return;
    const access = await requireProjectRole(ctx, channel.projectId, "editor");
    await ctx.db.delete(args.channelId);
    await logProjectActivity(ctx, {
      projectId: channel.projectId,
      actorUserId: access.userId!,
      entityType: "input_channel",
      entityId: String(args.channelId),
      action: "removed",
      summary: `Removed input channel ${channel.channelNumber}`,
    });
  },
});

export const insertMany = mutation({
  args: {
    projectId: v.id("projects"),
    mixerId: v.optional(v.id("mixers")),
    afterOrder: v.number(),
    channels: v.array(v.object({
      source: v.string(),
      uhf: v.optional(v.string()),
      micInputDev: v.optional(v.string()),
      location: v.optional(v.string()),
      cable: v.optional(v.string()),
      stand: v.optional(v.string()),
      notes: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const access = await requireProjectRole(ctx, args.projectId, "editor");
    const existingChannels = args.mixerId
      ? await ctx.db
          .query("inputChannels")
          .withIndex("by_mixer_and_order", (q) => q.eq("mixerId", args.mixerId))
          .collect()
      : await ctx.db
          .query("inputChannels")
          .withIndex("by_project_and_order", (q) => q.eq("projectId", args.projectId))
          .collect();

    const channelsToShift = existingChannels.filter((channel) => channel.order > args.afterOrder);
    const shiftAmount = args.channels.length;

    for (const channel of channelsToShift) {
      await ctx.db.patch(channel._id, {
        order: channel.order + shiftAmount,
        channelNumber: channel.channelNumber + shiftAmount,
      });
    }

    const insertedIds = [];
    for (let i = 0; i < args.channels.length; i++) {
      const channelData = args.channels[i];
      const id = await ctx.db.insert("inputChannels", {
        projectId: args.projectId,
        mixerId: args.mixerId,
        order: args.afterOrder + i + 1,
        channelNumber: args.afterOrder + i + 1,
        source: channelData.source,
        uhf: channelData.uhf,
        micInputDev: channelData.micInputDev,
        patched: false,
        location: channelData.location,
        cable: channelData.cable,
        stand: channelData.stand,
        notes: channelData.notes,
      });
      insertedIds.push(id);
    }

    await logProjectActivity(ctx, {
      projectId: args.projectId,
      actorUserId: access.userId!,
      entityType: "input_channel",
      action: "inserted_many",
      summary: `Inserted ${insertedIds.length} input channels`,
    });

    return insertedIds;
  },
});

export const swapOrder = mutation({
  args: {
    channelId1: v.id("inputChannels"),
    channelId2: v.id("inputChannels"),
  },
  handler: async (ctx, args) => {
    const channel1 = await ctx.db.get(args.channelId1);
    const channel2 = await ctx.db.get(args.channelId2);
    if (!channel1 || !channel2) throw new Error("Channel not found");
    const access = await requireProjectRole(ctx, channel1.projectId, "editor");

    const { _id, _creationTime, projectId, order: order1, channelNumber: ch1, ...data1 } = channel1;
    const { _id: _id2, _creationTime: _creationTime2, projectId: projectId2, order: order2, channelNumber: ch2, ...data2 } = channel2;
    await ctx.db.patch(args.channelId1, data2);
    await ctx.db.patch(args.channelId2, data1);
    await logProjectActivity(ctx, {
      projectId: channel1.projectId,
      actorUserId: access.userId!,
      entityType: "input_channel",
      action: "swapped",
      summary: `Swapped input channels ${channel1.channelNumber} and ${channel2.channelNumber}`,
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
          .query("inputChannels")
          .withIndex("by_mixer_and_order", (q) => q.eq("mixerId", args.mixerId))
          .collect()
      : await ctx.db
          .query("inputChannels")
          .withIndex("by_project_and_order", (q) => q.eq("projectId", args.projectId))
          .collect();

    const currentCount = existingChannels.length;
    if (currentCount >= args.targetCount) {
      return { added: 0, total: currentCount };
    }

    const maxOrder = existingChannels.length > 0 ? Math.max(...existingChannels.map((c) => c.order)) : 0;
    const maxChannelNumber = existingChannels.length > 0 ? Math.max(...existingChannels.map((c) => c.channelNumber)) : 0;

    const channelsToAdd = args.targetCount - currentCount;
    for (let i = 0; i < channelsToAdd; i++) {
      await ctx.db.insert("inputChannels", {
        projectId: args.projectId,
        mixerId: args.mixerId,
        order: maxOrder + i + 1,
        channelNumber: maxChannelNumber + i + 1,
        source: "",
        patched: false,
      });
    }

    return { added: channelsToAdd, total: args.targetCount };
  },
});

export const toggleStereo = mutation({
  args: { channelId: v.id("inputChannels") },
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
        sourceRight: undefined,
      });
    }
    await logProjectActivity(ctx, {
      projectId: channel.projectId,
      actorUserId: access.userId!,
      entityType: "input_channel",
      entityId: String(args.channelId),
      action: "toggled_stereo",
      summary: `Toggled stereo for input channel ${channel.channelNumber}`,
    });
  },
});

export const clearAllPatched = mutation({
  args: {
    projectId: v.id("projects"),
    mixerId: v.optional(v.id("mixers")),
  },
  handler: async (ctx, args) => {
    await requireProjectRole(ctx, args.projectId, "editor");
    const channels = args.mixerId
      ? await ctx.db
          .query("inputChannels")
          .withIndex("by_mixer_and_order", (q) => q.eq("mixerId", args.mixerId))
          .collect()
      : await ctx.db
          .query("inputChannels")
          .withIndex("by_project_and_order", (q) => q.eq("projectId", args.projectId))
          .collect();

    const patchedChannels = channels.filter((channel) => channel.patched);
    for (const channel of patchedChannels) {
      await ctx.db.patch(channel._id, { patched: false });
    }

    return { cleared: patchedChannels.length };
  },
});

export const moveChannel = mutation({
  args: {
    channelId: v.id("inputChannels"),
    direction: v.union(v.literal("up"), v.literal("down")),
  },
  handler: async (ctx, args) => {
    const channel = await ctx.db.get(args.channelId);
    if (!channel) throw new Error("Channel not found");
    const access = await requireProjectRole(ctx, channel.projectId, "editor");

    const allChannels = channel.mixerId
      ? await ctx.db
          .query("inputChannels")
          .withIndex("by_mixer_and_order", (q) => q.eq("mixerId", channel.mixerId))
          .collect()
      : await ctx.db
          .query("inputChannels")
          .withIndex("by_project_and_order", (q) => q.eq("projectId", channel.projectId))
          .collect();
    const currentIndex = allChannels.findIndex((row) => row._id === args.channelId);
    const targetIndex = args.direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= allChannels.length) return;

    const targetChannel = allChannels[targetIndex];
    const { _id, _creationTime, projectId, order, channelNumber, ...currentData } = channel;
    const {
      _id: targetId,
      _creationTime: targetCreationTime,
      projectId: targetProjectId,
      order: targetOrder,
      channelNumber: targetChannelNumber,
      ...targetData
    } = targetChannel;

    await ctx.db.patch(args.channelId, targetData);
    await ctx.db.patch(targetChannel._id, currentData);
    await logProjectActivity(ctx, {
      projectId: channel.projectId,
      actorUserId: access.userId!,
      entityType: "input_channel",
      entityId: String(args.channelId),
      action: "moved",
      summary: `Moved input channel ${channel.channelNumber} ${args.direction}`,
    });
  },
});
