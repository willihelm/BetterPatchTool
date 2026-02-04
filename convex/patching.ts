import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// Combined query that returns all patching data in a single call
// This reduces the number of DB queries and avoids fetching the same data multiple times
export const getAllPatchingData = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    // Fetch all data in parallel to minimize latency
    const [ioDevicesUnsorted, inputChannels, outputChannels] = await Promise.all([
      ctx.db
        .query("ioDevices")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .collect(),
      ctx.db
        .query("inputChannels")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .collect(),
      ctx.db
        .query("outputChannels")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .collect(),
    ]);

    // Sort ioDevices by order field
    const ioDevices = ioDevicesUnsorted.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    // Build used ports set for marking usage
    const usedPorts = new Set<string>();
    for (const channel of inputChannels) {
      if (channel.ioPortId) usedPorts.add(channel.ioPortId);
      if (channel.ioPortIdRight) usedPorts.add(channel.ioPortIdRight);
    }
    for (const channel of outputChannels) {
      if (channel.ioPortId) usedPorts.add(channel.ioPortId);
    }

    // Build port usage map - stores array of channels per port
    const portUsageMap: Record<
      string,
      Array<{
        channelType: "input" | "output";
        channelId: string;
        channelName: string;
        channelNumber: number;
        stereoSide?: "L" | "R";
      }>
    > = {};

    for (const channel of inputChannels) {
      const channelName = channel.source?.trim() || "";
      const baseEntry = {
        channelType: "input" as const,
        channelId: channel._id,
        channelName: channelName || `Ch ${channel.channelNumber}`,
        channelNumber: channel.channelNumber,
      };

      if (channel.ioPortId) {
        if (!portUsageMap[channel.ioPortId]) {
          portUsageMap[channel.ioPortId] = [];
        }
        portUsageMap[channel.ioPortId].push({
          ...baseEntry,
          stereoSide: channel.ioPortIdRight ? "L" : undefined,
        });
      }
      if (channel.ioPortIdRight) {
        if (!portUsageMap[channel.ioPortIdRight]) {
          portUsageMap[channel.ioPortIdRight] = [];
        }
        portUsageMap[channel.ioPortIdRight].push({
          ...baseEntry,
          stereoSide: "R",
        });
      }
    }

    for (const channel of outputChannels) {
      const channelName = channel.busName?.trim() || channel.destination?.trim() || "";
      const baseEntry = {
        channelType: "output" as const,
        channelId: channel._id,
        channelName: channelName || `Output ${channel.order}`,
        channelNumber: channel.order,
      };

      if (channel.ioPortId) {
        if (!portUsageMap[channel.ioPortId]) {
          portUsageMap[channel.ioPortId] = [];
        }
        portUsageMap[channel.ioPortId].push({
          ...baseEntry,
          stereoSide: channel.ioPortIdRight ? "L" : undefined,
        });
      }
      if (channel.ioPortIdRight) {
        if (!portUsageMap[channel.ioPortIdRight]) {
          portUsageMap[channel.ioPortIdRight] = [];
        }
        portUsageMap[channel.ioPortIdRight].push({
          ...baseEntry,
          stereoSide: "R",
        });
      }
    }

    // Fetch ALL ports for all devices in ONE query batch
    const allPorts = await Promise.all(
      ioDevices.map((device) =>
        ctx.db
          .query("ioPorts")
          .withIndex("by_ioDevice", (q) => q.eq("ioDeviceId", device._id))
          .collect()
      )
    );

    // Build port info lookup map (portId -> {label, deviceColor, deviceName})
    // This is a lightweight map for displaying current port assignments
    const portInfoMap: Record<string, { label: string; deviceColor: string; deviceName: string }> = {};

    // Build grouped port data for input and output dropdowns
    const inputPortGroups: Array<{
      device: { _id: string; name: string; shortName: string; color: string };
      ports: Array<{ _id: string; label: string; portNumber: number; isUsed: boolean; subType?: string }>;
    }> = [];

    const outputPortGroups: Array<{
      device: { _id: string; name: string; shortName: string; color: string };
      ports: Array<{ _id: string; label: string; portNumber: number; isUsed: boolean; subType?: string }>;
    }> = [];

    ioDevices.forEach((device, index) => {
      const ports = allPorts[index];

      // Sort ports: regular first, then headphones, then AES (by portNumber within each group)
      const sortPorts = (portsToSort: typeof ports) => {
        return [...portsToSort].sort((a, b) => {
          const aIsHeadphone = a.subType === "headphone_left" || a.subType === "headphone_right";
          const bIsHeadphone = b.subType === "headphone_left" || b.subType === "headphone_right";
          const aIsAes = a.subType === "aes_left" || a.subType === "aes_right";
          const bIsAes = b.subType === "aes_left" || b.subType === "aes_right";
          const aIsRegular = !aIsHeadphone && !aIsAes;
          const bIsRegular = !bIsHeadphone && !bIsAes;

          if (aIsRegular && !bIsRegular) return -1;
          if (!aIsRegular && bIsRegular) return 1;
          if (aIsHeadphone && bIsAes) return -1;
          if (aIsAes && bIsHeadphone) return 1;

          return a.portNumber - b.portNumber;
        });
      };

      const inputPorts = ports.filter((p) => p.type === "input");
      const outputPorts = ports.filter((p) => p.type === "output");

      // Add to portInfoMap
      for (const port of ports) {
        portInfoMap[port._id] = {
          label: port.label,
          deviceColor: device.color,
          deviceName: device.shortName,
        };
      }

      const deviceInfo = {
        _id: device._id,
        name: device.name,
        shortName: device.shortName,
        color: device.color,
      };

      if (inputPorts.length > 0) {
        inputPortGroups.push({
          device: deviceInfo,
          ports: sortPorts(inputPorts).map((port) => ({
            _id: port._id,
            label: port.label,
            portNumber: port.portNumber,
            isUsed: usedPorts.has(port._id),
            subType: port.subType,
          })),
        });
      }

      if (outputPorts.length > 0) {
        outputPortGroups.push({
          device: deviceInfo,
          ports: sortPorts(outputPorts).map((port) => ({
            _id: port._id,
            label: port.label,
            portNumber: port.portNumber,
            isUsed: usedPorts.has(port._id),
            subType: port.subType,
          })),
        });
      }
    });

    return {
      portInfoMap,
      portUsageMap,
      inputPortGroups,
      outputPortGroups,
    };
  },
});

