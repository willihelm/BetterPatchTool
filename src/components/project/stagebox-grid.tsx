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
  isHeadphone?: boolean;
  isAes?: boolean;
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

  // For headphone ports, group into stereo pairs (L/R)
  if (isHeadphone) {
    // Group by headphoneNumber
    const pairs: { left: IOPort | undefined; right: IOPort | undefined; number: number }[] = [];
    const portsByNumber = new Map<number, { left?: IOPort; right?: IOPort }>();

    for (const port of ports) {
      const hpNum = port.headphoneNumber ?? 0;
      if (!portsByNumber.has(hpNum)) {
        portsByNumber.set(hpNum, {});
      }
      const pair = portsByNumber.get(hpNum)!;
      if (port.subType === "headphone_left") {
        pair.left = port;
      } else if (port.subType === "headphone_right") {
        pair.right = port;
      }
    }

    for (const [number, pair] of portsByNumber.entries()) {
      pairs.push({ left: pair.left, right: pair.right, number });
    }
    pairs.sort((a, b) => a.number - b.number);

    return (
      <div className="mb-6">
        {/* Device header - responsive for mobile */}
        <div className="flex items-center justify-between mb-2 gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <h4 className="font-medium text-sm sm:text-base">{device.name}</h4>
            <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
              ({device.shortName}) - {pairs.length} HP {pairs.length === 1 ? "Pair" : "Pairs"}
            </span>
          </div>
          <div
            className="w-8 sm:w-16 h-2 rounded flex-shrink-0"
            style={{ backgroundColor: device.color }}
          />
        </div>

        {/* Headphone pairs grid - responsive with horizontal scroll on mobile */}
        <div className="border rounded-lg overflow-x-auto">
          <div
            className="grid min-w-fit"
            style={{
              gridTemplateColumns: `repeat(${Math.min(pairs.length, 2)}, minmax(140px, 1fr))`,
            }}
          >
            {pairs.map((pair) => {
              const leftUsage = pair.left ? portUsageMap[pair.left._id] : undefined;
              const rightUsage = pair.right ? portUsageMap[pair.right._id] : undefined;
              return (
                <div
                  key={pair.number}
                  className="border-r last:border-r-0 border-b last:border-b-0 p-2 sm:p-3"
                  style={{
                    borderLeftWidth: 3,
                    borderLeftColor: device.color,
                  }}
                >
                  <div className="text-xs sm:text-sm font-mono text-muted-foreground mb-1">
                    HP{pair.number}
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {/* Left channel */}
                    <div className="text-center p-1 sm:p-1.5 bg-muted/30 rounded">
                      <div className="text-xs text-muted-foreground">L</div>
                      <div
                        className={`text-xs sm:text-sm truncate ${
                          leftUsage ? "text-foreground font-medium" : "text-muted-foreground/50"
                        }`}
                        title={leftUsage?.channelName}
                      >
                        {leftUsage?.channelName || "—"}
                      </div>
                    </div>
                    {/* Right channel */}
                    <div className="text-center p-1 sm:p-1.5 bg-muted/30 rounded">
                      <div className="text-xs text-muted-foreground">R</div>
                      <div
                        className={`text-xs sm:text-sm truncate ${
                          rightUsage ? "text-foreground font-medium" : "text-muted-foreground/50"
                        }`}
                        title={rightUsage?.channelName}
                      >
                        {rightUsage?.channelName || "—"}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // For AES ports, group into stereo pairs (L/R)
  if (isAes) {
    // Group by aesNumber
    const pairs: { left: IOPort | undefined; right: IOPort | undefined; number: number }[] = [];
    const portsByNumber = new Map<number, { left?: IOPort; right?: IOPort }>();

    for (const port of ports) {
      const aesNum = port.aesNumber ?? 0;
      if (!portsByNumber.has(aesNum)) {
        portsByNumber.set(aesNum, {});
      }
      const pair = portsByNumber.get(aesNum)!;
      if (port.subType === "aes_left") {
        pair.left = port;
      } else if (port.subType === "aes_right") {
        pair.right = port;
      }
    }

    for (const [number, pair] of portsByNumber.entries()) {
      pairs.push({ left: pair.left, right: pair.right, number });
    }
    pairs.sort((a, b) => a.number - b.number);

    // Determine if these are inputs or outputs based on first port
    const isInput = ports[0]?.type === "input";
    const labelPrefix = isInput ? "AES" : "AESO";

    return (
      <div className="mb-6">
        {/* Device header - responsive for mobile */}
        <div className="flex items-center justify-between mb-2 gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <h4 className="font-medium text-sm sm:text-base">{device.name}</h4>
            <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
              ({device.shortName}) - {pairs.length} {labelPrefix} {pairs.length === 1 ? "Pair" : "Pairs"}
            </span>
          </div>
          <div
            className="w-8 sm:w-16 h-2 rounded flex-shrink-0"
            style={{ backgroundColor: device.color }}
          />
        </div>

        {/* AES pairs grid - responsive with horizontal scroll on mobile */}
        <div className="border rounded-lg overflow-x-auto">
          <div
            className="grid min-w-fit"
            style={{
              gridTemplateColumns: `repeat(${Math.min(pairs.length, 2)}, minmax(140px, 1fr))`,
            }}
          >
            {pairs.map((pair) => {
              const leftUsage = pair.left ? portUsageMap[pair.left._id] : undefined;
              const rightUsage = pair.right ? portUsageMap[pair.right._id] : undefined;
              return (
                <div
                  key={pair.number}
                  className="border-r last:border-r-0 border-b last:border-b-0 p-2 sm:p-3"
                  style={{
                    borderLeftWidth: 3,
                    borderLeftColor: device.color,
                  }}
                >
                  <div className="text-xs sm:text-sm font-mono text-muted-foreground mb-1">
                    {labelPrefix}{pair.number}
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {/* Left channel */}
                    <div className="text-center p-1 sm:p-1.5 bg-muted/30 rounded">
                      <div className="text-xs text-muted-foreground">L</div>
                      <div
                        className={`text-xs sm:text-sm truncate ${
                          leftUsage ? "text-foreground font-medium" : "text-muted-foreground/50"
                        }`}
                        title={leftUsage?.channelName}
                      >
                        {leftUsage?.channelName || "—"}
                      </div>
                    </div>
                    {/* Right channel */}
                    <div className="text-center p-1 sm:p-1.5 bg-muted/30 rounded">
                      <div className="text-xs text-muted-foreground">R</div>
                      <div
                        className={`text-xs sm:text-sm truncate ${
                          rightUsage ? "text-foreground font-medium" : "text-muted-foreground/50"
                        }`}
                        title={rightUsage?.channelName}
                      >
                        {rightUsage?.channelName || "—"}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
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
