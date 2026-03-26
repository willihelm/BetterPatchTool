import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { generatePorts } from "./_helpers/portGeneration";
import { requireProjectRole } from "./_helpers/projectAccess";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const devices = await ctx.db
      .query("inventoryIODevices")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return devices.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    shortName: v.string(),
    color: v.string(),
    inputCount: v.number(),
    outputCount: v.number(),
    headphoneOutputCount: v.optional(v.number()),
    aesInputCount: v.optional(v.number()),
    aesOutputCount: v.optional(v.number()),
    deviceType: v.optional(v.union(v.literal("stagebox"), v.literal("generic"))),
    portsPerRow: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("inventoryIODevices")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const maxOrder = existing.reduce((max, d) => Math.max(max, d.order ?? 0), 0);

    return await ctx.db.insert("inventoryIODevices", {
      userId,
      name: args.name,
      shortName: args.shortName,
      color: args.color,
      inputCount: args.inputCount,
      outputCount: args.outputCount,
      headphoneOutputCount: args.headphoneOutputCount ?? 0,
      aesInputCount: args.aesInputCount ?? 0,
      aesOutputCount: args.aesOutputCount ?? 0,
      deviceType: args.deviceType ?? "stagebox",
      portsPerRow: args.portsPerRow ?? 12,
      order: maxOrder + 1,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("inventoryIODevices"),
    name: v.optional(v.string()),
    shortName: v.optional(v.string()),
    color: v.optional(v.string()),
    inputCount: v.optional(v.number()),
    outputCount: v.optional(v.number()),
    headphoneOutputCount: v.optional(v.number()),
    aesInputCount: v.optional(v.number()),
    aesOutputCount: v.optional(v.number()),
    deviceType: v.optional(v.union(v.literal("stagebox"), v.literal("generic"))),
    portsPerRow: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const device = await ctx.db.get(args.id);
    if (!device || device.userId !== userId) throw new Error("Not found");

    const { id, ...updates } = args;
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );
    await ctx.db.patch(id, filtered);
  },
});

export const remove = mutation({
  args: { id: v.id("inventoryIODevices") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const device = await ctx.db.get(args.id);
    if (!device || device.userId !== userId) throw new Error("Not found");

    await ctx.db.delete(args.id);
  },
});

export const copyToProject = mutation({
  args: {
    id: v.id("inventoryIODevices"),
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const device = await ctx.db.get(args.id);
    if (!device || device.userId !== userId) throw new Error("Not found");

    // Calculate next order value in project
    const existingDevices = await ctx.db
      .query("ioDevices")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const maxOrder = existingDevices.reduce((max, d) => Math.max(max, d.order ?? 0), 0);

    const ioDeviceId = await ctx.db.insert("ioDevices", {
      projectId: args.projectId,
      name: device.name,
      shortName: device.shortName,
      color: device.color,
      inputCount: device.inputCount,
      outputCount: device.outputCount,
      headphoneOutputCount: device.headphoneOutputCount ?? 0,
      aesInputCount: device.aesInputCount ?? 0,
      aesOutputCount: device.aesOutputCount ?? 0,
      deviceType: device.deviceType ?? "stagebox",
      portsPerRow: device.portsPerRow ?? 12,
      order: maxOrder + 1,
    });

    await generatePorts(ctx, {
      ioDeviceId,
      shortName: device.shortName,
      inputCount: device.inputCount,
      outputCount: device.outputCount,
      headphoneOutputCount: device.headphoneOutputCount ?? 0,
      aesInputCount: device.aesInputCount ?? 0,
      aesOutputCount: device.aesOutputCount ?? 0,
    });

    return ioDeviceId;
  },
});

export const saveFromProject = mutation({
  args: { ioDeviceId: v.id("ioDevices") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const device = await ctx.db.get(args.ioDeviceId);
    if (!device) throw new Error("IO device not found");
    await requireProjectRole(ctx, device.projectId, "viewer");

    const existing = await ctx.db
      .query("inventoryIODevices")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const maxOrder = existing.reduce((max, d) => Math.max(max, d.order ?? 0), 0);

    return await ctx.db.insert("inventoryIODevices", {
      userId,
      name: device.name,
      shortName: device.shortName,
      color: device.color,
      inputCount: device.inputCount,
      outputCount: device.outputCount,
      headphoneOutputCount: device.headphoneOutputCount ?? 0,
      aesInputCount: device.aesInputCount ?? 0,
      aesOutputCount: device.aesOutputCount ?? 0,
      deviceType: device.deviceType ?? "stagebox",
      portsPerRow: device.portsPerRow ?? 12,
      order: maxOrder + 1,
    });
  },
});
