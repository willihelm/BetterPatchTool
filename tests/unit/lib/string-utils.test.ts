import { describe, it, expect } from "vitest";
import { incrementTrailingNumber } from "@/lib/string-utils";

describe("incrementTrailingNumber", () => {
  it("should increment a simple trailing number", () => {
    expect(incrementTrailingNumber("Vocal 1")).toBe("Vocal 2");
  });

  it("should increment multi-digit trailing numbers", () => {
    expect(incrementTrailingNumber("Tom 10")).toBe("Tom 11");
    expect(incrementTrailingNumber("Channel 99")).toBe("Channel 100");
  });

  it("should return the original string if no trailing number exists", () => {
    expect(incrementTrailingNumber("Guitar")).toBe("Guitar");
    expect(incrementTrailingNumber("Snare Top")).toBe("Snare Top");
  });

  it("should handle strings that are just numbers", () => {
    expect(incrementTrailingNumber("1")).toBe("2");
    expect(incrementTrailingNumber("42")).toBe("43");
  });

  it("should handle empty strings", () => {
    expect(incrementTrailingNumber("")).toBe("");
  });

  it("should only increment the trailing number, not numbers in the middle", () => {
    expect(incrementTrailingNumber("DI Box 2 Out 1")).toBe("DI Box 2 Out 2");
  });

  it("should handle strings with special characters before the number", () => {
    expect(incrementTrailingNumber("Vocal-1")).toBe("Vocal-2");
    expect(incrementTrailingNumber("Bus_3")).toBe("Bus_4");
  });

  it("should handle zero", () => {
    expect(incrementTrailingNumber("Channel 0")).toBe("Channel 1");
  });

  it("should not preserve leading zeros (current behavior)", () => {
    // Note: current implementation does not preserve leading zeros
    // This test documents the current behavior
    expect(incrementTrailingNumber("Track 01")).toBe("Track 2");
  });
});
