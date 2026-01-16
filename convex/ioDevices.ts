import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get all IO devices for a project
export const list = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("ioDevices")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});

// Get all IO devices with their ports for a project
export const listWithPorts = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const ioDevices = await ctx.db
      .query("ioDevices")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const result = [];
    for (const device of ioDevices) {
      const ports = await ctx.db
        .query("ioPorts")
        .withIndex("by_ioDevice", (q) => q.eq("ioDeviceId", device._id))
        .collect();

      result.push({
        ...device,
        inputPorts: ports
          .filter((p) => p.type === "input")
          .sort((a, b) => a.portNumber - b.portNumber),
        outputPorts: ports
          .filter((p) => p.type === "output")
          .sort((a, b) => a.portNumber - b.portNumber),
      });
    }

    return result;
  },
});

// Get IO device with ports
export const getWithPorts = query({
  args: { ioDeviceId: v.id("ioDevices") },
  handler: async (ctx, args) => {
    const ioDevice = await ctx.db.get(args.ioDeviceId);
    if (!ioDevice) return null;

    const ports = await ctx.db
      .query("ioPorts")
      .withIndex("by_ioDevice", (q) => q.eq("ioDeviceId", args.ioDeviceId))
      .collect();

    return {
      ...ioDevice,
      inputPorts: ports.filter((p) => p.type === "input").sort((a, b) => a.portNumber - b.portNumber),
      outputPorts: ports.filter((p) => p.type === "output").sort((a, b) => a.portNumber - b.portNumber),
    };
  },
});

// Get all ports for a project (for dropdowns)
export const listAllPorts = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const ioDevices = await ctx.db
      .query("ioDevices")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const result = [];
    for (const ioDevice of ioDevices) {
      const ports = await ctx.db
        .query("ioPorts")
        .withIndex("by_ioDevice", (q) => q.eq("ioDeviceId", ioDevice._id))
        .collect();

      for (const port of ports) {
        result.push({
          ...port,
          ioDeviceName: ioDevice.name,
          ioDeviceColor: ioDevice.color,
        });
      }
    }

    return result;
  },
});

// Create IO device (with automatic port generation)
export const create = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.string(),
    shortName: v.string(),
    color: v.string(),
    inputCount: v.number(),
    outputCount: v.number(),
    position: v.optional(v.object({ x: v.number(), y: v.number() })),
    deviceType: v.optional(v.union(v.literal("stagebox"), v.literal("generic"))),
    portsPerRow: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const ioDeviceId = await ctx.db.insert("ioDevices", {
      projectId: args.projectId,
      name: args.name,
      shortName: args.shortName,
      color: args.color,
      inputCount: args.inputCount,
      outputCount: args.outputCount,
      position: args.position,
      deviceType: args.deviceType ?? "stagebox",
      portsPerRow: args.portsPerRow ?? 12,
    });

    // Create input ports
    for (let i = 1; i <= args.inputCount; i++) {
      await ctx.db.insert("ioPorts", {
        ioDeviceId,
        type: "input",
        portNumber: i,
        label: `${args.shortName}-I${i}`,
      });
    }

    // Create output ports
    for (let i = 1; i <= args.outputCount; i++) {
      await ctx.db.insert("ioPorts", {
        ioDeviceId,
        type: "output",
        portNumber: i,
        label: `${args.shortName}-O${i}`,
      });
    }

    return ioDeviceId;
  },
});

// Update IO device
export const update = mutation({
  args: {
    ioDeviceId: v.id("ioDevices"),
    name: v.optional(v.string()),
    shortName: v.optional(v.string()),
    color: v.optional(v.string()),
    position: v.optional(v.object({ x: v.number(), y: v.number() })),
    deviceType: v.optional(v.union(v.literal("stagebox"), v.literal("generic"))),
    portsPerRow: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { ioDeviceId, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );
    await ctx.db.patch(ioDeviceId, filteredUpdates);
  },
});

// Delete IO device (with all ports)
export const remove = mutation({
  args: { ioDeviceId: v.id("ioDevices") },
  handler: async (ctx, args) => {
    // First delete all ports
    const ports = await ctx.db
      .query("ioPorts")
      .withIndex("by_ioDevice", (q) => q.eq("ioDeviceId", args.ioDeviceId))
      .collect();

    for (const port of ports) {
      await ctx.db.delete(port._id);
    }

    // Then delete the IO device
    await ctx.db.delete(args.ioDeviceId);
  },
});

// Update port label
export const updatePortLabel = mutation({
  args: {
    portId: v.id("ioPorts"),
    label: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.portId, { label: args.label });
  },
});