// Get port usage map for a project - shows which channels each port is assigned to
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
      Array<{
        channelType: "input" | "output";
        channelId: string;
        channelName: string;
        channelNumber: number;
        stereoSide?: "L" | "R";
      }>
    > = {};

    // Map input channel port assignments
    for (const channel of inputChannels) {
      const channelName = channel.source?.trim() || "";
      const baseEntry = {
        channelType: "input" as const,
        channelId: channel._id,
        channelName: channelName || `Ch ${channel.channelNumber}`,
        channelNumber: channel.channelNumber,
      };

      if (channel.ioPortId) {
        if (!usageMap[channel.ioPortId]) {
          usageMap[channel.ioPortId] = [];
        }
        usageMap[channel.ioPortId].push({
          ...baseEntry,
          stereoSide: channel.ioPortIdRight ? "L" : undefined,
        });
      }
      if (channel.ioPortIdRight) {
        if (!usageMap[channel.ioPortIdRight]) {
          usageMap[channel.ioPortIdRight] = [];
        }
        usageMap[channel.ioPortIdRight].push({
          ...baseEntry,
          stereoSide: "R",
        });
      }
    }

    // Map output channel port assignments
    for (const channel of outputChannels) {
      const channelName = channel.busName?.trim() || channel.destination?.trim() || "";
      const baseEntry = {
        channelType: "output" as const,
        channelId: channel._id,
        channelName: channelName || `Output ${channel.order}`,
        channelNumber: channel.order,
      };

      if (channel.ioPortId) {
        if (!usageMap[channel.ioPortId]) {
          usageMap[channel.ioPortId] = [];
        }
        usageMap[channel.ioPortId].push({
          ...baseEntry,
          stereoSide: channel.ioPortIdRight ? "L" : undefined,
        });
      }
      if (channel.ioPortIdRight) {
        if (!usageMap[channel.ioPortIdRight]) {
          usageMap[channel.ioPortIdRight] = [];
        }
        usageMap[channel.ioPortIdRight].push({
          ...baseEntry,
          stereoSide: "R",
        });
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
    // Fetch all data in parallel to avoid sequential queries
    const [ioDevicesUnsorted, inputChannels, outputChannels] = await Promise.all([
      ctx.db
        .query("ioDevices")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .collect(),
      ctx.db
        .query("inputChannels")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .collect(),
      ctx.db
        .query("outputChannels")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .collect(),
    ]);

    // Sort ioDevices by order field
    const ioDevices = ioDevicesUnsorted.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    // Build used ports set
    const usedPorts = new Set<string>();
    for (const channel of inputChannels) {
      if (channel.ioPortId) usedPorts.add(channel.ioPortId);
      if (channel.ioPortIdRight) usedPorts.add(channel.ioPortIdRight);
    }
    for (const channel of outputChannels) {
      if (channel.ioPortId) usedPorts.add(channel.ioPortId);
    }

    // Fetch ALL ports for all devices in ONE query, then filter/group in JS
    const allPorts = await Promise.all(
      ioDevices.map((device) =>
        ctx.db
          .query("ioPorts")
          .withIndex("by_ioDevice_and_type", (q) =>
            q.eq("ioDeviceId", device._id).eq("type", args.portType)
          )
          .collect()
      )
    );

    // Build grouped result
    const result = ioDevices.map((device, index) => {
      const ports = allPorts[index];

      // Sort ports: regular first, then headphones, then AES (by portNumber within each group)
      const sortedPorts = ports.sort((a, b) => {
        const aIsHeadphone = a.subType === "headphone_left" || a.subType === "headphone_right";
        const bIsHeadphone = b.subType === "headphone_left" || b.subType === "headphone_right";
        const aIsAes = a.subType === "aes_left" || a.subType === "aes_right";
        const bIsAes = b.subType === "aes_left" || b.subType === "aes_right";
        const aIsRegular = !aIsHeadphone && !aIsAes;
        const bIsRegular = !bIsHeadphone && !bIsAes;

        // Regular first, then headphones, then AES
        if (aIsRegular && !bIsRegular) return -1;
        if (!aIsRegular && bIsRegular) return 1;
        if (aIsHeadphone && bIsAes) return -1;
        if (aIsAes && bIsHeadphone) return 1;

        // Within same type, sort by portNumber
        return a.portNumber - b.portNumber;
      });

      return {
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
      };
    });

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

    const updates: { ioPortId?: Id<"ioPorts"> | undefined; ioPortIdRight?: Id<"ioPorts"> | undefined } = {};

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

    await ctx.db.patch(args.channelId, updates);
  },
});

