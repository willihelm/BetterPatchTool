/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("inventoryIODevices", () => {
  describe("CRUD", () => {
    it("should create and list inventory IO devices", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity({ subject: "test-user", issuer: "convex" });

      await asUser.mutation(api.inventoryIODevices.create, {
        name: "Rio 3224-D",
        shortName: "RIO1",
        color: "#ef4444",
        inputCount: 32,
        outputCount: 16,
      });

      await asUser.mutation(api.inventoryIODevices.create, {
        name: "Rio 1608-D",
        shortName: "RIO2",
        color: "#3b82f6",
        inputCount: 16,
        outputCount: 8,
      });

      const devices = await asUser.query(api.inventoryIODevices.list);
      expect(devices).toHaveLength(2);
      expect(devices[0].name).toBe("Rio 3224-D");
      expect(devices[1].name).toBe("Rio 1608-D");
    });

    it("should update inventory IO device", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity({ subject: "test-user", issuer: "convex" });

      const id = await asUser.mutation(api.inventoryIODevices.create, {
        name: "Old Name",
        shortName: "OLD",
        color: "#ef4444",
        inputCount: 32,
        outputCount: 16,
      });

      await asUser.mutation(api.inventoryIODevices.update, {
        id,
        name: "New Name",
        shortName: "NEW",
      });

      const devices = await asUser.query(api.inventoryIODevices.list);
      expect(devices[0].name).toBe("New Name");
      expect(devices[0].shortName).toBe("NEW");
    });

    it("should remove inventory IO device", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity({ subject: "test-user", issuer: "convex" });

      const id = await asUser.mutation(api.inventoryIODevices.create, {
        name: "To Delete",
        shortName: "DEL",
        color: "#ef4444",
        inputCount: 8,
        outputCount: 4,
      });

      await asUser.mutation(api.inventoryIODevices.remove, { id });

      const devices = await asUser.query(api.inventoryIODevices.list);
      expect(devices).toHaveLength(0);
    });
  });

  describe("ownership", () => {
    it("should not list other user's devices", async () => {
      const t = convexTest(schema, modules);
      const user1 = t.withIdentity({ subject: "user-1", issuer: "convex" });
      const user2 = t.withIdentity({ subject: "user-2", issuer: "convex" });

      await user1.mutation(api.inventoryIODevices.create, {
        name: "User1 Device",
        shortName: "U1",
        color: "#ef4444",
        inputCount: 8,
        outputCount: 4,
      });

      const user2Devices = await user2.query(api.inventoryIODevices.list);
      expect(user2Devices).toHaveLength(0);
    });

    it("should not allow updating other user's device", async () => {
      const t = convexTest(schema, modules);
      const user1 = t.withIdentity({ subject: "user-1", issuer: "convex" });
      const user2 = t.withIdentity({ subject: "user-2", issuer: "convex" });

      const id = await user1.mutation(api.inventoryIODevices.create, {
        name: "User1 Device",
        shortName: "U1",
        color: "#ef4444",
        inputCount: 8,
        outputCount: 4,
      });

      await expect(
        user2.mutation(api.inventoryIODevices.update, { id, name: "Hacked" })
      ).rejects.toThrow();
    });
  });

  describe("copyToProject", () => {
    it("should copy device to project with ports generated", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity({ subject: "test-user", issuer: "convex" });

      const invId = await asUser.mutation(api.inventoryIODevices.create, {
        name: "Stagebox A",
        shortName: "SBA",
        color: "#22c55e",
        inputCount: 8,
        outputCount: 4,
        headphoneOutputCount: 1,
        aesInputCount: 1,
        aesOutputCount: 1,
      });

      const projectId = await asUser.mutation(api.projects.create, {
        title: "Test Project",
      });

      const ioDeviceId = await asUser.mutation(api.inventoryIODevices.copyToProject, {
        id: invId,
        projectId,
      });

      expect(ioDeviceId).toBeDefined();

      // Verify the device was created in the project
      const devices = await asUser.query(api.ioDevices.list, { projectId });
      expect(devices).toHaveLength(1);
      expect(devices[0].name).toBe("Stagebox A");
      expect(devices[0].shortName).toBe("SBA");

      // Verify ports were generated
      const ports = await t.run(async (ctx) => {
        return await ctx.db
          .query("ioPorts")
          .withIndex("by_ioDevice", (q) => q.eq("ioDeviceId", ioDeviceId))
          .collect();
      });

      const regularInputs = ports.filter((p) => p.type === "input" && p.subType === "regular");
      const regularOutputs = ports.filter((p) => p.type === "output" && p.subType === "regular");
      const hpPorts = ports.filter((p) => p.subType === "headphone_left" || p.subType === "headphone_right");
      const aesInputPorts = ports.filter((p) => p.type === "input" && (p.subType === "aes_left" || p.subType === "aes_right"));
      const aesOutputPorts = ports.filter((p) => p.type === "output" && (p.subType === "aes_left" || p.subType === "aes_right"));

      expect(regularInputs).toHaveLength(8);
      expect(regularOutputs).toHaveLength(4);
      expect(hpPorts).toHaveLength(2); // 1 pair
      expect(aesInputPorts).toHaveLength(2); // 1 pair
      expect(aesOutputPorts).toHaveLength(2); // 1 pair
    });
  });

  describe("saveFromProject", () => {
    it("should save project device to inventory", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity({ subject: "test-user", issuer: "convex" });

      const projectId = await asUser.mutation(api.projects.create, {
        title: "Test Project",
      });

      const ioDeviceId = await asUser.mutation(api.ioDevices.create, {
        projectId,
        name: "Stage Right",
        shortName: "SR",
        color: "#f97316",
        inputCount: 16,
        outputCount: 8,
      });

      await asUser.mutation(api.inventoryIODevices.saveFromProject, {
        ioDeviceId,
      });

      const invDevices = await asUser.query(api.inventoryIODevices.list);
      expect(invDevices).toHaveLength(1);
      expect(invDevices[0].name).toBe("Stage Right");
      expect(invDevices[0].inputCount).toBe(16);
    });
  });
});
