import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

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

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const mixers = await ctx.db
      .query("inventoryMixers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return mixers.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    type: v.optional(v.string()),
    stereoMode: v.union(v.literal("linked_mono"), v.literal("true_stereo")),
    channelCount: v.number(),
    busConfig: busConfigValidator,
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("inventoryMixers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const maxOrder = existing.reduce((max, m) => Math.max(max, m.order ?? 0), 0);

    return await ctx.db.insert("inventoryMixers", {
      userId,
      name: args.name,
      type: args.type,
      stereoMode: args.stereoMode,
      channelCount: args.channelCount,
      busConfig: args.busConfig ?? { auxes: 24 },
      order: maxOrder + 1,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("inventoryMixers"),
    name: v.optional(v.string()),
    type: v.optional(v.string()),
    stereoMode: v.optional(v.union(v.literal("linked_mono"), v.literal("true_stereo"))),
    channelCount: v.optional(v.number()),
    busConfig: busConfigValidator,
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const mixer = await ctx.db.get(args.id);
    if (!mixer || mixer.userId !== userId) throw new Error("Not found");

    const { id, ...updates } = args;
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );
    await ctx.db.patch(id, filtered);
  },
});

export const remove = mutation({
  args: { id: v.id("inventoryMixers") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const mixer = await ctx.db.get(args.id);
    if (!mixer || mixer.userId !== userId) throw new Error("Not found");

    await ctx.db.delete(args.id);
  },
});

export const copyToProject = mutation({
  args: {
    id: v.id("inventoryMixers"),
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const invMixer = await ctx.db.get(args.id);
    if (!invMixer || invMixer.userId !== userId) throw new Error("Not found");

    // Auto-assign next designation letter
    const existingMixers = await ctx.db
      .query("mixers")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const usedDesignations = new Set(existingMixers.map((m) => m.designation));
    let designation = "A";
    for (let i = 0; i < 26; i++) {
      const letter = String.fromCharCode(65 + i);
      if (!usedDesignations.has(letter)) {
        designation = letter;
        break;
      }
    }

    const maxOrder = existingMixers.length > 0
      ? Math.max(...existingMixers.map((m) => m.order ?? 0))
      : -1;

    const mixerId = await ctx.db.insert("mixers", {
      projectId: args.projectId,
      name: invMixer.name,
      type: invMixer.type,
      stereoMode: invMixer.stereoMode,
      channelCount: invMixer.channelCount,
      designation,
      order: maxOrder + 1,
    });

    // Auto-generate empty input channels
    for (let i = 0; i < invMixer.channelCount; i++) {
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
    const config = invMixer.busConfig ?? { auxes: 24 };
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

export const saveFromProject = mutation({
  args: { mixerId: v.id("mixers") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const mixer = await ctx.db.get(args.mixerId);
    if (!mixer) throw new Error("Mixer not found");

    const existing = await ctx.db
      .query("inventoryMixers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const maxOrder = existing.reduce((max, m) => Math.max(max, m.order ?? 0), 0);

    // Count output channels by bus type from project data
    const outputChannels = await ctx.db
      .query("outputChannels")
      .withIndex("by_mixer", (q) => q.eq("mixerId", args.mixerId))
      .collect();
    const busTypeToConfigKey: Record<string, string> = {
      group: "groups", aux: "auxes", fx: "fx",
      matrix: "matrices", master: "masters", cue: "cue",
    };
    const busConfig: Record<string, number> = {};
    for (const ch of outputChannels) {
      const configKey = busTypeToConfigKey[ch.busType ?? "aux"] ?? "auxes";
      busConfig[configKey] = (busConfig[configKey] ?? 0) + 1;
    }

    return await ctx.db.insert("inventoryMixers", {
      userId,
      name: mixer.name,
      type: mixer.type,
      stereoMode: mixer.stereoMode,
      channelCount: mixer.channelCount,
      busConfig: Object.keys(busConfig).length > 0 ? busConfig : { auxes: outputChannels.length || 24 },
      order: maxOrder + 1,
    });
  },
});
