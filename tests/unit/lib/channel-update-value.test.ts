import { describe, expect, it } from "vitest";
import {
  normalizeInputUpdateValue,
  normalizeOutputUpdateValue,
} from "@/lib/channel-update-value";

describe("normalizeInputUpdateValue", () => {
  it("persists empty string for required source field", () => {
    expect(normalizeInputUpdateValue("source", "")).toBe("");
  });

  it("persists empty string for optional fields so clear works", () => {
    expect(normalizeInputUpdateValue("uhf", "")).toBe("");
    expect(normalizeInputUpdateValue("micInputDev", "")).toBe("");
    expect(normalizeInputUpdateValue("notes", "")).toBe("");
  });

  it("keeps non-empty values unchanged", () => {
    expect(normalizeInputUpdateValue("source", "Kick")).toBe("Kick");
    expect(normalizeInputUpdateValue("notes", "Lead vocal")).toBe("Lead vocal");
  });

  it("returns non-string values unchanged", () => {
    expect(normalizeInputUpdateValue("patched", true)).toBe(true);
    expect(normalizeInputUpdateValue("channelNumber", 12)).toBe(12);
  });
});

describe("normalizeOutputUpdateValue", () => {
  it("persists empty string for required busName and destination fields", () => {
    expect(normalizeOutputUpdateValue("busName", "")).toBe("");
    expect(normalizeOutputUpdateValue("destination", "")).toBe("");
  });

  it("persists empty string for optional fields so clear works", () => {
    expect(normalizeOutputUpdateValue("ampProcessor", "")).toBe("");
    expect(normalizeOutputUpdateValue("notes", "")).toBe("");
  });

  it("keeps non-empty values unchanged", () => {
    expect(normalizeOutputUpdateValue("busName", "Aux 1")).toBe("Aux 1");
    expect(normalizeOutputUpdateValue("destination", "Stage Left")).toBe("Stage Left");
  });

  it("returns non-string values unchanged", () => {
    expect(normalizeOutputUpdateValue("isStereo", false)).toBe(false);
    expect(normalizeOutputUpdateValue("rowNumber", 3)).toBe(3);
  });
});
