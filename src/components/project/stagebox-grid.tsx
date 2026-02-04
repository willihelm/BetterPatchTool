"use client";

import type { IODevice, IOPort } from "@/types/convex";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PortUsageEntry {
  channelType: "input" | "output";
  channelId: string;
  channelName: string;
  channelNumber: number;
  stereoSide?: "L" | "R";
}

type PortUsageInfo = PortUsageEntry[];

interface StageboxGridProps {
  device: IODevice;
  ports: IOPort[];
  portUsageMap: Record<string, PortUsageInfo>;
  portsPerRow: number;
  isHeadphone?: boolean;
  isAes?: boolean;
}

// Normalize port usage - handles both old single-object format and new array format
function normalizeUsage(usage: PortUsageInfo | PortUsageEntry | undefined): PortUsageEntry[] {
  if (!usage) return [];
  // Handle old single-object format (backwards compatibility)
  if (!Array.isArray(usage)) {
    return [usage];
  }
  return usage;
}

// Format channel names for display: show first name, add * if more than 1, add L/R for stereo
function formatChannelDisplay(usage: PortUsageInfo | PortUsageEntry | undefined): { displayText: string; tooltipText: string | null; hasRealName: boolean } {
  const normalized = normalizeUsage(usage);
  if (normalized.length === 0) {
    return { displayText: "—", tooltipText: null, hasRealName: false };
  }

  // Filter to only channels with real names (not "Ch X" or "Output X" fallbacks)
  const withRealNames = normalized.filter(u =>
    !u.channelName.match(/^Ch \d+$/) && !u.channelName.match(/^Output \d+$/)
  );

  // Get stereo side from first entry (they should all have the same side for a given port)
  const stereoSuffix = normalized[0].stereoSide ? ` ${normalized[0].stereoSide}` : "";

  if (withRealNames.length === 0) {
    // No real names, show first channel's fallback name
    return { displayText: normalized[0].channelName + stereoSuffix, tooltipText: null, hasRealName: false };
  }

  // Get unique names (in case same channel is assigned via left and right)
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
  const displayText = baseName + stereoSuffix;

  // Show tooltip with all names if more than 1
  const tooltipText = uniqueNames.length > 1 ? uniqueNames.join("\n") : null;

  return { displayText, tooltipText, hasRealName: true };
}

