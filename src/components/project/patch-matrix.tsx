"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Check, Filter, ChevronDown } from "lucide-react";

interface PatchMatrixProps {
  projectId: Id<"projects">;
}

export function PatchMatrix({ projectId }: PatchMatrixProps) {
  const [channelType, setChannelType] = useState<"input" | "output">("input");
  const [activeCell, setActiveCell] = useState<{ row: number; col: number } | null>(null);
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null);
  const [showUnassignedOnly, setShowUnassignedOnly] = useState(false);
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<Set<string>>(new Set());
  const [isDeviceFilterInitialized, setIsDeviceFilterInitialized] = useState(false);
  const [diagonalAnchor, setDiagonalAnchor] = useState<{
    row: number;
    col: number;
    mode: "patch" | "unpatch";
  } | null>(null);
  const [isShiftHeld, setIsShiftHeld] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Queries
  const inputChannels = useQuery(api.inputChannels.list, { projectId });
  const outputChannels = useQuery(api.outputChannels.list, { projectId });
  const portGroups = useQuery(api.patching.getAvailablePorts, {
    projectId,
    portType: channelType,
  });

  // Mutations
  const patchInputChannel = useMutation(api.patching.patchInputChannel);
  const patchOutputChannel = useMutation(api.patching.patchOutputChannel);
  const batchPatchChannels = useMutation(api.patching.batchPatchChannels);

  const channels = channelType === "input" ? inputChannels : outputChannels;

  // Filter port groups by selected devices
  const filteredPortGroups = portGroups?.filter((group) =>
    selectedDeviceIds.has(group.device._id)
  ) ?? [];

  // Flatten ports for matrix columns
  const allPorts = filteredPortGroups.flatMap((group) =>
    group.ports.map((port) => ({
      ...port,
      device: group.device,
    }))
  );

  // Filter ports if showing unassigned only
  const visiblePorts = showUnassignedOnly
    ? allPorts.filter((port) => !port.isUsed)
    : allPorts;

  // Create a map of portId -> channelId for quick lookup
  const portToChannelMap = new Map<string, string>();
  channels?.forEach((channel) => {
    if (channel.ioPortId) {
      portToChannelMap.set(channel.ioPortId, channel._id);
    }
  });

  // Diagonal patching utilities
  const isValidDiagonal = useCallback(
    (start: { row: number; col: number }, end: { row: number; col: number }) => {
      const rowDelta = end.row - start.row;
      const colDelta = Math.abs(end.col - start.col);
      // Valid diagonal: same absolute delta, and going downward (rowDelta > 0)
      return rowDelta > 0 && rowDelta === colDelta;
    },
    []
  );

  const getDiagonalCells = useCallback(
    (start: { row: number; col: number }, end: { row: number; col: number }) => {
      const cells: { row: number; col: number }[] = [];
      const rowDelta = end.row - start.row;
      const colDirection = end.col > start.col ? 1 : -1;

      for (let i = 0; i <= rowDelta; i++) {
        cells.push({
          row: start.row + i,
          col: start.col + i * colDirection,
        });
      }
      return cells;
    },
    []
  );

  // Track Shift key state
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Shift") {
        setIsShiftHeld(true);
      }
      if (e.key === "Escape" && diagonalAnchor) {
        setDiagonalAnchor(null);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Shift") {
        setIsShiftHeld(false);
        setDiagonalAnchor(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [diagonalAnchor]);

  // Calculate preview cells for diagonal highlight
  const diagonalPreviewCells = useMemo(() => {
    if (!diagonalAnchor || !isShiftHeld || !hoveredCell) return new Set<string>();
    if (!isValidDiagonal(diagonalAnchor, hoveredCell)) return new Set<string>();

    const cells = getDiagonalCells(diagonalAnchor, hoveredCell);
    return new Set(cells.map((c) => `${c.row}-${c.col}`));
  }, [diagonalAnchor, isShiftHeld, hoveredCell, isValidDiagonal, getDiagonalCells]);

  const handleCellClick = useCallback(
    async (
      rowIndex: number,
      colIndex: number,
      portId: string,
      channelId: string,
      currentPortId: string | undefined,
      isShiftClick: boolean
    ) => {
      const isAssigned = currentPortId === portId;

      // Handle Shift+Click for diagonal patching
      if (isShiftClick && channels && visiblePorts.length > 0) {
        if (!diagonalAnchor) {
          // Set anchor - mode depends on whether the anchor cell is patched
          setDiagonalAnchor({
            row: rowIndex,
            col: colIndex,
            mode: isAssigned ? "unpatch" : "patch",
          });
          return;
        }

        // Check if valid diagonal from anchor
        const end = { row: rowIndex, col: colIndex };
        if (isValidDiagonal(diagonalAnchor, end)) {
          // Execute batch patch
          const cells = getDiagonalCells(diagonalAnchor, end);
          const patches = cells
            .filter((cell) => cell.row < channels.length && cell.col < visiblePorts.length)
            .map((cell) => ({
              channelId: channels[cell.row]._id,
              ioPortId: diagonalAnchor.mode === "patch" ? visiblePorts[cell.col]._id : null,
            }));

          if (patches.length > 0) {
            await batchPatchChannels({
              channelType,
              patches,
            });
          }
        }
        // Clear anchor after attempting diagonal (whether valid or not)
        setDiagonalAnchor(null);
        return;
      }

      // Normal click behavior
      if (channelType === "input") {
        await patchInputChannel({
          channelId: channelId as Id<"inputChannels">,
          ioPortId: isAssigned ? null : (portId as Id<"ioPorts">),
        });
      } else {
        await patchOutputChannel({
          channelId: channelId as Id<"outputChannels">,
          ioPortId: isAssigned ? null : (portId as Id<"ioPorts">),
        });
      }
    },
    [channelType, patchInputChannel, patchOutputChannel, batchPatchChannels, channels, visiblePorts, diagonalAnchor, isValidDiagonal, getDiagonalCells]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!activeCell || !channels?.length || !visiblePorts.length) return;

      const { row, col } = activeCell;

      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          setActiveCell({ row: Math.max(0, row - 1), col });
          break;
        case "ArrowDown":
          e.preventDefault();
          setActiveCell({ row: Math.min(channels.length - 1, row + 1), col });
          break;
        case "ArrowLeft":
          e.preventDefault();
          setActiveCell({ row, col: Math.max(0, col - 1) });
          break;
        case "ArrowRight":
          e.preventDefault();
          setActiveCell({ row, col: Math.min(visiblePorts.length - 1, col + 1) });
          break;
        case " ":
        case "Enter":
          e.preventDefault();
          const channel = channels[row];
          const port = visiblePorts[col];
          if (channel && port) {
            handleCellClick(row, col, port._id, channel._id, channel.ioPortId, e.shiftKey);
          }
          break;
        case "Escape":
          e.preventDefault();
          setActiveCell(null);
          setDiagonalAnchor(null);
          break;
      }
    },
    [activeCell, channels, visiblePorts, handleCellClick]
  );

  // Initialize active cell when data loads
  useEffect(() => {
    if (!activeCell && channels && channels.length > 0 && visiblePorts.length > 0) {
      setActiveCell({ row: 0, col: 0 });
    }
  }, [activeCell, channels, visiblePorts.length]);

  // Memoize device IDs to avoid resetting selection on port data changes
  const deviceIds = useMemo(() => {
    if (!portGroups) return [];
    return portGroups.map((g) => g.device._id).sort();
  }, [portGroups]);

  const deviceIdsKey = deviceIds.join(",");

  // Initialize device selection when port groups load
  useEffect(() => {
    if (deviceIds.length > 0 && !isDeviceFilterInitialized) {
      setSelectedDeviceIds(new Set(deviceIds));
      setIsDeviceFilterInitialized(true);
    }
  }, [deviceIds, isDeviceFilterInitialized]);

  // Handle device additions/removals (only when device list actually changes)
  useEffect(() => {
    if (deviceIds.length > 0 && isDeviceFilterInitialized) {
      const currentDeviceIds = new Set(deviceIds);
      setSelectedDeviceIds((prev) => {
        // Check if anything actually changed
        const prevIds = Array.from(prev).sort().join(",");
        const hasNewDevices = deviceIds.some((id) => !prev.has(id));
        const hasRemovedDevices = Array.from(prev).some((id) => !currentDeviceIds.has(id));

        if (!hasNewDevices && !hasRemovedDevices) {
          return prev; // No change needed
        }

        const next = new Set<string>();
        // Keep existing selections that still exist
        prev.forEach((id) => {
          if (currentDeviceIds.has(id)) {
            next.add(id);
          }
        });
        // Add any new devices
        deviceIds.forEach((id) => {
          if (!prev.has(id)) {
            next.add(id);
          }
        });
        return next;
      });
    }
  }, [deviceIdsKey, isDeviceFilterInitialized]);

  // Reset active cell if it becomes invalid after filtering
  useEffect(() => {
    if (activeCell && activeCell.col >= visiblePorts.length) {
      setActiveCell(
        visiblePorts.length > 0
          ? { row: activeCell.row, col: visiblePorts.length - 1 }
          : null
      );
    }
  }, [visiblePorts.length, activeCell]);

  // Device selection helper functions
  const toggleDevice = useCallback((deviceId: string) => {
    setSelectedDeviceIds((prev) => {
      const next = new Set(prev);
      if (next.has(deviceId)) {
        next.delete(deviceId);
      } else {
        next.add(deviceId);
      }
      return next;
    });
  }, []);

  const selectAllDevices = useCallback(() => {
    if (portGroups) {
      setSelectedDeviceIds(new Set(portGroups.map((g) => g.device._id)));
    }
  }, [portGroups]);

  const clearDeviceSelection = useCallback(() => {
    setSelectedDeviceIds(new Set());
  }, []);

  if (!channels || !portGroups) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-pulse text-muted-foreground">Loading matrix...</div>
      </div>
    );
  }

  if (channels.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No {channelType} channels yet. Add some channels to use the patch matrix.
      </div>
    );
  }

  if (allPorts.length === 0 && portGroups.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No IO devices with {channelType} ports. Add IO devices to use the patch matrix.
      </div>
    );
  }

  const noDevicesSelected = allPorts.length === 0 && portGroups.length > 0;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between gap-6">
        <div className="flex items-center gap-2">
          <Button
            variant={channelType === "input" ? "default" : "outline"}
            size="sm"
            onClick={() => setChannelType("input")}
          >
            Input Channels
          </Button>
          <Button
            variant={channelType === "output" ? "default" : "outline"}
            size="sm"
            onClick={() => setChannelType("output")}
          >
            Output Channels
          </Button>
        </div>
        <div className="flex items-center gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Filter className="h-4 w-4" />
                <span>Devices</span>
                <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
                  {selectedDeviceIds.size}/{portGroups.length}
                </Badge>
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem
                onClick={selectAllDevices}
                onSelect={(e) => e.preventDefault()}
                disabled={selectedDeviceIds.size === portGroups.length}
              >
                Select All
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={clearDeviceSelection}
                onSelect={(e) => e.preventDefault()}
                disabled={selectedDeviceIds.size === 0}
              >
                Clear All
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {portGroups.map((group) => (
                <DropdownMenuCheckboxItem
                  key={group.device._id}
                  checked={selectedDeviceIds.has(group.device._id)}
                  onCheckedChange={() => toggleDevice(group.device._id)}
                  onSelect={(e) => e.preventDefault()}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: group.device.color }}
                    />
                    <span className="truncate">{group.device.name}</span>
                    <Badge variant="outline" className="ml-auto text-xs">
                      {group.device.shortName}
                    </Badge>
                  </div>
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showUnassignedOnly}
              onChange={(e) => setShowUnassignedOnly(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            Show unassigned ports only
          </label>
          <span className="text-xs text-muted-foreground">
            Arrow keys navigate · Space/Enter toggle · Shift+Click diagonal · Esc deselect
          </span>
        </div>
      </div>

      {/* Matrix or Empty State */}
      {noDevicesSelected ? (
        <div className="text-center py-12 text-muted-foreground border rounded-lg">
          No devices selected. Use the Devices filter to select which devices to show.
        </div>
      ) : (
        <>
          <div
            ref={containerRef}
            className="border rounded-lg overflow-auto focus:outline-none max-h-[calc(100vh-300px)] select-none"
            tabIndex={0}
            onKeyDown={handleKeyDown}
            onMouseDown={(e) => {
              // Prevent text selection on Shift+Click
              if (e.shiftKey) {
                e.preventDefault();
              }
            }}
            onFocus={() => {
              if (!activeCell && channels.length > 0 && visiblePorts.length > 0) {
                setActiveCell({ row: 0, col: 0 });
              }
            }}
          >
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-10 bg-background">
            <tr>
              {/* Channel header cell */}
              <th className="sticky left-0 z-20 bg-muted/50 border-b border-r p-2 text-left text-xs font-medium min-w-[180px]">
                Channel
              </th>
              {/* Port headers */}
              {visiblePorts.map((port, colIndex) => {
                // Check if this is the first port of a device group
                const isFirstOfDevice =
                  colIndex === 0 ||
                  visiblePorts[colIndex - 1]?.device._id !== port.device._id;

                return (
                  <th
                    key={port._id}
                    className={cn(
                      "border-b p-2 text-center text-xs font-medium min-w-[50px] bg-muted/50 transition-colors",
                      isFirstOfDevice && "border-l-2",
                      (activeCell?.col === colIndex || hoveredCell?.col === colIndex) && "bg-primary/10"
                    )}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: port.device.color }}
                      />
                      <span className="font-mono text-[10px]">{port.label}</span>
                      {isFirstOfDevice && (
                        <span className="text-[9px] text-muted-foreground">
                          {port.device.shortName}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {channels.map((channel, rowIndex) => {
              const channelNumber = channelType === "input"
                ? (channel as { channelNumber?: number }).channelNumber ?? rowIndex + 1
                : rowIndex + 1;
              const channelName = channelType === "input"
                ? (channel as { source?: string }).source
                : (channel as { busName?: string }).busName;

              return (
                <tr key={channel._id}>
                  {/* Channel label cell */}
                  <td
                    className={cn(
                      "sticky left-0 z-10 border-r p-2 text-xs bg-background transition-colors",
                      (activeCell?.row === rowIndex || hoveredCell?.row === rowIndex) && "bg-primary/10"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-medium w-6 text-right">
                        {channelNumber}
                      </span>
                      <span className="text-muted-foreground truncate max-w-[140px]">
                        {channelName || "-"}
                      </span>
                    </div>
                  </td>
                  {/* Matrix cells */}
                  {visiblePorts.map((port, colIndex) => {
                    const isAssigned = channel.ioPortId === port._id;
                    const isActive =
                      activeCell?.row === rowIndex && activeCell?.col === colIndex;
                    const otherChannelId = portToChannelMap.get(port._id);
                    const isUsedByOther =
                      otherChannelId && otherChannelId !== channel._id;

                    // Check if this is the first port of a device group for border
                    const isFirstOfDevice =
                      colIndex === 0 ||
                      visiblePorts[colIndex - 1]?.device._id !== port.device._id;

                    // Crosshair highlighting
                    const isInCrosshair = hoveredCell && (
                      hoveredCell.row === rowIndex || hoveredCell.col === colIndex
                    );
                    const isHovered = hoveredCell?.row === rowIndex && hoveredCell?.col === colIndex;

                    // Diagonal anchor and preview highlighting
                    const isAnchor = diagonalAnchor?.row === rowIndex && diagonalAnchor?.col === colIndex;
                    const isInDiagonalPreview = diagonalPreviewCells.has(`${rowIndex}-${colIndex}`);

                    return (
                      <td
                        key={port._id}
                        className={cn(
                          "border p-0 text-center cursor-pointer transition-colors",
                          isFirstOfDevice && "border-l-2",
                          isActive && "ring-2 ring-primary ring-inset",
                          isAnchor && "ring-2 ring-amber-500 bg-amber-100/50 dark:bg-amber-900/30",
                          !isAnchor && isInDiagonalPreview && "bg-primary/25",
                          !isAnchor && !isInDiagonalPreview && (
                            isAssigned
                              ? "bg-primary/20"
                              : isUsedByOther
                              ? "bg-muted/30"
                              : isHovered
                              ? "bg-primary/15"
                              : isInCrosshair
                              ? "bg-muted/40"
                              : "hover:bg-muted/50"
                          )
                        )}
                        onClick={(e) => {
                          setActiveCell({ row: rowIndex, col: colIndex });
                          handleCellClick(rowIndex, colIndex, port._id, channel._id, channel.ioPortId, e.shiftKey);
                        }}
                        onMouseEnter={() => setHoveredCell({ row: rowIndex, col: colIndex })}
                        onMouseLeave={() => setHoveredCell(null)}
                      >
                        <div className="w-full h-8 flex items-center justify-center">
                          {isAssigned && (
                            <Check
                              className="h-4 w-4"
                              style={{ color: port.device.color }}
                            />
                          )}
                          {isUsedByOther && !isAssigned && (
                            <span className="text-xs text-muted-foreground">·</span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
          </table>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-6 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-primary/20 border rounded flex items-center justify-center">
                <Check className="h-3 w-3" />
              </div>
              <span>Assigned</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-muted/30 border rounded flex items-center justify-center">
                <span>·</span>
              </div>
              <span>Used by another channel</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border rounded" />
              <span>Available</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
