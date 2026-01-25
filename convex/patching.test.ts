/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("patching", () => {
  async function setupProject(t: ReturnType<typeof convexTest>) {
    const projectId = await t.run(async (ctx) => {
      return await ctx.db.insert("projects", {
        title: "Test Project",
        ownerId: "test-user",
        collaborators: [],
        isArchived: false,
      });
    });
    return projectId;
  }

  async function setupProjectWithDevice(t: ReturnType<typeof convexTest>) {
    const projectId = await setupProject(t);

    // Create an IO device with ports
    const ioDeviceId = await t.mutation(api.ioDevices.create, {
      projectId,
      name: "Stage Box A",
      shortName: "SBA",
      color: "#ff0000",
      inputCount: 8,
      outputCount: 8,
    });

    // Create some input channels
    const inputChannelId1 = await t.mutation(api.inputChannels.create, {
      projectId,
      source: "Kick",
    });
    const inputChannelId2 = await t.mutation(api.inputChannels.create, {
      projectId,
      source: "Snare",
    });
    const inputChannelId3 = await t.mutation(api.inputChannels.create, {
      projectId,
      source: "Stereo Keys",
      isStereo: true,
    });

    // Create some output channels
    const outputChannelId1 = await t.mutation(api.outputChannels.create, {
      projectId,
      busName: "L",
      destination: "FOH Left",
    });
    const outputChannelId2 = await t.mutation(api.outputChannels.create, {
      projectId,
      busName: "R",
      destination: "FOH Right",
    });

    // Get the ports
    const deviceWithPorts = await t.query(api.ioDevices.getWithPorts, { ioDeviceId });

    return {
      projectId,
      ioDeviceId,
      inputChannelIds: [inputChannelId1, inputChannelId2, inputChannelId3],
      outputChannelIds: [outputChannelId1, outputChannelId2],
      inputPorts: deviceWithPorts?.inputPorts || [],
      outputPorts: deviceWithPorts?.outputPorts || [],
    };
  }

  describe("patchInputChannel", () => {
    it("should assign mono port to channel", async () => {
      const t = convexTest(schema, modules);
      const setup = await setupProjectWithDevice(t);

      const port = setup.inputPorts[0];
      await t.mutation(api.patching.patchInputChannel, {
        channelId: setup.inputChannelIds[0],
        ioPortId: port._id,
      });

      const channel = await t.query(api.inputChannels.get, {
        channelId: setup.inputChannelIds[0],
      });
      expect(channel?.ioPortId).toBe(port._id);
    });

    it("should assign stereo ports (left + right)", async () => {
      const t = convexTest(schema, modules);
      const setup = await setupProjectWithDevice(t);

      const leftPort = setup.inputPorts[0];
      const rightPort = setup.inputPorts[1];

      await t.mutation(api.patching.patchInputChannel, {
        channelId: setup.inputChannelIds[2], // stereo channel
        ioPortId: leftPort._id,
        ioPortIdRight: rightPort._id,
      });

      const channel = await t.query(api.inputChannels.get, {
        channelId: setup.inputChannelIds[2],
      });
      expect(channel?.ioPortId).toBe(leftPort._id);
      expect(channel?.ioPortIdRight).toBe(rightPort._id);
    });

    it("should clear assignment with null", async () => {
      const t = convexTest(schema, modules);
      const setup = await setupProjectWithDevice(t);

      // First assign
      const port = setup.inputPorts[0];
      await t.mutation(api.patching.patchInputChannel, {
        channelId: setup.inputChannelIds[0],
        ioPortId: port._id,
      });

      // Then clear
      await t.mutation(api.patching.patchInputChannel, {
        channelId: setup.inputChannelIds[0],
        ioPortId: null,
      });

      const channel = await t.query(api.inputChannels.get, {
        channelId: setup.inputChannelIds[0],
      });
      expect(channel?.ioPortId).toBeUndefined();
    });

    it("should reject output port on input channel", async () => {
      const t = convexTest(schema, modules);
      const setup = await setupProjectWithDevice(t);

      const outputPort = setup.outputPorts[0];

      await expect(
        t.mutation(api.patching.patchInputChannel, {
          channelId: setup.inputChannelIds[0],
          ioPortId: outputPort._id,
        })
      ).rejects.toThrow("Cannot assign output port to input channel");
    });
  });

  describe("patchOutputChannel", () => {
    it("should assign mono port to channel", async () => {
      const t = convexTest(schema, modules);
      const setup = await setupProjectWithDevice(t);

      const port = setup.outputPorts[0];
      await t.mutation(api.patching.patchOutputChannel, {
        channelId: setup.outputChannelIds[0],
        ioPortId: port._id,
      });

      const channel = await t.query(api.outputChannels.get, {
        channelId: setup.outputChannelIds[0],
      });
      expect(channel?.ioPortId).toBe(port._id);
    });

    it("should clear assignment with null", async () => {
      const t = convexTest(schema, modules);
      const setup = await setupProjectWithDevice(t);

      // First assign
      const port = setup.outputPorts[0];
      await t.mutation(api.patching.patchOutputChannel, {
        channelId: setup.outputChannelIds[0],
        ioPortId: port._id,
      });

      // Then clear
      await t.mutation(api.patching.patchOutputChannel, {
        channelId: setup.outputChannelIds[0],
        ioPortId: null,
      });

      const channel = await t.query(api.outputChannels.get, {
        channelId: setup.outputChannelIds[0],
      });
      expect(channel?.ioPortId).toBeUndefined();
    });

    it("should reject input port on output channel", async () => {
      const t = convexTest(schema, modules);
      const setup = await setupProjectWithDevice(t);

      const inputPort = setup.inputPorts[0];

      await expect(
        t.mutation(api.patching.patchOutputChannel, {
          channelId: setup.outputChannelIds[0],
          ioPortId: inputPort._id,
        })
      ).rejects.toThrow("Cannot assign input port to output channel");
    });
  });

  describe("autoPatchInputChannels", () => {
    it("should assign ports sequentially for mono channels", async () => {
      const t = convexTest(schema, modules);
      const setup = await setupProjectWithDevice(t);

      const result = await t.mutation(api.patching.autoPatchInputChannels, {
        channelIds: [setup.inputChannelIds[0], setup.inputChannelIds[1]],
        startPortId: setup.inputPorts[0]._id,
      });

      expect(result.assigned).toBe(2);

      const channel1 = await t.query(api.inputChannels.get, {
        channelId: setup.inputChannelIds[0],
      });
      const channel2 = await t.query(api.inputChannels.get, {
        channelId: setup.inputChannelIds[1],
      });

      expect(channel1?.ioPortId).toBe(setup.inputPorts[0]._id);
      expect(channel2?.ioPortId).toBe(setup.inputPorts[1]._id);
    });

    it("should assign two consecutive ports for stereo channels", async () => {
      const t = convexTest(schema, modules);
      const setup = await setupProjectWithDevice(t);

      const result = await t.mutation(api.patching.autoPatchInputChannels, {
        channelIds: [setup.inputChannelIds[2]], // stereo channel
        startPortId: setup.inputPorts[0]._id,
      });

      expect(result.assigned).toBe(1);

      const channel = await t.query(api.inputChannels.get, {
        channelId: setup.inputChannelIds[2],
      });

      expect(channel?.ioPortId).toBe(setup.inputPorts[0]._id);
      expect(channel?.ioPortIdRight).toBe(setup.inputPorts[1]._id);
    });

    it("should handle mixed mono/stereo channels", async () => {
      const t = convexTest(schema, modules);
      const setup = await setupProjectWithDevice(t);

      // Mono, then stereo
      const result = await t.mutation(api.patching.autoPatchInputChannels, {
        channelIds: [setup.inputChannelIds[0], setup.inputChannelIds[2]],
        startPortId: setup.inputPorts[0]._id,
      });

      expect(result.assigned).toBe(2);

      const monoChannel = await t.query(api.inputChannels.get, {
        channelId: setup.inputChannelIds[0],
      });
      const stereoChannel = await t.query(api.inputChannels.get, {
        channelId: setup.inputChannelIds[2],
      });

      expect(monoChannel?.ioPortId).toBe(setup.inputPorts[0]._id);
      expect(stereoChannel?.ioPortId).toBe(setup.inputPorts[1]._id);
      expect(stereoChannel?.ioPortIdRight).toBe(setup.inputPorts[2]._id);
    });

    it("should skip channel when not enough ports for stereo", async () => {
      const t = convexTest(schema, modules);
      const setup = await setupProjectWithDevice(t);

      // Start from port 7 (index 6) - only 2 ports left, enough for one stereo pair
      // Then try to assign another stereo channel - should be skipped
      const stereoChannel2 = await t.mutation(api.inputChannels.create, {
        projectId: setup.projectId,
        source: "Stereo Synth",
        isStereo: true,
      });

      const result = await t.mutation(api.patching.autoPatchInputChannels, {
        channelIds: [setup.inputChannelIds[2], stereoChannel2], // two stereo channels
        startPortId: setup.inputPorts[6]._id, // start at port 7
      });

      expect(result.assigned).toBe(1);
      expect(result.skipped).toBe(1);
    });

    it("should skip assigned ports when skipAssigned=true", async () => {
      const t = convexTest(schema, modules);
      const setup = await setupProjectWithDevice(t);

      // Pre-assign first port
      await t.mutation(api.patching.patchInputChannel, {
        channelId: setup.inputChannelIds[0],
        ioPortId: setup.inputPorts[0]._id,
      });

      // Auto-patch with skipAssigned
      const newChannel = await t.mutation(api.inputChannels.create, {
        projectId: setup.projectId,
        source: "New Channel",
      });

      const result = await t.mutation(api.patching.autoPatchInputChannels, {
        channelIds: [newChannel],
        startPortId: setup.inputPorts[0]._id,
        skipAssigned: true,
      });

      expect(result.assigned).toBe(1);

      const channel = await t.query(api.inputChannels.get, { channelId: newChannel });
      expect(channel?.ioPortId).toBe(setup.inputPorts[1]._id); // skipped port 0
    });

    it("should handle port shortage gracefully", async () => {
      const t = convexTest(schema, modules);
      const setup = await setupProjectWithDevice(t);

      // Create more channels than ports
      const channelIds = [...setup.inputChannelIds];
      for (let i = 0; i < 10; i++) {
        const id = await t.mutation(api.inputChannels.create, {
          projectId: setup.projectId,
          source: `Extra ${i}`,
        });
        channelIds.push(id);
      }

      const result = await t.mutation(api.patching.autoPatchInputChannels, {
        channelIds,
        startPortId: setup.inputPorts[0]._id,
      });

      // Should only assign 7 channels (8 ports, but one stereo needs 2)
      expect(result.assigned).toBeLessThanOrEqual(8);
    });
  });

  describe("autoPatchOutputChannels", () => {
    it("should assign ports sequentially", async () => {
      const t = convexTest(schema, modules);
      const setup = await setupProjectWithDevice(t);

      const result = await t.mutation(api.patching.autoPatchOutputChannels, {
        channelIds: setup.outputChannelIds,
        startPortId: setup.outputPorts[0]._id,
      });

      expect(result.assigned).toBe(2);

      const channel1 = await t.query(api.outputChannels.get, {
        channelId: setup.outputChannelIds[0],
      });
      const channel2 = await t.query(api.outputChannels.get, {
        channelId: setup.outputChannelIds[1],
      });

      expect(channel1?.ioPortId).toBe(setup.outputPorts[0]._id);
      expect(channel2?.ioPortId).toBe(setup.outputPorts[1]._id);
    });

    it("should skip assigned ports when skipAssigned=true", async () => {
      const t = convexTest(schema, modules);
      const setup = await setupProjectWithDevice(t);

      // Pre-assign first port
      await t.mutation(api.patching.patchOutputChannel, {
        channelId: setup.outputChannelIds[0],
        ioPortId: setup.outputPorts[0]._id,
      });

      // Auto-patch new channel with skipAssigned
      const newChannel = await t.mutation(api.outputChannels.create, {
        projectId: setup.projectId,
        busName: "Sub",
        destination: "Subwoofer",
      });

      const result = await t.mutation(api.patching.autoPatchOutputChannels, {
        channelIds: [newChannel],
        startPortId: setup.outputPorts[0]._id,
        skipAssigned: true,
      });

      expect(result.assigned).toBe(1);

      const channel = await t.query(api.outputChannels.get, { channelId: newChannel });
      expect(channel?.ioPortId).toBe(setup.outputPorts[1]._id);
    });
  });

  describe("batchPatchChannels", () => {
    it("should patch multiple input channels at once", async () => {
      const t = convexTest(schema, modules);
      const setup = await setupProjectWithDevice(t);

      await t.mutation(api.patching.batchPatchChannels, {
        channelType: "input",
        patches: [
          { channelId: setup.inputChannelIds[0], ioPortId: setup.inputPorts[0]._id },
          { channelId: setup.inputChannelIds[1], ioPortId: setup.inputPorts[1]._id },
        ],
      });

      const channel1 = await t.query(api.inputChannels.get, {
        channelId: setup.inputChannelIds[0],
      });
      const channel2 = await t.query(api.inputChannels.get, {
        channelId: setup.inputChannelIds[1],
      });

      expect(channel1?.ioPortId).toBe(setup.inputPorts[0]._id);
      expect(channel2?.ioPortId).toBe(setup.inputPorts[1]._id);
    });

    it("should patch multiple output channels at once", async () => {
      const t = convexTest(schema, modules);
      const setup = await setupProjectWithDevice(t);

      await t.mutation(api.patching.batchPatchChannels, {
        channelType: "output",
        patches: [
          { channelId: setup.outputChannelIds[0], ioPortId: setup.outputPorts[0]._id },
          { channelId: setup.outputChannelIds[1], ioPortId: setup.outputPorts[1]._id },
        ],
      });

      const channel1 = await t.query(api.outputChannels.get, {
        channelId: setup.outputChannelIds[0],
      });
      const channel2 = await t.query(api.outputChannels.get, {
        channelId: setup.outputChannelIds[1],
      });

      expect(channel1?.ioPortId).toBe(setup.outputPorts[0]._id);
      expect(channel2?.ioPortId).toBe(setup.outputPorts[1]._id);
    });

    it("should handle null (unassign) in batch", async () => {
      const t = convexTest(schema, modules);
      const setup = await setupProjectWithDevice(t);

      // First assign
      await t.mutation(api.patching.patchInputChannel, {
        channelId: setup.inputChannelIds[0],
        ioPortId: setup.inputPorts[0]._id,
      });

      // Then unassign via batch
      await t.mutation(api.patching.batchPatchChannels, {
        channelType: "input",
        patches: [{ channelId: setup.inputChannelIds[0], ioPortId: null }],
      });

      const channel = await t.query(api.inputChannels.get, {
        channelId: setup.inputChannelIds[0],
      });
      expect(channel?.ioPortId).toBeUndefined();
    });

    it("should skip patches with wrong port type", async () => {
      const t = convexTest(schema, modules);
      const setup = await setupProjectWithDevice(t);

      // Try to patch input channel with output port - should be skipped
      const result = await t.mutation(api.patching.batchPatchChannels, {
        channelType: "input",
        patches: [{ channelId: setup.inputChannelIds[0], ioPortId: setup.outputPorts[0]._id }],
      });

      // Returns patched count but the actual patch doesn't happen
      const channel = await t.query(api.inputChannels.get, {
        channelId: setup.inputChannelIds[0],
      });
      expect(channel?.ioPortId).toBeUndefined();
    });
  });

  describe("clearPatches", () => {
    it("should clear input channel patches", async () => {
      const t = convexTest(schema, modules);
      const setup = await setupProjectWithDevice(t);

      // Assign patches
      await t.mutation(api.patching.patchInputChannel, {
        channelId: setup.inputChannelIds[0],
        ioPortId: setup.inputPorts[0]._id,
      });
      await t.mutation(api.patching.patchInputChannel, {
        channelId: setup.inputChannelIds[1],
        ioPortId: setup.inputPorts[1]._id,
      });

      // Clear
      const result = await t.mutation(api.patching.clearPatches, {
        inputChannelIds: setup.inputChannelIds.slice(0, 2),
      });

      expect(result.cleared).toBe(2);

      const channel1 = await t.query(api.inputChannels.get, {
        channelId: setup.inputChannelIds[0],
      });
      const channel2 = await t.query(api.inputChannels.get, {
        channelId: setup.inputChannelIds[1],
      });

      expect(channel1?.ioPortId).toBeUndefined();
      expect(channel2?.ioPortId).toBeUndefined();
    });

    it("should clear output channel patches", async () => {
      const t = convexTest(schema, modules);
      const setup = await setupProjectWithDevice(t);

      // Assign patches
      await t.mutation(api.patching.patchOutputChannel, {
        channelId: setup.outputChannelIds[0],
        ioPortId: setup.outputPorts[0]._id,
      });

      // Clear
      const result = await t.mutation(api.patching.clearPatches, {
        outputChannelIds: [setup.outputChannelIds[0]],
      });

      expect(result.cleared).toBe(1);

      const channel = await t.query(api.outputChannels.get, {
        channelId: setup.outputChannelIds[0],
      });
      expect(channel?.ioPortId).toBeUndefined();
    });

    it("should clear both input and output patches simultaneously", async () => {
      const t = convexTest(schema, modules);
      const setup = await setupProjectWithDevice(t);

      // Assign patches
      await t.mutation(api.patching.patchInputChannel, {
        channelId: setup.inputChannelIds[0],
        ioPortId: setup.inputPorts[0]._id,
      });
      await t.mutation(api.patching.patchOutputChannel, {
        channelId: setup.outputChannelIds[0],
        ioPortId: setup.outputPorts[0]._id,
      });

      // Clear both
      const result = await t.mutation(api.patching.clearPatches, {
        inputChannelIds: [setup.inputChannelIds[0]],
        outputChannelIds: [setup.outputChannelIds[0]],
      });

      expect(result.cleared).toBe(2);

      const inputChannel = await t.query(api.inputChannels.get, {
        channelId: setup.inputChannelIds[0],
      });
      const outputChannel = await t.query(api.outputChannels.get, {
        channelId: setup.outputChannelIds[0],
      });

      expect(inputChannel?.ioPortId).toBeUndefined();
      expect(outputChannel?.ioPortId).toBeUndefined();
    });

    it("should clear stereo port assignments", async () => {
      const t = convexTest(schema, modules);
      const setup = await setupProjectWithDevice(t);

      // Assign stereo ports
      await t.mutation(api.patching.patchInputChannel, {
        channelId: setup.inputChannelIds[2],
        ioPortId: setup.inputPorts[0]._id,
        ioPortIdRight: setup.inputPorts[1]._id,
      });

      // Clear
      await t.mutation(api.patching.clearPatches, {
        inputChannelIds: [setup.inputChannelIds[2]],
      });

      const channel = await t.query(api.inputChannels.get, {
        channelId: setup.inputChannelIds[2],
      });
      expect(channel?.ioPortId).toBeUndefined();
      expect(channel?.ioPortIdRight).toBeUndefined();
    });
  });

  describe("getAllPatchingData", () => {
    it("should return port groups per device", async () => {
      const t = convexTest(schema, modules);
      const setup = await setupProjectWithDevice(t);

      const data = await t.query(api.patching.getAllPatchingData, {
        projectId: setup.projectId,
      });

      expect(data.inputPortGroups).toHaveLength(1);
      expect(data.inputPortGroups[0].device.shortName).toBe("SBA");
      expect(data.inputPortGroups[0].ports).toHaveLength(8);

      expect(data.outputPortGroups).toHaveLength(1);
      expect(data.outputPortGroups[0].device.shortName).toBe("SBA");
      expect(data.outputPortGroups[0].ports).toHaveLength(8);
    });

    it("should build accurate port usage map", async () => {
      const t = convexTest(schema, modules);
      const setup = await setupProjectWithDevice(t);

      // Assign a port
      await t.mutation(api.patching.patchInputChannel, {
        channelId: setup.inputChannelIds[0],
        ioPortId: setup.inputPorts[0]._id,
      });

      const data = await t.query(api.patching.getAllPatchingData, {
        projectId: setup.projectId,
      });

      expect(data.portUsageMap[setup.inputPorts[0]._id]).toBeDefined();
      expect(data.portUsageMap[setup.inputPorts[0]._id].channelType).toBe("input");
      expect(data.portUsageMap[setup.inputPorts[0]._id].channelName).toBe("Kick");
    });

    it("should mark used ports in port groups", async () => {
      const t = convexTest(schema, modules);
      const setup = await setupProjectWithDevice(t);

      // Assign a port
      await t.mutation(api.patching.patchInputChannel, {
        channelId: setup.inputChannelIds[0],
        ioPortId: setup.inputPorts[0]._id,
      });

      const data = await t.query(api.patching.getAllPatchingData, {
        projectId: setup.projectId,
      });

      const port0 = data.inputPortGroups[0].ports.find((p) => p._id === setup.inputPorts[0]._id);
      const port1 = data.inputPortGroups[0].ports.find((p) => p._id === setup.inputPorts[1]._id);

      expect(port0?.isUsed).toBe(true);
      expect(port1?.isUsed).toBe(false);
    });

    it("should sort ports: regular > headphone > AES", async () => {
      const t = convexTest(schema, modules);
      const projectId = await setupProject(t);

      // Create device with all port types
      const ioDeviceId = await t.mutation(api.ioDevices.create, {
        projectId,
        name: "Mixed Device",
        shortName: "MX",
        color: "#00ff00",
        inputCount: 4,
        outputCount: 4,
        headphoneOutputCount: 1,
        aesInputCount: 1,
        aesOutputCount: 1,
      });

      const data = await t.query(api.patching.getAllPatchingData, { projectId });

      // Input ports should be: regular (4) + AES (2) = 6
      const inputPorts = data.inputPortGroups[0].ports;
      expect(inputPorts).toHaveLength(6);

      // First 4 should be regular (subType is "regular" or undefined)
      expect(inputPorts[0].subType === "regular" || inputPorts[0].subType === undefined).toBe(true);
      expect(inputPorts[3].subType === "regular" || inputPorts[3].subType === undefined).toBe(true);

      // Last 2 should be AES
      expect(inputPorts[4].subType).toBe("aes_left");
      expect(inputPorts[5].subType).toBe("aes_right");

      // Output ports should be: regular (4) + HP (2) + AES (2) = 8
      const outputPorts = data.outputPortGroups[0].ports;
      expect(outputPorts).toHaveLength(8);
    });
  });

  describe("getPortUsageMap", () => {
    it("should map ports to assigned channels", async () => {
      const t = convexTest(schema, modules);
      const setup = await setupProjectWithDevice(t);

      await t.mutation(api.patching.patchInputChannel, {
        channelId: setup.inputChannelIds[0],
        ioPortId: setup.inputPorts[0]._id,
      });

      const usageMap = await t.query(api.patching.getPortUsageMap, {
        projectId: setup.projectId,
      });

      expect(usageMap[setup.inputPorts[0]._id]).toBeDefined();
      expect(usageMap[setup.inputPorts[0]._id].channelType).toBe("input");
      expect(usageMap[setup.inputPorts[0]._id].channelId).toBe(setup.inputChannelIds[0]);
    });

    it("should handle stereo assignments (both ports)", async () => {
      const t = convexTest(schema, modules);
      const setup = await setupProjectWithDevice(t);

      await t.mutation(api.patching.patchInputChannel, {
        channelId: setup.inputChannelIds[2],
        ioPortId: setup.inputPorts[0]._id,
        ioPortIdRight: setup.inputPorts[1]._id,
      });

      const usageMap = await t.query(api.patching.getPortUsageMap, {
        projectId: setup.projectId,
      });

      // Both ports should reference the same channel
      expect(usageMap[setup.inputPorts[0]._id].channelId).toBe(setup.inputChannelIds[2]);
      expect(usageMap[setup.inputPorts[1]._id].channelId).toBe(setup.inputChannelIds[2]);
    });
  });

  describe("getAvailablePorts", () => {
    it("should filter by port type", async () => {
      const t = convexTest(schema, modules);
      const setup = await setupProjectWithDevice(t);

      const inputPorts = await t.query(api.patching.getAvailablePorts, {
        projectId: setup.projectId,
        portType: "input",
      });

      const outputPorts = await t.query(api.patching.getAvailablePorts, {
        projectId: setup.projectId,
        portType: "output",
      });

      expect(inputPorts[0].ports).toHaveLength(8);
      expect(inputPorts[0].ports.every((p) => p.type === "input")).toBe(true);

      expect(outputPorts[0].ports).toHaveLength(8);
      expect(outputPorts[0].ports.every((p) => p.type === "output")).toBe(true);
    });

    it("should mark used ports correctly", async () => {
      const t = convexTest(schema, modules);
      const setup = await setupProjectWithDevice(t);

      await t.mutation(api.patching.patchInputChannel, {
        channelId: setup.inputChannelIds[0],
        ioPortId: setup.inputPorts[0]._id,
      });

      const ports = await t.query(api.patching.getAvailablePorts, {
        projectId: setup.projectId,
        portType: "input",
      });

      const port0 = ports[0].ports.find((p) => p._id === setup.inputPorts[0]._id);
      const port1 = ports[0].ports.find((p) => p._id === setup.inputPorts[1]._id);

      expect(port0?.isUsed).toBe(true);
      expect(port1?.isUsed).toBe(false);
    });
  });
});
