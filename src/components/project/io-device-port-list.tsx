"use client";

import { Card } from "@/components/ui/card";
import type { IOPort } from "@/types/convex";

interface PortUsageInfo {
  channelType: "input" | "output";
  channelId: string;
  channelName: string;
  channelNumber: number;
}

interface IODevicePortListProps {
  ports: IOPort[];
  portUsageMap: Record<string, PortUsageInfo>;
  deviceColor: string;
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
              {usage ? (
                <span className="text-foreground">
                  Ch {usage.channelNumber}: {usage.channelName}
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
