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
    const mixers = await ctx.db
      .query("mixers")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    return mixers.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  },
});

export const get = query({
  args: {
    mixerId: v.id("mixers"),
    accessToken: accessTokenValidator,
  },
  handler: async (ctx, args) => {
    const mixer = await ctx.db.get(args.mixerId);
    if (!mixer) return null;
    await requireProjectAccess(ctx, mixer.projectId, args.accessToken);
    return mixer;
  },
});

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
    const access = await requireProjectRole(ctx, args.projectId, "editor");
    const existingMixers = await ctx.db
      .query("mixers")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const maxOrder = existingMixers.length > 0 ? Math.max(...existingMixers.map((m) => m.order ?? 0)) : -1;

    const mixerId = await ctx.db.insert("mixers", {
      projectId: args.projectId,
      name: args.name,
      type: args.type,
      stereoMode: args.stereoMode,
      channelCount: args.channelCount,
      designation: args.designation,
      order: maxOrder + 1,
    });

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

    await logProjectActivity(ctx, {
      projectId: args.projectId,
      actorUserId: access.userId!,
      entityType: "mixer",
      entityId: String(mixerId),
      action: "created",
      summary: `Created mixer "${args.name}"`,
    });

    return mixerId;
  },
});

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
    const mixer = await ctx.db.get(args.mixerId);
    if (!mixer) throw new Error("Mixer not found");
    const access = await requireProjectRole(ctx, mixer.projectId, "editor");
    const { mixerId, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, value]) => value !== undefined)
    );
    await ctx.db.patch(mixerId, filteredUpdates);
    await logProjectActivity(ctx, {
      projectId: mixer.projectId,
      actorUserId: access.userId!,
      entityType: "mixer",
      entityId: String(mixerId),
      action: "updated",
      summary: `Updated mixer "${mixer.name}"`,
      metadata: filteredUpdates,
    });
  },
});

export const remove = mutation({
  args: { mixerId: v.id("mixers") },
  handler: async (ctx, args) => {
    const mixer = await ctx.db.get(args.mixerId);
    if (!mixer) throw new Error("Mixer not found");
    const access = await requireProjectRole(ctx, mixer.projectId, "editor");

    const allMixers = await ctx.db
      .query("mixers")
      .withIndex("by_project", (q) => q.eq("projectId", mixer.projectId))
      .collect();
    if (allMixers.length <= 1) {
      throw new Error("Cannot delete the last mixer");
    }

    const inputChannels = await ctx.db
      .query("inputChannels")
      .withIndex("by_mixer", (q) => q.eq("mixerId", args.mixerId))
      .collect();
    for (const channel of inputChannels) {
      await ctx.db.delete(channel._id);
    }

    const outputChannels = await ctx.db
      .query("outputChannels")
      .withIndex("by_mixer", (q) => q.eq("mixerId", args.mixerId))
      .collect();
    for (const channel of outputChannels) {
      await ctx.db.delete(channel._id);
    }

    await ctx.db.delete(args.mixerId);
    await logProjectActivity(ctx, {
      projectId: mixer.projectId,
      actorUserId: access.userId!,
      entityType: "mixer",
      entityId: String(args.mixerId),
      action: "removed",
      summary: `Removed mixer "${mixer.name}"`,
    });
  },
});

export const reorderMixers = mutation({
  args: {
    mixerIds: v.array(v.id("mixers")),
  },
  handler: async (ctx, args) => {
    const firstMixer = args.mixerIds.length > 0 ? await ctx.db.get(args.mixerIds[0]) : null;
    if (!firstMixer) return;
    await requireProjectRole(ctx, firstMixer.projectId, "editor");
    for (let i = 0; i < args.mixerIds.length; i++) {
      await ctx.db.patch(args.mixerIds[i], { order: i });
    }
  },
});
