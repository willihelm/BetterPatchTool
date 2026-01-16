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

// Update all port labels when shortName changes
export const updatePortLabels = mutation({
  args: {
    ioDeviceId: v.id("ioDevices"),
    newShortName: v.string(),
  },
  handler: async (ctx, args) => {
    const ioDevice = await ctx.db.get(args.ioDeviceId);
    if (!ioDevice) return;

    const ports = await ctx.db
      .query("ioPorts")
      .withIndex("by_ioDevice", (q) => q.eq("ioDeviceId", args.ioDeviceId))
      .collect();

    for (const port of ports) {
      const typePrefix = port.type === "input" ? "I" : "O";
      const newLabel = `${args.newShortName}-${typePrefix}${port.portNumber}`;
      await ctx.db.patch(port._id, { label: newLabel });
    }
  },
});

// Update port counts (add or remove ports)
export const updatePortCounts = mutation({
  args: {
    ioDeviceId: v.id("ioDevices"),
    newInputCount: v.number(),
    newOutputCount: v.number(),
  },
  handler: async (ctx, args) => {
    const ioDevice = await ctx.db.get(args.ioDeviceId);
    if (!ioDevice) return;

    const ports = await ctx.db
      .query("ioPorts")
      .withIndex("by_ioDevice", (q) => q.eq("ioDeviceId", args.ioDeviceId))
      .collect();

    const inputPorts = ports.filter((p) => p.type === "input").sort((a, b) => a.portNumber - b.portNumber);
    const outputPorts = ports.filter((p) => p.type === "output").sort((a, b) => a.portNumber - b.portNumber);

    // Handle input ports
    if (args.newInputCount > inputPorts.length) {
      // Add new input ports
      for (let i = inputPorts.length + 1; i <= args.newInputCount; i++) {
        await ctx.db.insert("ioPorts", {
          ioDeviceId: args.ioDeviceId,
          type: "input",
          portNumber: i,
          label: `${ioDevice.shortName}-I${i}`,
        });
      }
    } else if (args.newInputCount < inputPorts.length) {
      // Remove excess input ports and clear channel references
      const portsToRemove = inputPorts.filter((p) => p.portNumber > args.newInputCount);
      for (const port of portsToRemove) {
        // Clear references in input channels
        const channels = await ctx.db
          .query("inputChannels")
          .withIndex("by_ioPort", (q) => q.eq("ioPortId", port._id))
          .collect();
        for (const channel of channels) {
          await ctx.db.patch(channel._id, { ioPortId: undefined });
        }
        // Also check ioPortIdRight for stereo
        const stereoChannels = await ctx.db
          .query("inputChannels")
          .filter((q) => q.eq(q.field("ioPortIdRight"), port._id))
          .collect();
        for (const channel of stereoChannels) {
          await ctx.db.patch(channel._id, { ioPortIdRight: undefined });
        }
        await ctx.db.delete(port._id);
      }
    }

    // Handle output ports
    if (args.newOutputCount > outputPorts.length) {
      // Add new output ports
      for (let i = outputPorts.length + 1; i <= args.newOutputCount; i++) {
        await ctx.db.insert("ioPorts", {
          ioDeviceId: args.ioDeviceId,
          type: "output",
          portNumber: i,
          label: `${ioDevice.shortName}-O${i}`,
        });
      }
    } else if (args.newOutputCount < outputPorts.length) {
      // Remove excess output ports and clear channel references
      const portsToRemove = outputPorts.filter((p) => p.portNumber > args.newOutputCount);
      for (const port of portsToRemove) {
        // Clear references in output channels
        const channels = await ctx.db
          .query("outputChannels")
          .withIndex("by_ioPort", (q) => q.eq("ioPortId", port._id))
          .collect();
        for (const channel of channels) {
          await ctx.db.patch(channel._id, { ioPortId: undefined });
        }
        await ctx.db.delete(port._id);
      }
    }

    // Update the device counts
    await ctx.db.patch(args.ioDeviceId, {
      inputCount: args.newInputCount,
      outputCount: args.newOutputCount,
    });
  },
});