// Assign port to output channel
export const patchOutputChannel = mutation({
  args: {
    channelId: v.id("outputChannels"),
    ioPortId: v.union(v.id("ioPorts"), v.null()),
    ioPortIdRight: v.optional(v.union(v.id("ioPorts"), v.null())),
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

    if (args.ioPortIdRight) {
      const portRight = await ctx.db.get(args.ioPortIdRight);
      if (!portRight) throw new Error("Right port not found");
      if (portRight.type !== "output") throw new Error("Cannot assign input port to output channel");
    }

    const updates: { ioPortId?: Id<"ioPorts"> | undefined; ioPortIdRight?: Id<"ioPorts"> | undefined } = {};

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

    await ctx.db.patch(args.channelId, updates);
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
      if (channel.isStereo) {
        // For stereo channels, find two consecutive available ports
        let leftPort: (typeof sortedPorts)[0] | undefined;
        let rightPort: (typeof sortedPorts)[0] | undefined;
        let tempPortIndex = portIndex;

        // Find first available port for left channel
        while (tempPortIndex < sortedPorts.length) {
          const port = sortedPorts[tempPortIndex];
          if (!args.skipAssigned || !usedPorts.has(port._id)) {
            leftPort = port;
            break;
          }
          tempPortIndex++;
        }

        if (!leftPort) {
          skipped++;
          continue; // No ports available for this stereo pair
        }

        // Find second available port for right channel
        tempPortIndex++;
        while (tempPortIndex < sortedPorts.length) {
          const port = sortedPorts[tempPortIndex];
          if (!args.skipAssigned || !usedPorts.has(port._id)) {
            rightPort = port;
            break;
          }
          tempPortIndex++;
        }

        if (!rightPort) {
          skipped++;
          continue; // No second port available for stereo pair
        }

        await ctx.db.patch(channel._id, {
          ioPortId: leftPort._id,
          ioPortIdRight: rightPort._id,
        });

        usedPorts.add(leftPort._id);
        usedPorts.add(rightPort._id);
        portIndex = tempPortIndex + 1;
        assigned++;
      } else {
        // For mono channels, find next available port
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
        });

        usedPorts.add(port._id);
        portIndex++;
        assigned++;
      }
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
        if (ch.ioPortIdRight) usedPorts.add(ch.ioPortIdRight);
      }
    }

    // Assign ports sequentially
    let portIndex = 0;
    let assigned = 0;
    let skipped = 0;

    for (const channel of channels) {
      if (channel.isStereo) {
        // For stereo channels, find two consecutive available ports
        let leftPort: (typeof sortedPorts)[0] | undefined;
        let rightPort: (typeof sortedPorts)[0] | undefined;
        let tempPortIndex = portIndex;

        // Find first available port for left channel
        while (tempPortIndex < sortedPorts.length) {
          const port = sortedPorts[tempPortIndex];
          if (!args.skipAssigned || !usedPorts.has(port._id)) {
            leftPort = port;
            break;
          }
          tempPortIndex++;
        }

        if (!leftPort) {
          skipped++;
          continue; // No ports available for this stereo pair
        }

        // Find second available port for right channel
        tempPortIndex++;
        while (tempPortIndex < sortedPorts.length) {
          const port = sortedPorts[tempPortIndex];
          if (!args.skipAssigned || !usedPorts.has(port._id)) {
            rightPort = port;
            break;
          }
          tempPortIndex++;
        }

        if (!rightPort) {
          skipped++;
          continue; // No second port available for stereo pair
        }

        await ctx.db.patch(channel._id, {
          ioPortId: leftPort._id,
          ioPortIdRight: rightPort._id,
        });

        usedPorts.add(leftPort._id);
        usedPorts.add(rightPort._id);
        portIndex = tempPortIndex + 1;
        assigned++;
      } else {
        // For mono channels, find next available port
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
    }

    return {
      assigned,
      skipped,
      total: args.channelIds.length,
    };
  },
});