// Component to display channel name with optional tooltip
function ChannelNameDisplay({ usage, className }: { usage: PortUsageInfo | PortUsageEntry | undefined; className?: string }) {
  const normalized = normalizeUsage(usage);
  const { displayText, tooltipText, hasRealName } = formatChannelDisplay(usage);
  const hasUsage = normalized.length > 0;

  const content = (
    <div
      className={`text-sm truncate ${
        hasUsage && hasRealName ? "text-foreground font-medium" : "text-muted-foreground/50"
      } ${className || ""}`}
    >
      {displayText}
    </div>
  );

  if (tooltipText) {
    return (
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            {content}
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <div className="whitespace-pre-line text-sm">{tooltipText}</div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return content;
}

// Mobile-responsive column count based on configured portsPerRow
function getMobileColumns(portsPerRow: number): number {
  // On mobile, show 4 columns max for readability
  return Math.min(portsPerRow, 4);
}

export function StageboxGrid({ device, ports, portUsageMap, portsPerRow, isHeadphone = false, isAes = false }: StageboxGridProps) {
  if (ports.length === 0) {
    return null;
  }

  const mobileColumns = getMobileColumns(portsPerRow);

  // For headphone ports, render as individual ports in regular grid
  if (isHeadphone) {
    // Sort ports for consistent display
    const sortedPorts = [...ports].sort((a, b) => {
      const aNum = a.headphoneNumber ?? 0;
      const bNum = b.headphoneNumber ?? 0;
      if (aNum !== bNum) return aNum - bNum;
      // Put left before right
      const aIsLeft = a.subType === "headphone_left" ? 0 : 1;
      const bIsLeft = b.subType === "headphone_left" ? 0 : 1;
      return aIsLeft - bIsLeft;
    });

    // Split into rows - use mobile-friendly column count on small screens
    const rows: IOPort[][] = [];
    for (let i = 0; i < sortedPorts.length; i += portsPerRow) {
      rows.push(sortedPorts.slice(i, i + portsPerRow));
    }

    // For mobile, we'll also create rows with fewer columns
    const mobileRows: IOPort[][] = [];
    for (let i = 0; i < sortedPorts.length; i += mobileColumns) {
      mobileRows.push(sortedPorts.slice(i, i + mobileColumns));
    }

    const pairCount = sortedPorts.filter(p => p.subType === "headphone_left").length;

    return (
      <div className="mb-6">
        {/* Device header - responsive for mobile */}
        <div className="flex items-center justify-between mb-2 gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <h4 className="font-medium text-sm sm:text-base">{device.name}</h4>
            <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
              ({device.shortName}) - {pairCount} HP {pairCount === 1 ? "Pair" : "Pairs"}
            </span>
          </div>
          <div
            className="w-8 sm:w-16 h-2 rounded flex-shrink-0"
            style={{ backgroundColor: device.color }}
          />
        </div>

        {/* Mobile port grid - visible on small screens */}
        <div className="border rounded-lg overflow-hidden sm:hidden">
          {mobileRows.map((row, rowIndex) => (
            <div
              key={rowIndex}
              className="grid border-b last:border-b-0"
              style={{
                gridTemplateColumns: `repeat(${mobileColumns}, minmax(0, 1fr))`,
              }}
            >
              {row.map((port) => {
                const usage = portUsageMap[port._id];
                const isFirstInRow = sortedPorts.indexOf(port) % mobileColumns === 0;
                return (
                  <div
                    key={port._id}
                    className="border-r last:border-r-0 p-2 min-w-0"
                    style={{
                      borderLeftWidth: isFirstInRow ? 3 : undefined,
                      borderLeftColor: isFirstInRow ? device.color : undefined,
                    }}
                  >
                    <div className="text-xs font-mono text-muted-foreground truncate">
                      {port.label}
                    </div>
                    <ChannelNameDisplay usage={usage} />
                  </div>
                );
              })}
              {/* Fill empty cells in last row */}
              {row.length < mobileColumns &&
                Array.from({ length: mobileColumns - row.length }).map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    className="border-r last:border-r-0 p-2 bg-muted/30"
                  />
                ))}
            </div>
          ))}
        </div>

        {/* Desktop port grid - hidden on small screens */}
        <div className="border rounded-lg overflow-hidden hidden sm:block">
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
                const portIndex = sortedPorts.indexOf(port);
                return (
                  <div
                    key={port._id}
                    className="border-r last:border-r-0 p-1.5 min-w-0"
                    style={{
                      borderLeftWidth: portIndex % portsPerRow === 0 ? 3 : undefined,
                      borderLeftColor: portIndex % portsPerRow === 0 ? device.color : undefined,
                    }}
                  >
                    <div className="text-xs font-mono text-muted-foreground truncate">
                      {port.label}
                    </div>
                    <ChannelNameDisplay usage={usage} />
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

  // For AES ports, render as individual ports in regular grid
  if (isAes) {
    // Sort ports for consistent display
    const sortedPorts = [...ports].sort((a, b) => {
      const aNum = a.aesNumber ?? 0;
      const bNum = b.aesNumber ?? 0;
      if (aNum !== bNum) return aNum - bNum;
      // Put left before right
      const aIsLeft = a.subType === "aes_left" ? 0 : 1;
      const bIsLeft = b.subType === "aes_left" ? 0 : 1;
      return aIsLeft - bIsLeft;
    });

    // Determine if these are inputs or outputs based on first port
    const isInput = ports[0]?.type === "input";
    const pairCount = sortedPorts.filter(p => p.subType === "aes_left").length;

    // Split into rows - use mobile-friendly column count on small screens
    const rows: IOPort[][] = [];
    for (let i = 0; i < sortedPorts.length; i += portsPerRow) {
      rows.push(sortedPorts.slice(i, i + portsPerRow));
    }

    // For mobile, we'll also create rows with fewer columns
    const mobileRows: IOPort[][] = [];
    for (let i = 0; i < sortedPorts.length; i += mobileColumns) {
      mobileRows.push(sortedPorts.slice(i, i + mobileColumns));
    }

    return (
      <div className="mb-6">
        {/* Device header - responsive for mobile */}
        <div className="flex items-center justify-between mb-2 gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <h4 className="font-medium text-sm sm:text-base">{device.name}</h4>
            <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
              ({device.shortName}) - {pairCount} AES {pairCount === 1 ? "Pair" : "Pairs"}
            </span>
          </div>
          <div
            className="w-8 sm:w-16 h-2 rounded flex-shrink-0"
            style={{ backgroundColor: device.color }}
          />
        </div>

        {/* Mobile port grid - visible on small screens */}
        <div className="border rounded-lg overflow-hidden sm:hidden">
          {mobileRows.map((row, rowIndex) => (
            <div
              key={rowIndex}
              className="grid border-b last:border-b-0"
              style={{
                gridTemplateColumns: `repeat(${mobileColumns}, minmax(0, 1fr))`,
              }}
            >
              {row.map((port) => {
                const usage = portUsageMap[port._id];
                const isFirstInRow = sortedPorts.indexOf(port) % mobileColumns === 0;
                return (
                  <div
                    key={port._id}
                    className="border-r last:border-r-0 p-2 min-w-0"
                    style={{
                      borderLeftWidth: isFirstInRow ? 3 : undefined,
                      borderLeftColor: isFirstInRow ? device.color : undefined,
                    }}
                  >
                    <div className="text-xs font-mono text-muted-foreground truncate">
                      {port.label}
                    </div>
                    <ChannelNameDisplay usage={usage} />
                  </div>
                );
              })}
              {/* Fill empty cells in last row */}
              {row.length < mobileColumns &&
                Array.from({ length: mobileColumns - row.length }).map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    className="border-r last:border-r-0 p-2 bg-muted/30"
                  />
                ))}
            </div>
          ))}
        </div>

        {/* Desktop port grid - hidden on small screens */}
        <div className="border rounded-lg overflow-hidden hidden sm:block">
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
                const portIndex = sortedPorts.indexOf(port);
                return (
                  <div
                    key={port._id}
                    className="border-r last:border-r-0 p-1.5 min-w-0"
                    style={{
                      borderLeftWidth: portIndex % portsPerRow === 0 ? 3 : undefined,
                      borderLeftColor: portIndex % portsPerRow === 0 ? device.color : undefined,
                    }}
                  >
                    <div className="text-xs font-mono text-muted-foreground truncate">
                      {port.label}
                    </div>
                    <ChannelNameDisplay usage={usage} />
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

  // Split ports into rows - use mobile-friendly column count on small screens
  // We'll render with CSS-based responsive columns
  const rows: IOPort[][] = [];
  for (let i = 0; i < ports.length; i += portsPerRow) {
    rows.push(ports.slice(i, i + portsPerRow));
  }

  // For mobile, we'll also create rows with fewer columns
  const mobileRows: IOPort[][] = [];
  for (let i = 0; i < ports.length; i += mobileColumns) {
    mobileRows.push(ports.slice(i, i + mobileColumns));
  }

  return (
    <div className="mb-6">
      {/* Device header - responsive for mobile */}
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <h4 className="font-medium text-sm sm:text-base">{device.name}</h4>
          <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
            ({device.shortName}) - {ports.length} {ports[0]?.type === "input" ? "Inputs" : "Outputs"}
          </span>
        </div>
        <div
          className="w-8 sm:w-16 h-2 rounded flex-shrink-0"
          style={{ backgroundColor: device.color }}
        />
      </div>

      {/* Mobile port grid - visible on small screens */}
      <div className="border rounded-lg overflow-hidden sm:hidden">
        {mobileRows.map((row, rowIndex) => (
          <div
            key={rowIndex}
            className="grid border-b last:border-b-0"
            style={{
              gridTemplateColumns: `repeat(${mobileColumns}, minmax(0, 1fr))`,
            }}
          >
            {row.map((port) => {
              const usage = portUsageMap[port._id];
              const isFirstInRow = (port.portNumber - 1) % mobileColumns === 0;
              return (
                <div
                  key={port._id}
                  className="border-r last:border-r-0 p-2 min-w-0"
                  style={{
                    borderLeftWidth: isFirstInRow ? 3 : undefined,
                    borderLeftColor: isFirstInRow ? device.color : undefined,
                  }}
                >
                  <div className="text-xs font-mono text-muted-foreground truncate">
                    {port.label}
                  </div>
                  <ChannelNameDisplay usage={usage} />
                </div>
              );
            })}
            {/* Fill empty cells in last row */}
            {row.length < mobileColumns &&
              Array.from({ length: mobileColumns - row.length }).map((_, i) => (
                <div
                  key={`empty-${i}`}
                  className="border-r last:border-r-0 p-2 bg-muted/30"
                />
              ))}
          </div>
        ))}
      </div>

      {/* Desktop port grid - hidden on small screens */}
      <div className="border rounded-lg overflow-hidden hidden sm:block">
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
                  <ChannelNameDisplay usage={usage} />
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
