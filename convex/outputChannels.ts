import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

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

// Alle Output-Kanäle eines Projekts/Mixers abrufen (sortiert)
export const list = query({
  args: {
    projectId: v.id("projects"),
    mixerId: v.optional(v.id("mixers")),
  },
  handler: async (ctx, args) => {
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

    return await ctx.db.insert("outputChannels", {
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
  },
});

// Output-Kanal aktualisieren
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
    mixerId: v.optional(v.id("mixers")),
    targetCount: v.number(),
  },
  handler: async (ctx, args) => {
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
        mixerId: args.mixerId,
        order: maxOrder + i + 1,
        busName: "",
        destination: "",
      });
    }

    return { added: channelsToAdd, total: args.targetCount };
  },
});

// Bus-Konfiguration für einen Mixer anwenden (Gruppen/Aux/FX/Matrix/Master/Cue)
export const applyBusConfigToMixer = mutation({
  args: {
    projectId: v.id("projects"),
    mixerId: v.id("mixers"),
    busConfig: busConfigValidator,
  },
  handler: async (ctx, args) => {
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

    // Sort existing channels by order to get a stable sequence
    const sortedExisting = existingChannels.sort((a, b) => a.order - b.order);

    const overlapCount = Math.min(sortedExisting.length, desiredBusChannels.length);

    // Update existing channels in-place where possible to preserve routing/patch data
    for (let i = 0; i < overlapCount; i++) {
      const existing = sortedExisting[i];
      const desired = desiredBusChannels[i];
      await ctx.db.patch(existing._id, {
        busType: desired.busType,
        busName: desired.busName,
      });
    }

    // Remove surplus channels if the new config has fewer buses
    if (sortedExisting.length > desiredBusChannels.length) {
      for (let i = desiredBusChannels.length; i < sortedExisting.length; i++) {
        await ctx.db.delete(sortedExisting[i]._id);
      }
    }

    // Insert additional channels if the new config has more buses
    if (desiredBusChannels.length > sortedExisting.length) {
      const maxOrder =
        sortedExisting.length > 0
          ? Math.max(...sortedExisting.map((c) => c.order))
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

    const allChannels = channel.mixerId
      ? await ctx.db
          .query("outputChannels")
          .withIndex("by_mixer_and_order", (q) => q.eq("mixerId", channel.mixerId))
          .collect()
      : await ctx.db
          .query("outputChannels")
          .withIndex("by_project_and_order", (q) => q.eq("projectId", channel.projectId))
          .collect();
    const currentIndex = allChannels.findIndex(c => c._id === args.channelId);

    const targetIndex = args.direction === "up"
      ? currentIndex - 1
      : currentIndex + 1;

    if (targetIndex < 0 || targetIndex >= allChannels.length) {
      return; // Am Rand, nichts tun
    }

    const targetChannel = allChannels[targetIndex];

    // Inhalte tauschen (nicht die Position)
    const { _id: _1, _creationTime: _c1, projectId: _p1, order: _, ...currentData } = channel;
    const { _id: _2, _creationTime: _c2, projectId: _p2, order: __, ...targetData } = targetChannel;

    await ctx.db.patch(args.channelId, targetData);
    await ctx.db.patch(targetChannel._id, currentData);
  },
});
