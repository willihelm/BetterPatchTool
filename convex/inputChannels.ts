import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Alle Input-Kanäle eines Projekts abrufen (sortiert)
export const list = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const channels = await ctx.db
      .query("inputChannels")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    return channels.sort((a, b) => a.order - b.order);
  },
});

// Einzelnen Kanal abrufen
export const get = query({
  args: { channelId: v.id("inputChannels") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.channelId);
  },
});

// Neuen Kanal erstellen
export const create = mutation({
  args: {
    projectId: v.id("projects"),
    source: v.string(),
    channelNumber: v.optional(v.number()),
    mixerId: v.optional(v.id("mixers")),
    ioPortId: v.optional(v.id("ioPorts")),
    ioPortIdRight: v.optional(v.id("ioPorts")),
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
    // Höchste Order ermitteln
    const channels = await ctx.db
      .query("inputChannels")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const maxOrder = channels.length > 0
      ? Math.max(...channels.map(c => c.order))
      : 0;

    const maxChannel = channels.length > 0
      ? Math.max(...channels.map(c => c.channelNumber))
      : 0;

    return await ctx.db.insert("inputChannels", {
      projectId: args.projectId,
      order: maxOrder + 1,
      channelNumber: args.channelNumber ?? maxChannel + 1,
      source: args.source,
      mixerId: args.mixerId,
      ioPortId: args.ioPortId,
      ioPortIdRight: args.ioPortIdRight,
      uhf: args.uhf,
      micInputDev: args.micInputDev,
      patched: args.patched ?? false,
      location: args.location,
      cable: args.cable,
      stand: args.stand,
      notes: args.notes,
      groupId: args.groupId,
    });
  },
});

// Kanal aktualisieren
export const update = mutation({
  args: {
    channelId: v.id("inputChannels"),
    source: v.optional(v.string()),
    channelNumber: v.optional(v.number()),
    mixerId: v.optional(v.id("mixers")),
    ioPortId: v.optional(v.id("ioPorts")),
    ioPortIdRight: v.optional(v.id("ioPorts")),
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
    const { channelId, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );
    await ctx.db.patch(channelId, filteredUpdates);
  },
});

// Kanal löschen
export const remove = mutation({
  args: { channelId: v.id("inputChannels") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.channelId);
  },
});

// Mehrere Kanäle auf einmal einfügen (für Block-Presets)
export const insertMany = mutation({
  args: {
    projectId: v.id("projects"),
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
    // Bestehende Kanäle nach unten verschieben
    const existingChannels = await ctx.db
      .query("inputChannels")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const channelsToShift = existingChannels.filter(c => c.order > args.afterOrder);
    const shiftAmount = args.channels.length;

    // Order und channelNumber der bestehenden Kanäle erhöhen
    for (const channel of channelsToShift) {
      await ctx.db.patch(channel._id, {
        order: channel.order + shiftAmount,
        channelNumber: channel.channelNumber + shiftAmount,
      });
    }

    // Neue Kanäle einfügen
    const insertedIds = [];
    for (let i = 0; i < args.channels.length; i++) {
      const channelData = args.channels[i];
      const id = await ctx.db.insert("inputChannels", {
        projectId: args.projectId,
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

    return insertedIds;
  },
});

// Kanäle neu ordnen (Swap)
export const swapOrder = mutation({
  args: {
    channelId1: v.id("inputChannels"),
    channelId2: v.id("inputChannels"),
  },
  handler: async (ctx, args) => {
    const channel1 = await ctx.db.get(args.channelId1);
    const channel2 = await ctx.db.get(args.channelId2);

    if (!channel1 || !channel2) {
      throw new Error("Channel not found");
    }

    // Alle Daten außer channelNumber und order tauschen
    const { _id: _1, _creationTime: _c1, projectId: _p1, order: order1, channelNumber: ch1, ...data1 } = channel1;
    const { _id: _2, _creationTime: _c2, projectId: _p2, order: order2, channelNumber: ch2, ...data2 } = channel2;

    await ctx.db.patch(args.channelId1, data2);
    await ctx.db.patch(args.channelId2, data1);
  },
});

// Generate empty channels up to a target count
export const generateChannelsUpTo = mutation({
  args: {
    projectId: v.id("projects"),
    targetCount: v.number(),
  },
  handler: async (ctx, args) => {
    const existingChannels = await ctx.db
      .query("inputChannels")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const currentCount = existingChannels.length;

    // If we already have enough channels, do nothing
    if (currentCount >= args.targetCount) {
      return { added: 0, total: currentCount };
    }

    // Find max order and channelNumber
    const maxOrder = existingChannels.length > 0
      ? Math.max(...existingChannels.map(c => c.order))
      : 0;
    const maxChannelNumber = existingChannels.length > 0
      ? Math.max(...existingChannels.map(c => c.channelNumber))
      : 0;

    const channelsToAdd = args.targetCount - currentCount;

    // Insert empty channels
    for (let i = 0; i < channelsToAdd; i++) {
      await ctx.db.insert("inputChannels", {
        projectId: args.projectId,
        order: maxOrder + i + 1,
        channelNumber: maxChannelNumber + i + 1,
        source: "",
        patched: false,
      });
    }

    return { added: channelsToAdd, total: args.targetCount };
  },
});

// Kanal nach oben/unten verschieben
export const moveChannel = mutation({
  args: {
    channelId: v.id("inputChannels"),
    direction: v.union(v.literal("up"), v.literal("down")),
  },
  handler: async (ctx, args) => {
    const channel = await ctx.db.get(args.channelId);
    if (!channel) throw new Error("Channel not found");

    const allChannels = await ctx.db
      .query("inputChannels")
      .withIndex("by_project", (q) => q.eq("projectId", channel.projectId))
      .collect();

    const sorted = allChannels.sort((a, b) => a.order - b.order);
    const currentIndex = sorted.findIndex(c => c._id === args.channelId);

    const targetIndex = args.direction === "up"
      ? currentIndex - 1
      : currentIndex + 1;

    if (targetIndex < 0 || targetIndex >= sorted.length) {
      return; // Am Rand, nichts tun
    }

    const targetChannel = sorted[targetIndex];

    // Inhalte tauschen (nicht die Position)
    const { _id: _1, _creationTime: _c1, projectId: _p1, order: _, channelNumber: __, ...currentData } = channel;
    const { _id: _2, _creationTime: _c2, projectId: _p2, order: ___, channelNumber: ____, ...targetData } = targetChannel;

    await ctx.db.patch(args.channelId, targetData);
    await ctx.db.patch(targetChannel._id, currentData);
  },
});
