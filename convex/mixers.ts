import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const busTypeValidator = v.union(
  v.literal("group"), v.literal("aux"), v.literal("fx"),
  v.literal("matrix"), v.literal("master"), v.literal("cue")
);

const busConfigValidator = v.optional(v.object({
  groups: v.optional(v.number()),
  auxes: v.optional(v.number()),
  fx: v.optional(v.number()),
  matrices: v.optional(v.number()),
  masters: v.optional(v.number()),
  cue: v.optional(v.number()),
}));

type BusType = "group" | "aux" | "fx" | "matrix" | "master" | "cue";

interface BusConfig {
  groups?: number; auxes?: number; fx?: number;
  matrices?: number; masters?: number; cue?: number;
}

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
      const busName = count === 1 && (busType === "master" || busType === "cue") ? label : `${label} ${i}`;
      channels.push({ busType, busName });
    }
  }
  return channels;
}

// Get all mixers for a project (sorted by order)
export const list = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const mixers = await ctx.db
      .query("mixers")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    return mixers.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  },
});

// Get mixer
export const get = query({
  args: { mixerId: v.id("mixers") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.mixerId);
  },
});

// Create mixer with auto-generated channels
export const create = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.string(),
    type: v.optional(v.string()),
    stereoMode: v.union(v.literal("linked_mono"), v.literal("true_stereo")),
    channelCount: v.number(),
    busConfig: busConfigValidator,
    designation: v.string(),
  },
  handler: async (ctx, args) => {
    // Auto-assign next order value
    const existingMixers = await ctx.db
      .query("mixers")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const maxOrder = existingMixers.length > 0
      ? Math.max(...existingMixers.map(m => m.order ?? 0))
      : -1;

    const mixerId = await ctx.db.insert("mixers", {
      projectId: args.projectId,
      name: args.name,
      type: args.type,
      stereoMode: args.stereoMode,
      channelCount: args.channelCount,
      designation: args.designation,
      order: maxOrder + 1,
    });

    // Auto-generate empty input channels
    for (let i = 0; i < args.channelCount; i++) {
      await ctx.db.insert("inputChannels", {
        projectId: args.projectId,
        mixerId,
        order: i + 1,
        channelNumber: i + 1,
        source: "",
        patched: false,
      });
    }

    // Auto-generate output channels with bus types and pre-filled names
    const config = args.busConfig ?? { auxes: 24 };
    const busChannels = generateBusChannelList(config);
    for (let i = 0; i < busChannels.length; i++) {
      await ctx.db.insert("outputChannels", {
        projectId: args.projectId,
        mixerId,
        order: i + 1,
        busType: busChannels[i].busType,
        busName: busChannels[i].busName,
        destination: "",
      });
    }

    return mixerId;
  },
});

// Update mixer
export const update = mutation({
  args: {
    mixerId: v.id("mixers"),
    name: v.optional(v.string()),
    type: v.optional(v.string()),
    stereoMode: v.optional(v.union(v.literal("linked_mono"), v.literal("true_stereo"))),
    channelCount: v.optional(v.number()),
    designation: v.optional(v.string()),
    order: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { mixerId, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );
    await ctx.db.patch(mixerId, filteredUpdates);
  },
});

// Delete mixer (cascade delete channels, prevent deleting last mixer)
export const remove = mutation({
  args: { mixerId: v.id("mixers") },
  handler: async (ctx, args) => {
    const mixer = await ctx.db.get(args.mixerId);
    if (!mixer) throw new Error("Mixer not found");

    // Prevent deleting the last mixer
    const allMixers = await ctx.db
      .query("mixers")
      .withIndex("by_project", (q) => q.eq("projectId", mixer.projectId))
      .collect();
    if (allMixers.length <= 1) {
      throw new Error("Cannot delete the last mixer");
    }

    // Cascade delete input channels
    const inputChannels = await ctx.db
      .query("inputChannels")
      .withIndex("by_mixer", (q) => q.eq("mixerId", args.mixerId))
      .collect();
    for (const channel of inputChannels) {
      await ctx.db.delete(channel._id);
    }

    // Cascade delete output channels
    const outputChannels = await ctx.db
      .query("outputChannels")
      .withIndex("by_mixer", (q) => q.eq("mixerId", args.mixerId))
      .collect();
    for (const channel of outputChannels) {
      await ctx.db.delete(channel._id);
    }

    await ctx.db.delete(args.mixerId);
  },
});

// Reorder mixers
export const reorderMixers = mutation({
  args: {
    mixerIds: v.array(v.id("mixers")),
  },
  handler: async (ctx, args) => {
    for (let i = 0; i < args.mixerIds.length; i++) {
      await ctx.db.patch(args.mixerIds[i], { order: i });
    }
  },
});