// Batch patch multiple channels at once (for diagonal patching)
export const batchPatchChannels = mutation({
  args: {
    channelType: v.union(v.literal("input"), v.literal("output")),
    patches: v.array(v.object({
      channelId: v.string(),
      ioPortId: v.union(v.string(), v.null()),
    })),
  },
  handler: async (ctx, args) => {
    for (const patch of args.patches) {
      if (args.channelType === "input") {
        const channelId = patch.channelId as Id<"inputChannels">;
        const channel = await ctx.db.get(channelId);
        if (!channel) continue;

        if (patch.ioPortId === null) {
          await ctx.db.patch(channelId, {
            ioPortId: undefined,
          });
        } else {
          const portId = patch.ioPortId as Id<"ioPorts">;
          const port = await ctx.db.get(portId);
          if (!port || port.type !== "input") continue;

          await ctx.db.patch(channelId, {
            ioPortId: portId,
          });
        }
      } else {
        const channelId = patch.channelId as Id<"outputChannels">;
        const channel = await ctx.db.get(channelId);
        if (!channel) continue;

        if (patch.ioPortId === null) {
          await ctx.db.patch(channelId, { ioPortId: undefined });
        } else {
          const portId = patch.ioPortId as Id<"ioPorts">;
          const port = await ctx.db.get(portId);
          if (!port || port.type !== "output") continue;

          await ctx.db.patch(channelId, { ioPortId: portId });
        }
      }
    }

    return { patched: args.patches.length };
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
        });
        cleared++;
      }
    }

    if (args.outputChannelIds) {
      for (const channelId of args.outputChannelIds) {
        await ctx.db.patch(channelId, {
          ioPortId: undefined,
          ioPortIdRight: undefined,
        });
        cleared++;
      }
    }

    return { cleared };
  },
});
