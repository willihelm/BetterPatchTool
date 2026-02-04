import { describe, it, expect } from "vitest";
import { diffRows } from "@/lib/snapshot-diff";

describe("snapshot-diff", () => {
  it("should detect added, removed, and modified rows", () => {
    const snapshot = [
      { order: 1, source: "Kick" },
      { order: 2, source: "Snare" },
      { order: 3, source: "Hat" },
    ];
    const current = [
      { order: 1, source: "Kick In" },
      { order: 3, source: "Hat" },
      { order: 4, source: "Tom" },
    ];

    const diffs = diffRows(snapshot, current, {
      label: (row) => row.source,
    });

    const statuses = diffs.map((diff) => [diff.order, diff.status]);
    expect(statuses).toEqual([
      [1, "modified"],
      [2, "removed"],
      [4, "added"],
    ]);
  });
});
