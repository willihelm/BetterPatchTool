"use client";

import type { IODevice, IOPort } from "@/types/convex";

interface PortUsageInfo {
  channelType: "input" | "output";
  channelId: string;
  channelName: string;
  channelNumber: number;
}

interface StageboxGridProps {
  device: IODevice;
  ports: IOPort[];
  portUsageMap: Record<string, PortUsageInfo>;
  portsPerRow: number;
}

export function StageboxGrid({ device, ports, portUsageMap, portsPerRow }: StageboxGridProps) {
  if (ports.length === 0) {
    return null;
  }

  // Split ports into rows
  const rows: IOPort[][] = [];
  for (let i = 0; i < ports.length; i += portsPerRow) {
    rows.push(ports.slice(i, i + portsPerRow));
  }

  return (
    <div className="mb-6">
      {/* Device header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h4 className="font-medium">{device.name} ({device.shortName})</h4>
          <span className="text-sm text-muted-foreground">
            - {ports.length} {ports[0]?.type === "input" ? "Inputs" : "Outputs"}
          </span>
        </div>
        <div
          className="w-16 h-2 rounded"
          style={{ backgroundColor: device.color }}
        />
      </div>

      {/* Port grid */}
      <div className="border rounded-lg overflow-hidden">
        {rows.map((row, rowIndex) => (
          <div
            key={rowIndex}
            className="grid border-b last:border-b-0"
            style={{
              gridTemplateColumns: `repeat(${portsPerRow}, minmax(0, 1fr))`,
            }}
          >
            {row.map((port) => {
              const usage = portUsageMap[port._id];
              return (
                <div
                  key={port._id}
                  className="border-r last:border-r-0 p-1.5 min-w-0"
                  style={{
                    borderLeftWidth: port.portNumber === 1 || (port.portNumber - 1) % portsPerRow === 0 ? 3 : undefined,
                    borderLeftColor: port.portNumber === 1 || (port.portNumber - 1) % portsPerRow === 0 ? device.color : undefined,
                  }}
                >
                  <div className="text-xs font-mono text-muted-foreground truncate">
                    {port.label}
                  </div>
                  <div
                    className={`text-sm truncate ${
                      usage ? "text-foreground font-medium" : "text-muted-foreground/50"
                    }`}
                    title={usage?.channelName}
                  >
                    {usage?.channelName || "—"}
                  </div>
                </div>
              );
            })}
            {/* Fill empty cells in last row */}
            {row.length < portsPerRow &&
              Array.from({ length: portsPerRow - row.length }).map((_, i) => (
                <div
                  key={`empty-${i}`}
                  className="border-r last:border-r-0 p-1.5 bg-muted/30"
                />
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}
