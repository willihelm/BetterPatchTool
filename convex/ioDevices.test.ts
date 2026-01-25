/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("ioDevices", () => {
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

  describe("create", () => {
    it("should create device with regular ports only", async () => {
      const t = convexTest(schema, modules);
      const projectId = await setupProject(t);

      const deviceId = await t.mutation(api.ioDevices.create, {
        projectId,
        name: "Stage Box A",
        shortName: "SBA",
        color: "#ff0000",
        inputCount: 8,
        outputCount: 4,
      });

      expect(deviceId).toBeDefined();

      const device = await t.query(api.ioDevices.getWithPorts, { ioDeviceId: deviceId });
      expect(device?.name).toBe("Stage Box A");
      expect(device?.shortName).toBe("SBA");
      expect(device?.color).toBe("#ff0000");
      expect(device?.inputPorts).toHaveLength(8);
      expect(device?.outputPorts).toHaveLength(4);
    });

    it("should create device with all port types", async () => {
      const t = convexTest(schema, modules);
      const projectId = await setupProject(t);

      const deviceId = await t.mutation(api.ioDevices.create, {
        projectId,
        name: "Full Device",
        shortName: "FD",
        color: "#00ff00",
        inputCount: 4,
        outputCount: 4,
        headphoneOutputCount: 2,
        aesInputCount: 1,
        aesOutputCount: 1,
      });

      const device = await t.query(api.ioDevices.getWithPorts, { ioDeviceId: deviceId });
      expect(device?.inputPorts).toHaveLength(4);
      expect(device?.outputPorts).toHaveLength(4);
      expect(device?.headphonePorts).toHaveLength(4); // 2 pairs = 4 ports
      expect(device?.aesInputPorts).toHaveLength(2); // 1 pair = 2 ports
      expect(device?.aesOutputPorts).toHaveLength(2); // 1 pair = 2 ports
    });

    it("should generate correct port labels", async () => {
      const t = convexTest(schema, modules);
      const projectId = await setupProject(t);

      const deviceId = await t.mutation(api.ioDevices.create, {
        projectId,
        name: "Test Box",
        shortName: "TB",
        color: "#0000ff",
        inputCount: 2,
        outputCount: 2,
        headphoneOutputCount: 1,
        aesInputCount: 1,
      });

      const device = await t.query(api.ioDevices.getWithPorts, { ioDeviceId: deviceId });

      // Check input port labels
      expect(device?.inputPorts[0].label).toBe("TB-I1");
      expect(device?.inputPorts[1].label).toBe("TB-I2");

      // Check output port labels
      expect(device?.outputPorts[0].label).toBe("TB-O1");
      expect(device?.outputPorts[1].label).toBe("TB-O2");

      // Check headphone port labels
      expect(device?.headphonePorts[0].label).toBe("TB-HP1L");
      expect(device?.headphonePorts[1].label).toBe("TB-HP1R");

      // Check AES input port labels
      expect(device?.aesInputPorts[0].label).toBe("TB-AES1L");
      expect(device?.aesInputPorts[1].label).toBe("TB-AES1R");
    });

    it("should auto-increment device order", async () => {
      const t = convexTest(schema, modules);
      const projectId = await setupProject(t);

      const deviceId1 = await t.mutation(api.ioDevices.create, {
        projectId,
        name: "Device 1",
        shortName: "D1",
        color: "#ff0000",
        inputCount: 4,
        outputCount: 4,
      });

      const deviceId2 = await t.mutation(api.ioDevices.create, {
        projectId,
        name: "Device 2",
        shortName: "D2",
        color: "#00ff00",
        inputCount: 4,
        outputCount: 4,
      });

      const device1 = await t.query(api.ioDevices.getWithPorts, { ioDeviceId: deviceId1 });
      const device2 = await t.query(api.ioDevices.getWithPorts, { ioDeviceId: deviceId2 });

      expect(device1?.order).toBe(1);
      expect(device2?.order).toBe(2);
    });

    it("should generate correct port numbers (no overlaps)", async () => {
      const t = convexTest(schema, modules);
      const projectId = await setupProject(t);

      const deviceId = await t.mutation(api.ioDevices.create, {
        projectId,
        name: "Full Device",
        shortName: "FD",
        color: "#ffffff",
        inputCount: 4,
        outputCount: 4,
        headphoneOutputCount: 2,
        aesInputCount: 1,
        aesOutputCount: 1,
      });

      const device = await t.query(api.ioDevices.getWithPorts, { ioDeviceId: deviceId });

      // Input ports: 1-4
      expect(device?.inputPorts.map((p) => p.portNumber)).toEqual([1, 2, 3, 4]);

      // AES input ports: 5-6 (after regular inputs)
      expect(device?.aesInputPorts.map((p) => p.portNumber)).toEqual([5, 6]);

      // Output ports: 1-4
      expect(device?.outputPorts.map((p) => p.portNumber)).toEqual([1, 2, 3, 4]);

      // Headphone output ports: 5-8 (after regular outputs)
      expect(device?.headphonePorts.map((p) => p.portNumber)).toEqual([5, 6, 7, 8]);

      // AES output ports: 9-10 (after headphones)
      expect(device?.aesOutputPorts.map((p) => p.portNumber)).toEqual([9, 10]);
    });
  });

  describe("update", () => {
    it("should update name/color/position", async () => {
      const t = convexTest(schema, modules);
      const projectId = await setupProject(t);

      const deviceId = await t.mutation(api.ioDevices.create, {
        projectId,
        name: "Original Name",
        shortName: "ON",
        color: "#ff0000",
        inputCount: 4,
        outputCount: 4,
      });

      await t.mutation(api.ioDevices.update, {
        ioDeviceId: deviceId,
        name: "Updated Name",
        color: "#00ff00",
        position: { x: 100, y: 200 },
      });

      const device = await t.query(api.ioDevices.getWithPorts, { ioDeviceId: deviceId });
      expect(device?.name).toBe("Updated Name");
      expect(device?.color).toBe("#00ff00");
      expect(device?.position).toEqual({ x: 100, y: 200 });
    });

    it("should only update provided fields (partial update)", async () => {
      const t = convexTest(schema, modules);
      const projectId = await setupProject(t);

      const deviceId = await t.mutation(api.ioDevices.create, {
        projectId,
        name: "Original Name",
        shortName: "ON",
        color: "#ff0000",
        inputCount: 4,
        outputCount: 4,
      });

      await t.mutation(api.ioDevices.update, {
        ioDeviceId: deviceId,
        name: "Updated Name",
      });

      const device = await t.query(api.ioDevices.getWithPorts, { ioDeviceId: deviceId });
      expect(device?.name).toBe("Updated Name");
      expect(device?.shortName).toBe("ON"); // unchanged
      expect(device?.color).toBe("#ff0000"); // unchanged
    });
  });

  describe("remove", () => {
    it("should delete device and all associated ports", async () => {
      const t = convexTest(schema, modules);
      const projectId = await setupProject(t);

      const deviceId = await t.mutation(api.ioDevices.create, {
        projectId,
        name: "To Delete",
        shortName: "TD",
        color: "#ff0000",
        inputCount: 8,
        outputCount: 8,
      });

      // Verify device exists
      let device = await t.query(api.ioDevices.getWithPorts, { ioDeviceId: deviceId });
      expect(device).not.toBeNull();
      expect(device?.inputPorts).toHaveLength(8);

      // Delete
      await t.mutation(api.ioDevices.remove, { ioDeviceId: deviceId });

      // Verify device is gone
      device = await t.query(api.ioDevices.getWithPorts, { ioDeviceId: deviceId });
      expect(device).toBeNull();
    });
  });

  describe("updatePortCounts", () => {
    it("should add input ports when count increases", async () => {
      const t = convexTest(schema, modules);
      const projectId = await setupProject(t);

      const deviceId = await t.mutation(api.ioDevices.create, {
        projectId,
        name: "Test Device",
        shortName: "TD",
        color: "#ff0000",
        inputCount: 4,
        outputCount: 4,
      });

      await t.mutation(api.ioDevices.updatePortCounts, {
        ioDeviceId: deviceId,
        newInputCount: 8,
        newOutputCount: 4,
      });

      const device = await t.query(api.ioDevices.getWithPorts, { ioDeviceId: deviceId });
      expect(device?.inputPorts).toHaveLength(8);
      expect(device?.inputPorts[7].label).toBe("TD-I8");
    });

    it("should remove input ports and clear channel refs when count decreases", async () => {
      const t = convexTest(schema, modules);
      const projectId = await setupProject(t);

      const deviceId = await t.mutation(api.ioDevices.create, {
        projectId,
        name: "Test Device",
        shortName: "TD",
        color: "#ff0000",
        inputCount: 8,
        outputCount: 4,
      });

      // Create and patch a channel to port 8
      const channelId = await t.mutation(api.inputChannels.create, {
        projectId,
        source: "Test Channel",
      });

      const deviceBefore = await t.query(api.ioDevices.getWithPorts, { ioDeviceId: deviceId });
      const port8 = deviceBefore?.inputPorts[7];

      await t.mutation(api.patching.patchInputChannel, {
        channelId,
        ioPortId: port8!._id,
      });

      // Decrease input count - should remove port 8 and clear channel ref
      await t.mutation(api.ioDevices.updatePortCounts, {
        ioDeviceId: deviceId,
        newInputCount: 4,
        newOutputCount: 4,
      });

      const device = await t.query(api.ioDevices.getWithPorts, { ioDeviceId: deviceId });
      expect(device?.inputPorts).toHaveLength(4);

      const channel = await t.query(api.inputChannels.get, { channelId });
      expect(channel?.ioPortId).toBeUndefined();
    });

    it("should add/remove output ports", async () => {
      const t = convexTest(schema, modules);
      const projectId = await setupProject(t);

      const deviceId = await t.mutation(api.ioDevices.create, {
        projectId,
        name: "Test Device",
        shortName: "TD",
        color: "#ff0000",
        inputCount: 4,
        outputCount: 4,
      });

      // Increase
      await t.mutation(api.ioDevices.updatePortCounts, {
        ioDeviceId: deviceId,
        newInputCount: 4,
        newOutputCount: 8,
      });

      let device = await t.query(api.ioDevices.getWithPorts, { ioDeviceId: deviceId });
      expect(device?.outputPorts).toHaveLength(8);

      // Decrease
      await t.mutation(api.ioDevices.updatePortCounts, {
        ioDeviceId: deviceId,
        newInputCount: 4,
        newOutputCount: 2,
      });

      device = await t.query(api.ioDevices.getWithPorts, { ioDeviceId: deviceId });
      expect(device?.outputPorts).toHaveLength(2);
    });

    it("should add/remove headphone ports (stereo pairs)", async () => {
      const t = convexTest(schema, modules);
      const projectId = await setupProject(t);

      const deviceId = await t.mutation(api.ioDevices.create, {
        projectId,
        name: "Test Device",
        shortName: "TD",
        color: "#ff0000",
        inputCount: 4,
        outputCount: 4,
        headphoneOutputCount: 1,
      });

      let device = await t.query(api.ioDevices.getWithPorts, { ioDeviceId: deviceId });
      expect(device?.headphonePorts).toHaveLength(2); // 1 pair

      // Add another HP pair
      await t.mutation(api.ioDevices.updatePortCounts, {
        ioDeviceId: deviceId,
        newInputCount: 4,
        newOutputCount: 4,
        newHeadphoneOutputCount: 2,
      });

      device = await t.query(api.ioDevices.getWithPorts, { ioDeviceId: deviceId });
      expect(device?.headphonePorts).toHaveLength(4); // 2 pairs

      // Remove a HP pair
      await t.mutation(api.ioDevices.updatePortCounts, {
        ioDeviceId: deviceId,
        newInputCount: 4,
        newOutputCount: 4,
        newHeadphoneOutputCount: 0,
      });

      device = await t.query(api.ioDevices.getWithPorts, { ioDeviceId: deviceId });
      expect(device?.headphonePorts).toHaveLength(0);
    });

    it("should add/remove AES ports", async () => {
      const t = convexTest(schema, modules);
      const projectId = await setupProject(t);

      const deviceId = await t.mutation(api.ioDevices.create, {
        projectId,
        name: "Test Device",
        shortName: "TD",
        color: "#ff0000",
        inputCount: 4,
        outputCount: 4,
      });

      // Add AES ports
      await t.mutation(api.ioDevices.updatePortCounts, {
        ioDeviceId: deviceId,
        newInputCount: 4,
        newOutputCount: 4,
        newAesInputCount: 2,
        newAesOutputCount: 1,
      });

      let device = await t.query(api.ioDevices.getWithPorts, { ioDeviceId: deviceId });
      expect(device?.aesInputPorts).toHaveLength(4); // 2 pairs
      expect(device?.aesOutputPorts).toHaveLength(2); // 1 pair

      // Remove AES ports
      await t.mutation(api.ioDevices.updatePortCounts, {
        ioDeviceId: deviceId,
        newInputCount: 4,
        newOutputCount: 4,
        newAesInputCount: 0,
        newAesOutputCount: 0,
      });

      device = await t.query(api.ioDevices.getWithPorts, { ioDeviceId: deviceId });
      expect(device?.aesInputPorts).toHaveLength(0);
      expect(device?.aesOutputPorts).toHaveLength(0);
    });

    it("should recalculate port numbers when counts change", async () => {
      const t = convexTest(schema, modules);
      const projectId = await setupProject(t);

      const deviceId = await t.mutation(api.ioDevices.create, {
        projectId,
        name: "Test Device",
        shortName: "TD",
        color: "#ff0000",
        inputCount: 4,
        outputCount: 4,
        headphoneOutputCount: 1,
        aesOutputCount: 1,
      });

      // HP ports should be 5-6, AES output ports should be 7-8
      let device = await t.query(api.ioDevices.getWithPorts, { ioDeviceId: deviceId });
      expect(device?.headphonePorts.map((p) => p.portNumber)).toEqual([5, 6]);
      expect(device?.aesOutputPorts.map((p) => p.portNumber)).toEqual([7, 8]);

      // Change output count - should recalculate HP and AES port numbers
      await t.mutation(api.ioDevices.updatePortCounts, {
        ioDeviceId: deviceId,
        newInputCount: 4,
        newOutputCount: 8,
        newHeadphoneOutputCount: 1,
        newAesOutputCount: 1,
      });

      device = await t.query(api.ioDevices.getWithPorts, { ioDeviceId: deviceId });
      expect(device?.outputPorts).toHaveLength(8);
      // HP ports should now be 9-10, AES output ports should be 11-12
      expect(device?.headphonePorts.map((p) => p.portNumber)).toEqual([9, 10]);
      expect(device?.aesOutputPorts.map((p) => p.portNumber)).toEqual([11, 12]);
    });
  });

  describe("updatePortLabels", () => {
    it("should regenerate all labels with new shortName", async () => {
      const t = convexTest(schema, modules);
      const projectId = await setupProject(t);

      const deviceId = await t.mutation(api.ioDevices.create, {
        projectId,
        name: "Test Device",
        shortName: "OLD",
        color: "#ff0000",
        inputCount: 2,
        outputCount: 2,
        headphoneOutputCount: 1,
        aesInputCount: 1,
      });

      await t.mutation(api.ioDevices.updatePortLabels, {
        ioDeviceId: deviceId,
        newShortName: "NEW",
      });

      const device = await t.query(api.ioDevices.getWithPorts, { ioDeviceId: deviceId });
      expect(device?.inputPorts[0].label).toBe("NEW-I1");
      expect(device?.inputPorts[1].label).toBe("NEW-I2");
      expect(device?.outputPorts[0].label).toBe("NEW-O1");
      expect(device?.outputPorts[1].label).toBe("NEW-O2");
      expect(device?.headphonePorts[0].label).toBe("NEW-HP1L");
      expect(device?.headphonePorts[1].label).toBe("NEW-HP1R");
      expect(device?.aesInputPorts[0].label).toBe("NEW-AES1L");
      expect(device?.aesInputPorts[1].label).toBe("NEW-AES1R");
    });

    it("should preserve port metadata (headphoneNumber, aesNumber)", async () => {
      const t = convexTest(schema, modules);
      const projectId = await setupProject(t);

      const deviceId = await t.mutation(api.ioDevices.create, {
        projectId,
        name: "Test Device",
        shortName: "OLD",
        color: "#ff0000",
        inputCount: 2,
        outputCount: 2,
        headphoneOutputCount: 2,
        aesInputCount: 2,
      });

      await t.mutation(api.ioDevices.updatePortLabels, {
        ioDeviceId: deviceId,
        newShortName: "NEW",
      });

      const device = await t.query(api.ioDevices.getWithPorts, { ioDeviceId: deviceId });

      // HP ports should still have correct headphoneNumber
      expect(device?.headphonePorts[0].headphoneNumber).toBe(1);
      expect(device?.headphonePorts[1].headphoneNumber).toBe(1);
      expect(device?.headphonePorts[2].headphoneNumber).toBe(2);
      expect(device?.headphonePorts[3].headphoneNumber).toBe(2);

      // AES ports should still have correct aesNumber
      expect(device?.aesInputPorts[0].aesNumber).toBe(1);
      expect(device?.aesInputPorts[1].aesNumber).toBe(1);
      expect(device?.aesInputPorts[2].aesNumber).toBe(2);
      expect(device?.aesInputPorts[3].aesNumber).toBe(2);
    });
  });

  describe("moveDevice", () => {
    it("should swap order correctly when moving up", async () => {
      const t = convexTest(schema, modules);
      const projectId = await setupProject(t);

      await t.mutation(api.ioDevices.create, {
        projectId,
        name: "Device 1",
        shortName: "D1",
        color: "#ff0000",
        inputCount: 4,
        outputCount: 4,
      });

      const deviceId2 = await t.mutation(api.ioDevices.create, {
        projectId,
        name: "Device 2",
        shortName: "D2",
        color: "#00ff00",
        inputCount: 4,
        outputCount: 4,
      });

      // Move device 2 up
      await t.mutation(api.ioDevices.moveDevice, {
        ioDeviceId: deviceId2,
        direction: "up",
      });

      const devices = await t.query(api.ioDevices.list, { projectId });
      expect(devices[0].name).toBe("Device 2");
      expect(devices[1].name).toBe("Device 1");
    });

    it("should swap order correctly when moving down", async () => {
      const t = convexTest(schema, modules);
      const projectId = await setupProject(t);

      const deviceId1 = await t.mutation(api.ioDevices.create, {
        projectId,
        name: "Device 1",
        shortName: "D1",
        color: "#ff0000",
        inputCount: 4,
        outputCount: 4,
      });

      await t.mutation(api.ioDevices.create, {
        projectId,
        name: "Device 2",
        shortName: "D2",
        color: "#00ff00",
        inputCount: 4,
        outputCount: 4,
      });

      // Move device 1 down
      await t.mutation(api.ioDevices.moveDevice, {
        ioDeviceId: deviceId1,
        direction: "down",
      });

      const devices = await t.query(api.ioDevices.list, { projectId });
      expect(devices[0].name).toBe("Device 2");
      expect(devices[1].name).toBe("Device 1");
    });

    it("should do nothing when moving first device up", async () => {
      const t = convexTest(schema, modules);
      const projectId = await setupProject(t);

      const deviceId1 = await t.mutation(api.ioDevices.create, {
        projectId,
        name: "Device 1",
        shortName: "D1",
        color: "#ff0000",
        inputCount: 4,
        outputCount: 4,
      });

      await t.mutation(api.ioDevices.create, {
        projectId,
        name: "Device 2",
        shortName: "D2",
        color: "#00ff00",
        inputCount: 4,
        outputCount: 4,
      });

      // Try to move first device up - should do nothing
      await t.mutation(api.ioDevices.moveDevice, {
        ioDeviceId: deviceId1,
        direction: "up",
      });

      const devices = await t.query(api.ioDevices.list, { projectId });
      expect(devices[0].name).toBe("Device 1");
      expect(devices[1].name).toBe("Device 2");
    });

    it("should do nothing when moving last device down", async () => {
      const t = convexTest(schema, modules);
      const projectId = await setupProject(t);

      await t.mutation(api.ioDevices.create, {
        projectId,
        name: "Device 1",
        shortName: "D1",
        color: "#ff0000",
        inputCount: 4,
        outputCount: 4,
      });

      const deviceId2 = await t.mutation(api.ioDevices.create, {
        projectId,
        name: "Device 2",
        shortName: "D2",
        color: "#00ff00",
        inputCount: 4,
        outputCount: 4,
      });

      // Try to move last device down - should do nothing
      await t.mutation(api.ioDevices.moveDevice, {
        ioDeviceId: deviceId2,
        direction: "down",
      });

      const devices = await t.query(api.ioDevices.list, { projectId });
      expect(devices[0].name).toBe("Device 1");
      expect(devices[1].name).toBe("Device 2");
    });
  });

  describe("reorderDevices", () => {
    it("should set order based on array position", async () => {
      const t = convexTest(schema, modules);
      const projectId = await setupProject(t);

      const deviceId1 = await t.mutation(api.ioDevices.create, {
        projectId,
        name: "Device 1",
        shortName: "D1",
        color: "#ff0000",
        inputCount: 4,
        outputCount: 4,
      });

      const deviceId2 = await t.mutation(api.ioDevices.create, {
        projectId,
        name: "Device 2",
        shortName: "D2",
        color: "#00ff00",
        inputCount: 4,
        outputCount: 4,
      });

      const deviceId3 = await t.mutation(api.ioDevices.create, {
        projectId,
        name: "Device 3",
        shortName: "D3",
        color: "#0000ff",
        inputCount: 4,
        outputCount: 4,
      });

      // Reverse the order
      await t.mutation(api.ioDevices.reorderDevices, {
        deviceIds: [deviceId3, deviceId2, deviceId1],
      });

      const devices = await t.query(api.ioDevices.list, { projectId });
      expect(devices[0].name).toBe("Device 3");
      expect(devices[1].name).toBe("Device 2");
      expect(devices[2].name).toBe("Device 1");
    });
  });

  describe("list", () => {
    it("should return devices sorted by order", async () => {
      const t = convexTest(schema, modules);
      const projectId = await setupProject(t);

      await t.mutation(api.ioDevices.create, {
        projectId,
        name: "Device A",
        shortName: "DA",
        color: "#ff0000",
        inputCount: 4,
        outputCount: 4,
      });

      await t.mutation(api.ioDevices.create, {
        projectId,
        name: "Device B",
        shortName: "DB",
        color: "#00ff00",
        inputCount: 4,
        outputCount: 4,
      });

      const devices = await t.query(api.ioDevices.list, { projectId });
      expect(devices).toHaveLength(2);
      expect(devices[0].name).toBe("Device A");
      expect(devices[1].name).toBe("Device B");
    });

    it("should return empty array for project with no devices", async () => {
      const t = convexTest(schema, modules);
      const projectId = await setupProject(t);

      const devices = await t.query(api.ioDevices.list, { projectId });
      expect(devices).toHaveLength(0);
    });
  });

  describe("listWithPorts", () => {
    it("should categorize ports by type correctly", async () => {
      const t = convexTest(schema, modules);
      const projectId = await setupProject(t);

      await t.mutation(api.ioDevices.create, {
        projectId,
        name: "Full Device",
        shortName: "FD",
        color: "#ff0000",
        inputCount: 4,
        outputCount: 4,
        headphoneOutputCount: 2,
        aesInputCount: 1,
        aesOutputCount: 1,
      });

      const devices = await t.query(api.ioDevices.listWithPorts, { projectId });
      expect(devices).toHaveLength(1);

      const device = devices[0];
      expect(device.inputPorts).toHaveLength(4);
      expect(device.outputPorts).toHaveLength(4);
      expect(device.headphonePorts).toHaveLength(4);
      expect(device.aesInputPorts).toHaveLength(2);
      expect(device.aesOutputPorts).toHaveLength(2);
    });
  });

  describe("getWithPorts", () => {
    it("should return single device with all port categories", async () => {
      const t = convexTest(schema, modules);
      const projectId = await setupProject(t);

      const deviceId = await t.mutation(api.ioDevices.create, {
        projectId,
        name: "Test Device",
        shortName: "TD",
        color: "#ff0000",
        inputCount: 4,
        outputCount: 4,
        headphoneOutputCount: 1,
        aesInputCount: 1,
        aesOutputCount: 1,
      });

      const device = await t.query(api.ioDevices.getWithPorts, { ioDeviceId: deviceId });
      expect(device).not.toBeNull();
      expect(device?.inputPorts).toHaveLength(4);
      expect(device?.outputPorts).toHaveLength(4);
      expect(device?.headphonePorts).toHaveLength(2);
      expect(device?.aesInputPorts).toHaveLength(2);
      expect(device?.aesOutputPorts).toHaveLength(2);
    });

    it("should return null for deleted device", async () => {
      const t = convexTest(schema, modules);
      const projectId = await setupProject(t);

      // Create and then delete a device
      const deviceId = await t.mutation(api.ioDevices.create, {
        projectId,
        name: "To Delete",
        shortName: "TD",
        color: "#ff0000",
        inputCount: 2,
        outputCount: 2,
      });

      await t.mutation(api.ioDevices.remove, { ioDeviceId: deviceId });

      const device = await t.query(api.ioDevices.getWithPorts, { ioDeviceId: deviceId });
      expect(device).toBeNull();
    });
  });

  describe("listAllPorts", () => {
    it("should return flat list with device metadata", async () => {
      const t = convexTest(schema, modules);
      const projectId = await setupProject(t);

      await t.mutation(api.ioDevices.create, {
        projectId,
        name: "Device 1",
        shortName: "D1",
        color: "#ff0000",
        inputCount: 2,
        outputCount: 2,
      });

      await t.mutation(api.ioDevices.create, {
        projectId,
        name: "Device 2",
        shortName: "D2",
        color: "#00ff00",
        inputCount: 2,
        outputCount: 2,
      });

      const ports = await t.query(api.ioDevices.listAllPorts, { projectId });

      // 2 devices × (2 inputs + 2 outputs) = 8 ports total
      expect(ports).toHaveLength(8);

      // Check that device metadata is included
      const d1Ports = ports.filter((p) => p.ioDeviceName === "Device 1");
      const d2Ports = ports.filter((p) => p.ioDeviceName === "Device 2");

      expect(d1Ports).toHaveLength(4);
      expect(d2Ports).toHaveLength(4);

      expect(d1Ports[0].ioDeviceColor).toBe("#ff0000");
      expect(d2Ports[0].ioDeviceColor).toBe("#00ff00");
    });
  });
});
