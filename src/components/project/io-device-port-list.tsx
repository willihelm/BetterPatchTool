"use client";

import { Card } from "@/components/ui/card";
import type { IOPort } from "@/types/convex";

interface PortUsageEntry {
  channelType: "input" | "output";
  channelId: string;
  channelName: string;
  channelNumber: number;
  stereoSide?: "L" | "R";
}

type PortUsageInfo = PortUsageEntry[];

interface IODevicePortListProps {
  ports: IOPort[];
  portUsageMap: Record<string, PortUsageInfo | PortUsageEntry>;
  deviceColor: string;
}

// Normalize port usage - handles both old single-object format and new array format
function normalizeUsage(usage: PortUsageInfo | PortUsageEntry | undefined): PortUsageEntry[] {
  if (!usage) return [];
  if (!Array.isArray(usage)) return [usage];
  return usage;
}

// Format channel names for display: show first name + asterisk if more than 1 + L/R for stereo
function formatChannelDisplay(usage: PortUsageInfo | PortUsageEntry | undefined): string {
  const normalized = normalizeUsage(usage);
  if (normalized.length === 0) {
    return "";
  }

  // Filter to only channels with real names (not "Ch X" or "Output X" fallbacks)
  const withRealNames = normalized.filter(u =>
    !u.channelName.match(/^Ch \d+$/) && !u.channelName.match(/^Output \d+$/)
  );

  // Get stereo side from first entry (they should all have the same side for a given port)
  const stereoSuffix = normalized[0].stereoSide ? ` ${normalized[0].stereoSide}` : "";

  if (withRealNames.length === 0) {
    // No real names, show first channel's fallback name
    return normalized[0].channelName + stereoSuffix;
  }

  // Get unique names
  const uniqueNames = [...new Set(withRealNames.map(u => u.channelName))];

  // Show up to 2 names, with "..." if more than 2
  let baseName: string;
  if (uniqueNames.length === 1) {
    baseName = uniqueNames[0];
  } else if (uniqueNames.length === 2) {
    baseName = `${uniqueNames[0]}, ${uniqueNames[1]}`;
  } else {
    baseName = `${uniqueNames[0]}, ${uniqueNames[1]}...`;
  }
  return baseName + stereoSuffix;
}

export function IODevicePortList({ ports, portUsageMap, deviceColor }: IODevicePortListProps) {
  if (ports.length === 0) {
    return (
      <Card className="p-4">
        <p className="text-sm text-muted-foreground text-center">No ports available</p>
      </Card>
    );
  }

  return (
    <Card className="divide-y">
      {ports.map((port) => {
        const usage = portUsageMap[port._id];
        const normalized = normalizeUsage(usage);
        const displayName = formatChannelDisplay(usage);
        const firstChannel = normalized[0];
        return (
          <div key={port._id} className="flex items-center px-4 py-3">
            <div
              className="w-1 h-8 rounded-full mr-4"
              style={{ backgroundColor: deviceColor }}
            />
            <div className="flex-1 min-w-0">
              <span className="font-mono text-sm">{port.label}</span>
            </div>
            <div className="text-sm text-right">
              {firstChannel ? (
                <span className="text-foreground">
                  Ch {firstChannel.channelNumber}: {displayName}
                </span>
              ) : (
                <span className="text-muted-foreground">Unassigned</span>
              )}
            </div>
          </div>
        );
      })}
    </Card>
  );
}
