import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Channel definition for presets
const channelDefinition = v.object({
  source: v.string(),
  uhf: v.optional(v.string()),
  micInputDev: v.optional(v.string()),
  location: v.optional(v.string()),
  cable: v.optional(v.string()),
  stand: v.optional(v.string()),
  notes: v.optional(v.string()),
});

// Get all presets for a user (including public and system presets)
export const list = query({
  args: { userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const publicPresetsPromise = ctx.db
      .query("blockPresets")
      .withIndex("by_public", (q) => q.eq("isPublic", true))
      .collect();

    const userPresetsPromise = args.userId
      ? ctx.db
          .query("blockPresets")
          .withIndex("by_user", (q) => q.eq("userId", args.userId))
          .collect()
      : Promise.resolve([]);

    const [publicPresets, userPresets] = await Promise.all([
      publicPresetsPromise,
      userPresetsPromise,
    ]);

    const combined = new Map(publicPresets.map((preset) => [preset._id, preset]));
    for (const preset of userPresets) {
      combined.set(preset._id, preset);
    }

    return Array.from(combined.values());
  },
});

// Get preset
export const get = query({
  args: { presetId: v.id("blockPresets") },
  handler: async (ctx, args) => {
    const preset = await ctx.db.get(args.presetId);
    if (!preset) return null;

    return {
      ...preset,
      channels: JSON.parse(preset.channels),
    };
  },
});

// Create preset
export const create = mutation({
  args: {
    userId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    isPublic: v.boolean(),
    channels: v.array(channelDefinition),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("blockPresets", {
      userId: args.userId,
      name: args.name,
      description: args.description,
      isPublic: args.isPublic,
      channels: JSON.stringify(args.channels),
    });
  },
});

// Update preset
export const update = mutation({
  args: {
    presetId: v.id("blockPresets"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    isPublic: v.optional(v.boolean()),
    channels: v.optional(v.array(channelDefinition)),
  },
  handler: async (ctx, args) => {
    const { presetId, channels, ...updates } = args;
    const filteredUpdates: Record<string, unknown> = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    if (channels) {
      filteredUpdates.channels = JSON.stringify(channels);
    }

    await ctx.db.patch(presetId, filteredUpdates);
  },
});

// Delete preset
export const remove = mutation({
  args: { presetId: v.id("blockPresets") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.presetId);
  },
});

// Create preset from selected channels
export const createFromChannels = mutation({
  args: {
    userId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    channelIds: v.array(v.id("inputChannels")),
  },
  handler: async (ctx, args) => {
    const existingChannels = await Promise.all(
      args.channelIds.map((channelId) => ctx.db.get(channelId))
    );

    const channels = existingChannels
      .filter((channel): channel is NonNullable<typeof channel> => channel !== null)
      .map((channel) => ({
        source: channel.source,
        uhf: channel.uhf,
        micInputDev: channel.micInputDev,
        location: channel.location,
        cable: channel.cable,
        stand: channel.stand,
        notes: channel.notes,
      }));

    return await ctx.db.insert("blockPresets", {
      userId: args.userId,
      name: args.name,
      description: args.description,
      isPublic: false,
      channels: JSON.stringify(channels),
    });
  },
});

// Initialize system presets (call once)
export const initSystemPresets = mutation({
  args: {},
  handler: async (ctx) => {
    // Check if system presets already exist
    const existing = await ctx.db
      .query("blockPresets")
      .withIndex("by_user", (q) => q.eq("userId", undefined))
      .first();

    if (existing) return "System presets already exist";

    const systemPresets = [
      {
        name: "Drums 5-Piece",
        description: "Standard drum kit with kick, snare, hi-hat, 2 toms, overheads",
        channels: [
          { source: "Kick", micInputDev: "Beta 52", location: "Drums" },
          { source: "Snare Top", micInputDev: "SM57", location: "Drums" },
          { source: "Snare Btm", micInputDev: "SM57", location: "Drums" },
          { source: "Hi-Hat", micInputDev: "KM184", location: "Drums" },
          { source: "Tom 1", micInputDev: "e604", location: "Drums" },
          { source: "Tom 2", micInputDev: "e604", location: "Drums" },
          { source: "OH L", micInputDev: "C414", location: "Drums" },
          { source: "OH R", micInputDev: "C414", location: "Drums" },
        ],
      },
      {
        name: "Bass DI+Amp",
        description: "Bass with DI and amp mic",
        channels: [
          { source: "Bass DI", micInputDev: "DI Box", location: "Bass" },
          { source: "Bass Amp", micInputDev: "RE20", location: "Bass" },
        ],
      },
      {
        name: "Acoustic Guitar Stereo",
        description: "Acoustic guitar with pickup and mic",
        channels: [
          { source: "A-Git DI", micInputDev: "DI Box", location: "Guitar" },
          { source: "A-Git Mic", micInputDev: "KM184", location: "Guitar" },
        ],
      },
      {
        name: "Electric Guitar Stereo",
        description: "Electric guitar with 2 amps",
        channels: [
          { source: "E-Git L", micInputDev: "SM57", location: "Guitar" },
          { source: "E-Git R", micInputDev: "SM57", location: "Guitar" },
        ],
      },
      {
        name: "Keys Stereo",
        description: "Keyboard Stereo",
        channels: [
          { source: "Keys L", micInputDev: "DI Box", location: "Keys" },
          { source: "Keys R", micInputDev: "DI Box", location: "Keys" },
        ],
      },
      {
        name: "Vocal + Spare",
        description: "Lead vocal with spare mic",
        channels: [
          { source: "Lead Voc", micInputDev: "SM58", uhf: "SLXD" },
          { source: "Spare Voc", micInputDev: "SM58" },
        ],
      },
      {
        name: "Brass Section 4x",
        description: "4-piece brass section",
        channels: [
          { source: "Trumpet 1", micInputDev: "SM57", location: "Brass" },
          { source: "Trumpet 2", micInputDev: "SM57", location: "Brass" },
          { source: "Trombone", micInputDev: "SM57", location: "Brass" },
          { source: "Sax", micInputDev: "SM57", location: "Brass" },
        ],
      },
    ];

    for (const preset of systemPresets) {
      await ctx.db.insert("blockPresets", {
        userId: undefined,
        name: preset.name,
        description: preset.description,
        isPublic: true,
        channels: JSON.stringify(preset.channels),
      });
    }

    return "System presets created";
  },
});
