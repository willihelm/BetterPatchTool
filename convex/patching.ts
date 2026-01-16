import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// Get port usage map for a project - shows which channel each port is assigned to
export const getPortUsageMap = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const inputChannels = await ctx.db
      .query("inputChannels")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const outputChannels = await ctx.db
      .query("outputChannels")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const usageMap: Record<
      string,
      {
        channelType: "input" | "output";
        channelId: string;
        channelName: string;
        channelNumber: number;
      }
    > = {};

    // Map input channel port assignments
    for (const channel of inputChannels) {
      if (channel.ioPortId) {
        usageMap[channel.ioPortId] = {
          channelType: "input",
          channelId: channel._id,
          channelName: channel.source || `Ch ${channel.channelNumber}`,
          channelNumber: channel.channelNumber,
        };
      }
      if (channel.ioPortIdRight) {
        usageMap[channel.ioPortIdRight] = {
          channelType: "input",
          channelId: channel._id,
          channelName: channel.source || `Ch ${channel.channelNumber}`,
          channelNumber: channel.channelNumber,
        };
      }
    }

    // Map output channel port assignments
    for (const channel of outputChannels) {
      if (channel.ioPortId) {
        usageMap[channel.ioPortId] = {
          channelType: "output",
          channelId: channel._id,
          channelName: channel.busName || channel.destination || `Output ${channel.order}`,
          channelNumber: channel.order,
        };
      }
    }

    return usageMap;
  },
});

// Get available ports grouped by IO device with usage info
export const getAvailablePorts = query({
  args: {
    projectId: v.id("projects"),
    portType: v.union(v.literal("input"), v.literal("output")),
  },
  handler: async (ctx, args) => {
    // Get all IO devices
    const ioDevices = await ctx.db
      .query("ioDevices")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    // Get port usage map
    const inputChannels = await ctx.db
      .query("inputChannels")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const outputChannels = await ctx.db
      .query("outputChannels")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const usedPorts = new Set<string>();

    for (const channel of inputChannels) {
      if (channel.ioPortId) usedPorts.add(channel.ioPortId);
      if (channel.ioPortIdRight) usedPorts.add(channel.ioPortIdRight);
    }

    for (const channel of outputChannels) {
      if (channel.ioPortId) usedPorts.add(channel.ioPortId);
    }

    // Build grouped result
    const result = [];

    for (const device of ioDevices) {
      const ports = await ctx.db
        .query("ioPorts")
        .withIndex("by_ioDevice_and_type", (q) =>
          q.eq("ioDeviceId", device._id).eq("type", args.portType)
        )
        .collect();

      const sortedPorts = ports.sort((a, b) => a.portNumber - b.portNumber);

      result.push({
        device: {
          _id: device._id,
          name: device.name,
          shortName: device.shortName,
          color: device.color,
        },
        ports: sortedPorts.map((port) => ({
          ...port,
          isUsed: usedPorts.has(port._id),
        })),
      });
    }

    return result;
  },
});

// Assign port to input channel
export const patchInputChannel = mutation({
  args: {
    channelId: v.id("inputChannels"),
    ioPortId: v.union(v.id("ioPorts"), v.null()),
    ioPortIdRight: v.optional(v.union(v.id("ioPorts"), v.null())),
  },
  handler: async (ctx, args) => {
    const channel = await ctx.db.get(args.channelId);
    if (!channel) throw new Error("Channel not found");

    // Validate port type if assigning (should be input port)
    if (args.ioPortId) {
      const port = await ctx.db.get(args.ioPortId);
      if (!port) throw new Error("Port not found");
      if (port.type !== "input") throw new Error("Cannot assign output port to input channel");
    }

    if (args.ioPortIdRight) {
      const portRight = await ctx.db.get(args.ioPortIdRight);
      if (!portRight) throw new Error("Right port not found");
      if (portRight.type !== "input") throw new Error("Cannot assign output port to input channel");
    }

    const updates: { ioPortId?: Id<"ioPorts"> | undefined; ioPortIdRight?: Id<"ioPorts"> | undefined; patched?: boolean } = {};

    // Handle left/mono port
    if (args.ioPortId === null) {
      updates.ioPortId = undefined;
    } else if (args.ioPortId) {
      updates.ioPortId = args.ioPortId;
    }

    // Handle right port (for stereo)
    if (args.ioPortIdRight === null) {
      updates.ioPortIdRight = undefined;
    } else if (args.ioPortIdRight !== undefined) {
      updates.ioPortIdRight = args.ioPortIdRight;
    }

    // Update patched status based on whether any port is assigned
    const newIoPortId = args.ioPortId === null ? undefined : (args.ioPortId ?? channel.ioPortId);
    updates.patched = newIoPortId !== undefined;

    await ctx.db.patch(args.channelId, updates);
  },
});

// Assign port to output channel
export const patchOutputChannel = mutation({
  args: {
    channelId: v.id("outputChannels"),
    ioPortId: v.union(v.id("ioPorts"), v.null()),
  },
  handler: async (ctx, args) => {
    const channel = await ctx.db.get(args.channelId);
    if (!channel) throw new Error("Channel not found");

    // Validate port type if assigning (should be output port)
    if (args.ioPortId) {
      const port = await ctx.db.get(args.ioPortId);
      if (!port) throw new Error("Port not found");
      if (port.type !== "output") throw new Error("Cannot assign input port to output channel");
    }

    if (args.ioPortId === null) {
      await ctx.db.patch(args.channelId, { ioPortId: undefined });
    } else {
      await ctx.db.patch(args.channelId, { ioPortId: args.ioPortId });
    }
  },
});

