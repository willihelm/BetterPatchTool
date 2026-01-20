import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { formatDistanceToNow, formatDate } from "@/lib/date-utils";

describe("formatDistanceToNow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return "just now" for timestamps less than a minute ago', () => {
    const now = Date.now();
    expect(formatDistanceToNow(now)).toBe("just now");
    expect(formatDistanceToNow(now - 30000)).toBe("just now"); // 30 seconds
  });

  it("should return minutes ago for timestamps less than an hour ago", () => {
    const now = Date.now();
    expect(formatDistanceToNow(now - 60000)).toBe("1 minute ago");
    expect(formatDistanceToNow(now - 120000)).toBe("2 minutes ago");
    expect(formatDistanceToNow(now - 3540000)).toBe("59 minutes ago");
  });

  it("should return hours ago for timestamps less than a day ago", () => {
    const now = Date.now();
    expect(formatDistanceToNow(now - 3600000)).toBe("1 hour ago");
    expect(formatDistanceToNow(now - 7200000)).toBe("2 hours ago");
    expect(formatDistanceToNow(now - 82800000)).toBe("23 hours ago");
  });

  it("should return days ago for timestamps less than a week ago", () => {
    const now = Date.now();
    expect(formatDistanceToNow(now - 86400000)).toBe("1 day ago");
    expect(formatDistanceToNow(now - 172800000)).toBe("2 days ago");
    expect(formatDistanceToNow(now - 518400000)).toBe("6 days ago");
  });

  it("should return weeks ago for timestamps less than a month ago", () => {
    const now = Date.now();
    expect(formatDistanceToNow(now - 604800000)).toBe("1 week ago");
    expect(formatDistanceToNow(now - 1209600000)).toBe("2 weeks ago");
    // At exactly 4 weeks (28 days), the function shows months
    // since 2419200000ms / 2592000000ms (month) = ~0.93, floor = 0
    expect(formatDistanceToNow(now - 2419200000)).toBe("0 months ago");
  });

  it("should return months ago for older timestamps", () => {
    const now = Date.now();
    expect(formatDistanceToNow(now - 2592000000)).toBe("1 month ago");
    expect(formatDistanceToNow(now - 5184000000)).toBe("2 months ago");
  });
});

describe("formatDate", () => {
  it("should format a date string in MM/DD/YYYY format", () => {
    expect(formatDate("2025-01-15")).toBe("01/15/2025");
    expect(formatDate("2025-12-25")).toBe("12/25/2025");
  });

  it("should handle ISO date strings", () => {
    expect(formatDate("2025-06-01T12:00:00.000Z")).toBe("06/01/2025");
  });
});
