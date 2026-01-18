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

    // Fetch all ports in parallel instead of sequentially
    const allPortsArrays = await Promise.all(
      ioDevices.map((device) =>
        ctx.db
          .query("ioPorts")
          .withIndex("by_ioDevice", (q) => q.eq("ioDeviceId", device._id))
          .collect()
      )
    );

    // Map devices to their ports
    return ioDevices.map((device, index) => {
      const ports = allPortsArrays[index];
      return {
        ...device,
        inputPorts: ports
          .filter((p) => p.type === "input" && (!p.subType || p.subType === "regular"))
          .sort((a, b) => a.portNumber - b.portNumber),
        outputPorts: ports
          .filter((p) => p.type === "output" && (!p.subType || p.subType === "regular"))
          .sort((a, b) => a.portNumber - b.portNumber),
        headphonePorts: ports
          .filter((p) => p.subType === "headphone_left" || p.subType === "headphone_right")
          .sort((a, b) => a.portNumber - b.portNumber),
        aesInputPorts: ports
          .filter((p) => p.type === "input" && (p.subType === "aes_left" || p.subType === "aes_right"))
          .sort((a, b) => a.portNumber - b.portNumber),
        aesOutputPorts: ports
          .filter((p) => p.type === "output" && (p.subType === "aes_left" || p.subType === "aes_right"))
          .sort((a, b) => a.portNumber - b.portNumber),
      };
    });
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
      inputPorts: ports
        .filter((p) => p.type === "input" && (!p.subType || p.subType === "regular"))
        .sort((a, b) => a.portNumber - b.portNumber),
      outputPorts: ports
        .filter((p) => p.type === "output" && (!p.subType || p.subType === "regular"))
        .sort((a, b) => a.portNumber - b.portNumber),
      headphonePorts: ports
        .filter((p) => p.subType === "headphone_left" || p.subType === "headphone_right")
        .sort((a, b) => a.portNumber - b.portNumber),
      aesInputPorts: ports
        .filter((p) => p.type === "input" && (p.subType === "aes_left" || p.subType === "aes_right"))
        .sort((a, b) => a.portNumber - b.portNumber),
      aesOutputPorts: ports
        .filter((p) => p.type === "output" && (p.subType === "aes_left" || p.subType === "aes_right"))
        .sort((a, b) => a.portNumber - b.portNumber),
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

    // Fetch all ports in parallel
    const allPortsArrays = await Promise.all(
      ioDevices.map((ioDevice) =>
        ctx.db
          .query("ioPorts")
          .withIndex("by_ioDevice", (q) => q.eq("ioDeviceId", ioDevice._id))
          .collect()
      )
    );

    // Flatten and enrich with device info
    return ioDevices.flatMap((ioDevice, index) =>
      allPortsArrays[index].map((port) => ({
        ...port,
        ioDeviceName: ioDevice.name,
        ioDeviceColor: ioDevice.color,
      }))
    );
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
    headphoneOutputCount: v.optional(v.number()),
    aesInputCount: v.optional(v.number()),
    aesOutputCount: v.optional(v.number()),
    position: v.optional(v.object({ x: v.number(), y: v.number() })),
    deviceType: v.optional(v.union(v.literal("stagebox"), v.literal("generic"))),
    portsPerRow: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const headphoneOutputCount = args.headphoneOutputCount ?? 0;
    const aesInputCount = args.aesInputCount ?? 0;
    const aesOutputCount = args.aesOutputCount ?? 0;

    const ioDeviceId = await ctx.db.insert("ioDevices", {
      projectId: args.projectId,
      name: args.name,
      shortName: args.shortName,
      color: args.color,
      inputCount: args.inputCount,
      outputCount: args.outputCount,
      headphoneOutputCount: headphoneOutputCount,
      aesInputCount: aesInputCount,
      aesOutputCount: aesOutputCount,
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
        subType: "regular",
      });
    }

    // Create output ports
    for (let i = 1; i <= args.outputCount; i++) {
      await ctx.db.insert("ioPorts", {
        ioDeviceId,
        type: "output",
        portNumber: i,
        label: `${args.shortName}-O${i}`,
        subType: "regular",
      });
    }

    // Create headphone output ports (stereo pairs)
    for (let i = 1; i <= headphoneOutputCount; i++) {
      // Left channel
      await ctx.db.insert("ioPorts", {
        ioDeviceId,
        type: "output",
        portNumber: args.outputCount + (i - 1) * 2 + 1,
        label: `${args.shortName}-HP${i}L`,
        subType: "headphone_left",
        headphoneNumber: i,
      });
      // Right channel
      await ctx.db.insert("ioPorts", {
        ioDeviceId,
        type: "output",
        portNumber: args.outputCount + (i - 1) * 2 + 2,
        label: `${args.shortName}-HP${i}R`,
        subType: "headphone_right",
        headphoneNumber: i,
      });
    }

    // Create AES input ports (stereo pairs)
    for (let i = 1; i <= aesInputCount; i++) {
      // Left channel
      await ctx.db.insert("ioPorts", {
        ioDeviceId,
        type: "input",
        portNumber: args.inputCount + (i - 1) * 2 + 1,
        label: `${args.shortName}-AES${i}L`,
        subType: "aes_left",
        aesNumber: i,
      });
      // Right channel
      await ctx.db.insert("ioPorts", {
        ioDeviceId,
        type: "input",
        portNumber: args.inputCount + (i - 1) * 2 + 2,
        label: `${args.shortName}-AES${i}R`,
        subType: "aes_right",
        aesNumber: i,
      });
    }

    // Create AES output ports (stereo pairs)
    const hpPortCount = headphoneOutputCount * 2;
    for (let i = 1; i <= aesOutputCount; i++) {
      // Left channel
      await ctx.db.insert("ioPorts", {
        ioDeviceId,
        type: "output",
        portNumber: args.outputCount + hpPortCount + (i - 1) * 2 + 1,
        label: `${args.shortName}-AESO${i}L`,
        subType: "aes_left",
        aesNumber: i,
      });
      // Right channel
      await ctx.db.insert("ioPorts", {
        ioDeviceId,
        type: "output",
        portNumber: args.outputCount + hpPortCount + (i - 1) * 2 + 2,
        label: `${args.shortName}-AESO${i}R`,
        subType: "aes_right",
        aesNumber: i,
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
      let newLabel: string;
      if (port.subType === "headphone_left") {
        newLabel = `${args.newShortName}-HP${port.headphoneNumber}L`;
      } else if (port.subType === "headphone_right") {
        newLabel = `${args.newShortName}-HP${port.headphoneNumber}R`;
      } else if (port.subType === "aes_left") {
        // AES input uses "AES", AES output uses "AESO"
        const prefix = port.type === "input" ? "AES" : "AESO";
        newLabel = `${args.newShortName}-${prefix}${port.aesNumber}L`;
      } else if (port.subType === "aes_right") {
        const prefix = port.type === "input" ? "AES" : "AESO";
        newLabel = `${args.newShortName}-${prefix}${port.aesNumber}R`;
      } else {
        const typePrefix = port.type === "input" ? "I" : "O";
        newLabel = `${args.newShortName}-${typePrefix}${port.portNumber}`;
      }
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
    newHeadphoneOutputCount: v.optional(v.number()),
    newAesInputCount: v.optional(v.number()),
    newAesOutputCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const ioDevice = await ctx.db.get(args.ioDeviceId);
    if (!ioDevice) return;

    const ports = await ctx.db
      .query("ioPorts")
      .withIndex("by_ioDevice", (q) => q.eq("ioDeviceId", args.ioDeviceId))
      .collect();

    const regularInputPorts = ports
      .filter((p) => p.type === "input" && (!p.subType || p.subType === "regular"))
      .sort((a, b) => a.portNumber - b.portNumber);
    const regularOutputPorts = ports
      .filter((p) => p.type === "output" && (!p.subType || p.subType === "regular"))
      .sort((a, b) => a.portNumber - b.portNumber);
    const headphonePorts = ports
      .filter((p) => p.subType === "headphone_left" || p.subType === "headphone_right")
      .sort((a, b) => a.portNumber - b.portNumber);
    const aesInputPorts = ports
      .filter((p) => p.type === "input" && (p.subType === "aes_left" || p.subType === "aes_right"))
      .sort((a, b) => a.portNumber - b.portNumber);
    const aesOutputPorts = ports
      .filter((p) => p.type === "output" && (p.subType === "aes_left" || p.subType === "aes_right"))
      .sort((a, b) => a.portNumber - b.portNumber);

    const currentHeadphoneCount = ioDevice.headphoneOutputCount ?? 0;
    const newHeadphoneCount = args.newHeadphoneOutputCount ?? currentHeadphoneCount;
    const currentAesInputCount = ioDevice.aesInputCount ?? 0;
    const newAesInputCount = args.newAesInputCount ?? currentAesInputCount;
    const currentAesOutputCount = ioDevice.aesOutputCount ?? 0;
    const newAesOutputCount = args.newAesOutputCount ?? currentAesOutputCount;

    // Handle regular input ports
    if (args.newInputCount > regularInputPorts.length) {
      // Add new input ports
      for (let i = regularInputPorts.length + 1; i <= args.newInputCount; i++) {
        await ctx.db.insert("ioPorts", {
          ioDeviceId: args.ioDeviceId,
          type: "input",
          portNumber: i,
          label: `${ioDevice.shortName}-I${i}`,
          subType: "regular",
        });
      }
    } else if (args.newInputCount < regularInputPorts.length) {
      // Remove excess input ports and clear channel references
      const portsToRemove = regularInputPorts.filter((p) => p.portNumber > args.newInputCount);
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

    // Handle regular output ports
    if (args.newOutputCount > regularOutputPorts.length) {
      // Add new output ports
      for (let i = regularOutputPorts.length + 1; i <= args.newOutputCount; i++) {
        await ctx.db.insert("ioPorts", {
          ioDeviceId: args.ioDeviceId,
          type: "output",
          portNumber: i,
          label: `${ioDevice.shortName}-O${i}`,
          subType: "regular",
        });
      }
    } else if (args.newOutputCount < regularOutputPorts.length) {
      // Remove excess output ports and clear channel references
      const portsToRemove = regularOutputPorts.filter((p) => p.portNumber > args.newOutputCount);
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

    // Handle headphone output ports
    if (newHeadphoneCount > currentHeadphoneCount) {
      // Add new headphone ports
      for (let i = currentHeadphoneCount + 1; i <= newHeadphoneCount; i++) {
        // Left channel
        await ctx.db.insert("ioPorts", {
          ioDeviceId: args.ioDeviceId,
          type: "output",
          portNumber: args.newOutputCount + (i - 1) * 2 + 1,
          label: `${ioDevice.shortName}-HP${i}L`,
          subType: "headphone_left",
          headphoneNumber: i,
        });
        // Right channel
        await ctx.db.insert("ioPorts", {
          ioDeviceId: args.ioDeviceId,
          type: "output",
          portNumber: args.newOutputCount + (i - 1) * 2 + 2,
          label: `${ioDevice.shortName}-HP${i}R`,
          subType: "headphone_right",
          headphoneNumber: i,
        });
      }
    } else if (newHeadphoneCount < currentHeadphoneCount) {
      // Remove excess headphone ports and clear channel references
      const portsToRemove = headphonePorts.filter(
        (p) => p.headphoneNumber !== undefined && p.headphoneNumber > newHeadphoneCount
      );
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

    // Handle AES input ports
    if (newAesInputCount > currentAesInputCount) {
      // Add new AES input ports
      for (let i = currentAesInputCount + 1; i <= newAesInputCount; i++) {
        // Left channel
        await ctx.db.insert("ioPorts", {
          ioDeviceId: args.ioDeviceId,
          type: "input",
          portNumber: args.newInputCount + (i - 1) * 2 + 1,
          label: `${ioDevice.shortName}-AES${i}L`,
          subType: "aes_left",
          aesNumber: i,
        });
        // Right channel
        await ctx.db.insert("ioPorts", {
          ioDeviceId: args.ioDeviceId,
          type: "input",
          portNumber: args.newInputCount + (i - 1) * 2 + 2,
          label: `${ioDevice.shortName}-AES${i}R`,
          subType: "aes_right",
          aesNumber: i,
        });
      }
    } else if (newAesInputCount < currentAesInputCount) {
      // Remove excess AES input ports and clear channel references
      const portsToRemove = aesInputPorts.filter(
        (p) => p.aesNumber !== undefined && p.aesNumber > newAesInputCount
      );
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

    // Handle AES output ports
    const newHpPortCount = newHeadphoneCount * 2;
    if (newAesOutputCount > currentAesOutputCount) {
      // Add new AES output ports
      for (let i = currentAesOutputCount + 1; i <= newAesOutputCount; i++) {
        // Left channel
        await ctx.db.insert("ioPorts", {
          ioDeviceId: args.ioDeviceId,
          type: "output",
          portNumber: args.newOutputCount + newHpPortCount + (i - 1) * 2 + 1,
          label: `${ioDevice.shortName}-AESO${i}L`,
          subType: "aes_left",
          aesNumber: i,
        });
        // Right channel
        await ctx.db.insert("ioPorts", {
          ioDeviceId: args.ioDeviceId,
          type: "output",
          portNumber: args.newOutputCount + newHpPortCount + (i - 1) * 2 + 2,
          label: `${ioDevice.shortName}-AESO${i}R`,
          subType: "aes_right",
          aesNumber: i,
        });
      }
    } else if (newAesOutputCount < currentAesOutputCount) {
      // Remove excess AES output ports and clear channel references
      const portsToRemove = aesOutputPorts.filter(
        (p) => p.aesNumber !== undefined && p.aesNumber > newAesOutputCount
      );
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

    // If input count changed, update AES input port numbers
    if (args.newInputCount !== ioDevice.inputCount && newAesInputCount > 0) {
      const allPorts = await ctx.db
        .query("ioPorts")
        .withIndex("by_ioDevice", (q) => q.eq("ioDeviceId", args.ioDeviceId))
        .collect();
      const aesPorts = allPorts.filter(
        (p) => p.type === "input" && (p.subType === "aes_left" || p.subType === "aes_right")
      );
      for (const port of aesPorts) {
        if (port.aesNumber !== undefined) {
          const newPortNumber =
            port.subType === "aes_left"
              ? args.newInputCount + (port.aesNumber - 1) * 2 + 1
              : args.newInputCount + (port.aesNumber - 1) * 2 + 2;
          await ctx.db.patch(port._id, { portNumber: newPortNumber });
        }
      }
    }

    // If output count or HP count changed, update HP and AES output port numbers
    const outputOrHpChanged = args.newOutputCount !== ioDevice.outputCount || newHeadphoneCount !== currentHeadphoneCount;
    if (outputOrHpChanged) {
      const allPorts = await ctx.db
        .query("ioPorts")
        .withIndex("by_ioDevice", (q) => q.eq("ioDeviceId", args.ioDeviceId))
        .collect();

      // Update headphone port numbers
      if (newHeadphoneCount > 0) {
        const hpPorts = allPorts.filter(
          (p) => p.subType === "headphone_left" || p.subType === "headphone_right"
        );
        for (const port of hpPorts) {
          if (port.headphoneNumber !== undefined) {
            const newPortNumber =
              port.subType === "headphone_left"
                ? args.newOutputCount + (port.headphoneNumber - 1) * 2 + 1
                : args.newOutputCount + (port.headphoneNumber - 1) * 2 + 2;
            await ctx.db.patch(port._id, { portNumber: newPortNumber });
          }
        }
      }

      // Update AES output port numbers
      if (newAesOutputCount > 0) {
        const aesOutPorts = allPorts.filter(
          (p) => p.type === "output" && (p.subType === "aes_left" || p.subType === "aes_right")
        );
        for (const port of aesOutPorts) {
          if (port.aesNumber !== undefined) {
            const newPortNumber =
              port.subType === "aes_left"
                ? args.newOutputCount + newHpPortCount + (port.aesNumber - 1) * 2 + 1
                : args.newOutputCount + newHpPortCount + (port.aesNumber - 1) * 2 + 2;
            await ctx.db.patch(port._id, { portNumber: newPortNumber });
          }
        }
      }
    }

    // Update the device counts
    await ctx.db.patch(args.ioDeviceId, {
      inputCount: args.newInputCount,
      outputCount: args.newOutputCount,
      headphoneOutputCount: newHeadphoneCount,
      aesInputCount: newAesInputCount,
      aesOutputCount: newAesOutputCount,
    });
  },
});