// Sequential auto-patch for input channels
export const autoPatchInputChannels = mutation({
  args: {
    channelIds: v.array(v.id("inputChannels")),
    startPortId: v.id("ioPorts"),
    skipAssigned: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const startPort = await ctx.db.get(args.startPortId);
    if (!startPort) throw new Error("Start port not found");
    if (startPort.type !== "input") throw new Error("Start port must be an input port");

    // Get the IO device
    const ioDevice = await ctx.db.get(startPort.ioDeviceId);
    if (!ioDevice) throw new Error("IO device not found");

    // Get all input ports from this device, sorted by port number
    const devicePorts = await ctx.db
      .query("ioPorts")
      .withIndex("by_ioDevice_and_type", (q) =>
        q.eq("ioDeviceId", startPort.ioDeviceId).eq("type", "input")
      )
      .collect();

    const sortedPorts = devicePorts
      .sort((a, b) => a.portNumber - b.portNumber)
      .filter((p) => p.portNumber >= startPort.portNumber);

    // Get channels to patch, maintaining order
    const channels = [];
    for (const channelId of args.channelIds) {
      const channel = await ctx.db.get(channelId);
      if (channel) channels.push(channel);
    }

    // Get currently used ports if we need to skip assigned
    let usedPorts = new Set<string>();
    if (args.skipAssigned) {
      const allInputChannels = await ctx.db
        .query("inputChannels")
        .withIndex("by_project", (q) => q.eq("projectId", ioDevice.projectId))
        .collect();

      for (const ch of allInputChannels) {
        if (ch.ioPortId) usedPorts.add(ch.ioPortId);
        if (ch.ioPortIdRight) usedPorts.add(ch.ioPortIdRight);
      }
    }

    // Assign ports sequentially
    let portIndex = 0;
    let assigned = 0;
    let skipped = 0;

    for (const channel of channels) {
      // Find next available port
      while (portIndex < sortedPorts.length) {
        const port = sortedPorts[portIndex];
        if (!args.skipAssigned || !usedPorts.has(port._id)) {
          break;
        }
        portIndex++;
        skipped++;
      }

      if (portIndex >= sortedPorts.length) {
        break; // No more ports available
      }

      const port = sortedPorts[portIndex];
      await ctx.db.patch(channel._id, {
        ioPortId: port._id,
        patched: true,
      });

      usedPorts.add(port._id);
      portIndex++;
      assigned++;
    }

    return {
      assigned,
      skipped,
      total: args.channelIds.length,
    };
  },
});

// Sequential auto-patch for output channels
export const autoPatchOutputChannels = mutation({
  args: {
    channelIds: v.array(v.id("outputChannels")),
    startPortId: v.id("ioPorts"),
    skipAssigned: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const startPort = await ctx.db.get(args.startPortId);
    if (!startPort) throw new Error("Start port not found");
    if (startPort.type !== "output") throw new Error("Start port must be an output port");

    // Get the IO device
    const ioDevice = await ctx.db.get(startPort.ioDeviceId);
    if (!ioDevice) throw new Error("IO device not found");

    // Get all output ports from this device, sorted by port number
    const devicePorts = await ctx.db
      .query("ioPorts")
      .withIndex("by_ioDevice_and_type", (q) =>
        q.eq("ioDeviceId", startPort.ioDeviceId).eq("type", "output")
      )
      .collect();

    const sortedPorts = devicePorts
      .sort((a, b) => a.portNumber - b.portNumber)
      .filter((p) => p.portNumber >= startPort.portNumber);

    // Get channels to patch
    const channels = [];
    for (const channelId of args.channelIds) {
      const channel = await ctx.db.get(channelId);
      if (channel) channels.push(channel);
    }

    // Get currently used ports if we need to skip assigned
    let usedPorts = new Set<string>();
    if (args.skipAssigned) {
      const allOutputChannels = await ctx.db
        .query("outputChannels")
        .withIndex("by_project", (q) => q.eq("projectId", ioDevice.projectId))
        .collect();

      for (const ch of allOutputChannels) {
        if (ch.ioPortId) usedPorts.add(ch.ioPortId);
      }
    }

    // Assign ports sequentially
    let portIndex = 0;
    let assigned = 0;
    let skipped = 0;

    for (const channel of channels) {
      // Find next available port
      while (portIndex < sortedPorts.length) {
        const port = sortedPorts[portIndex];
        if (!args.skipAssigned || !usedPorts.has(port._id)) {
          break;
        }
        portIndex++;
        skipped++;
      }

      if (portIndex >= sortedPorts.length) {
        break; // No more ports available
      }

      const port = sortedPorts[portIndex];
      await ctx.db.patch(channel._id, { ioPortId: port._id });

      usedPorts.add(port._id);
      portIndex++;
      assigned++;
    }

    return {
      assigned,
      skipped,
      total: args.channelIds.length,
    };
  },
});

// Clear patches from selected channels
export const clearPatches = mutation({
  args: {
    inputChannelIds: v.optional(v.array(v.id("inputChannels"))),
    outputChannelIds: v.optional(v.array(v.id("outputChannels"))),
  },
  handler: async (ctx, args) => {
    let cleared = 0;

    if (args.inputChannelIds) {
      for (const channelId of args.inputChannelIds) {
        await ctx.db.patch(channelId, {
          ioPortId: undefined,
          ioPortIdRight: undefined,
          patched: false,
        });
        cleared++;
      }
    }

    if (args.outputChannelIds) {
      for (const channelId of args.outputChannelIds) {
        await ctx.db.patch(channelId, { ioPortId: undefined });
        cleared++;
      }
    }

    return { cleared };
  },
});
