import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Alle Output-Kanäle eines Projekts abrufen (sortiert)
export const list = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const channels = await ctx.db
      .query("outputChannels")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    return channels.sort((a, b) => a.order - b.order);
  },
});

// Einzelnen Output-Kanal abrufen
export const get = query({
  args: { channelId: v.id("outputChannels") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.channelId);
  },
});

// Neuen Output-Kanal erstellen
export const create = mutation({
  args: {
    projectId: v.id("projects"),
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
    // Höchste Order ermitteln
    const channels = await ctx.db
      .query("outputChannels")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const maxOrder = channels.length > 0
      ? Math.max(...channels.map(c => c.order))
      : 0;

    return await ctx.db.insert("outputChannels", {
      projectId: args.projectId,
      order: maxOrder + 1,
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
  },
});

// Output-Kanal aktualisieren
export const update = mutation({
  args: {
    channelId: v.id("outputChannels"),
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
    const { channelId, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );
    await ctx.db.patch(channelId, filteredUpdates);
  },
});

// Output-Kanal löschen
export const remove = mutation({
  args: { channelId: v.id("outputChannels") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.channelId);
  },
});

// Generate empty output channels up to a target count
export const generateChannelsUpTo = mutation({
  args: {
    projectId: v.id("projects"),
    targetCount: v.number(),
  },
  handler: async (ctx, args) => {
    const existingChannels = await ctx.db
      .query("outputChannels")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const currentCount = existingChannels.length;

    // If we already have enough channels, do nothing
    if (currentCount >= args.targetCount) {
      return { added: 0, total: currentCount };
    }

    // Find max order
    const maxOrder = existingChannels.length > 0
      ? Math.max(...existingChannels.map(c => c.order))
      : 0;

    const channelsToAdd = args.targetCount - currentCount;

    // Insert empty output channels
    for (let i = 0; i < channelsToAdd; i++) {
      await ctx.db.insert("outputChannels", {
        projectId: args.projectId,
        order: maxOrder + i + 1,
        busName: "",
        destination: "",
      });
    }

    return { added: channelsToAdd, total: args.targetCount };
  },
});

// Output-Kanal zwischen Mono und Stereo umschalten
export const toggleStereo = mutation({
  args: { channelId: v.id("outputChannels") },
  handler: async (ctx, args) => {
    const channel = await ctx.db.get(args.channelId);
    if (!channel) throw new Error("Channel not found");

    const newIsStereo = !channel.isStereo;

    // When switching to mono, clear the right fields
    if (newIsStereo) {
      await ctx.db.patch(args.channelId, { isStereo: true });
    } else {
      await ctx.db.patch(args.channelId, {
        isStereo: false,
        ioPortIdRight: undefined,
        destinationRight: undefined,
      });
    }
  },
});

// Output-Kanal verschieben
export const moveChannel = mutation({
  args: {
    channelId: v.id("outputChannels"),
    direction: v.union(v.literal("up"), v.literal("down")),
  },
  handler: async (ctx, args) => {
    const channel = await ctx.db.get(args.channelId);
    if (!channel) throw new Error("Channel not found");

    const allChannels = await ctx.db
      .query("outputChannels")
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
    const { _id: _1, _creationTime: _c1, projectId: _p1, order: _, ...currentData } = channel;
    const { _id: _2, _creationTime: _c2, projectId: _p2, order: __, ...targetData } = targetChannel;

    await ctx.db.patch(args.channelId, targetData);
    await ctx.db.patch(targetChannel._id, currentData);
  },
});
