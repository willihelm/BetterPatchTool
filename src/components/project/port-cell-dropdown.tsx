"use client";

import { createContext, useContext } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { usePortData, isPortUsedByOther, getPortUsageDisplayName, type PortGroup } from "./port-data-context";

// Context for port dropdown state - avoids column recreation
export interface PortDropdownContextValue {
  openRowId: string | null;
  setOpenRowId: (id: string | null) => void;
  refocusGrid: () => void;
}
export const PortDropdownContext = createContext<PortDropdownContextValue | null>(null);

// Time window to block dropdown reopening after selection (ms)
export const SELECTION_BLOCK_WINDOW = 500;

// Module-level variable to track last selection time
// This persists across all component remounts and re-renders
export let lastPortSelectionTimestamp = 0;

export function setLastPortSelectionTimestamp(value: number) {
  lastPortSelectionTimestamp = value;
}

// Row shape required by PortCellDropdown
interface PortCellDropdownRow {
  _id: string;
  ioPortId?: string;
  ioPortIdRight?: string;
  isStereo?: boolean;
}

interface PortCellDropdownProps {
  row: PortCellDropdownRow;
  onSelect: (portId: string | null, portIdRight?: string | null) => void;
  portType: "input" | "output";
}

// Generate port pairs for stereo (consecutive ports)
function getPortPairs(ports: PortGroup["ports"]) {
  const pairs: Array<{
    left: PortGroup["ports"][0];
    right: PortGroup["ports"][0];
    label: string;
  }> = [];
  for (let i = 0; i < ports.length - 1; i++) {
    pairs.push({
      left: ports[i],
      right: ports[i + 1],
      label: `${ports[i].label} + ${ports[i + 1].label}`,
    });
  }
  return pairs;
}

export function PortCellDropdown({ row, onSelect, portType }: PortCellDropdownProps) {
  const dropdownContext = useContext(PortDropdownContext);
  const isOpen = dropdownContext?.openRowId === row._id;

  // Check if we're within the block window after a selection
  // Uses module-level variable to ensure it persists across all remounts
  const isWithinBlockWindow = () => {
    return Date.now() - lastPortSelectionTimestamp < SELECTION_BLOCK_WINDOW;
  };

  const onOpenChange = (open: boolean) => {
    // Prevent reopening immediately after a selection (handles Space keyup triggering button)
    if (open && isWithinBlockWindow()) {
      return;
    }
    dropdownContext?.setOpenRowId(open ? row._id : null);
  };
  const { portInfoMap, portUsageMap, inputPortGroups, outputPortGroups } = usePortData();
  const portGroups = portType === "input" ? inputPortGroups : outputPortGroups;
  const portInfo = row.ioPortId ? portInfoMap[row.ioPortId] : null;
  const portInfoRight = row.ioPortIdRight ? portInfoMap[row.ioPortIdRight] : null;

  const handleSelect = (portId: string | null, portIdRight?: string | null) => {
    onSelect(portId, portIdRight);
    // Set timestamp to prevent immediate reopen from Space keyup
    // Uses module-level variable to ensure it persists across all remounts
    setLastPortSelectionTimestamp(Date.now());
    onOpenChange(false);
    // Refocus grid to restore arrow key navigation
    dropdownContext?.refocusGrid();
  };

  // Prevent arrow keys on trigger from opening dropdown - navigate by clicking target cell
  const handleTriggerKeyDown = (e: React.KeyboardEvent) => {
    // Block Space/Enter keydown if we just selected (prevents Radix from activating)
    if (isWithinBlockWindow() && (e.key === " " || e.key === "Enter")) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      e.stopPropagation();

      // Find current cell position in the grid
      const trigger = e.currentTarget as HTMLElement;
      const currentCell = trigger.closest('[role="gridcell"]');
      if (!currentCell) return;

      const currentRow = currentCell.closest('[role="row"]');
      if (!currentRow) return;

      const key = e.key;
      const cellIndex = Array.from(currentRow.children).indexOf(currentCell);
      const grid = currentRow.closest('[role="grid"]');
      if (!grid) return;

      const allRows = Array.from(grid.querySelectorAll('[role="row"]'));
      const currentRowIndex = allRows.indexOf(currentRow as Element);

      requestAnimationFrame(() => {
        let targetRowIndex = currentRowIndex;
        let targetCellIndex = cellIndex;

        if (key === "ArrowDown") {
          targetRowIndex = currentRowIndex + 1;
        } else if (key === "ArrowUp") {
          targetRowIndex = currentRowIndex - 1;
        } else if (key === "ArrowLeft") {
          targetCellIndex = cellIndex - 1;
        } else if (key === "ArrowRight") {
          targetCellIndex = cellIndex + 1;
        }

        // Re-query the grid in case DOM changed
        const gridEl = document.querySelector('[role="grid"]');
        if (!gridEl) return;

        const rows = gridEl.querySelectorAll('[role="row"]');
        const targetRow = rows[targetRowIndex];

        if (targetRow && targetCellIndex >= 0 && targetCellIndex < targetRow.children.length) {
          const targetCell = targetRow.children[targetCellIndex] as HTMLElement;
          if (targetCell?.getAttribute('role') === 'gridcell') {
            targetCell.click();
          }
        }
      });
    }
  };

  // Block Space/Enter keyup after selection to prevent dropdown reopening
  const handleTriggerKeyUp = (e: React.KeyboardEvent) => {
    if (isWithinBlockWindow() && (e.key === " " || e.key === "Enter")) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  if (row.isStereo) {
    return (
      <DropdownMenu open={isOpen} onOpenChange={onOpenChange}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center justify-between h-full w-full px-2 cursor-pointer hover:bg-muted/50 rounded focus:outline-none"
            onKeyDown={handleTriggerKeyDown}
            onKeyUp={handleTriggerKeyUp}
          >
            <div className="flex flex-col gap-1 py-1 min-h-[48px] justify-center">
              {portInfo ? (
                <Badge
                  variant="outline"
                  className="font-mono text-xs"
                  style={{ borderColor: portInfo.deviceColor, color: portInfo.deviceColor }}
                >
                  {portInfo.label}
                </Badge>
              ) : (
                <span className="text-muted-foreground text-sm">-</span>
              )}
              {portInfoRight ? (
                <Badge
                  variant="outline"
                  className="font-mono text-xs"
                  style={{ borderColor: portInfoRight.deviceColor, color: portInfoRight.deviceColor }}
                >
                  {portInfoRight.label}
                </Badge>
              ) : (
                <span className="text-muted-foreground text-sm">-</span>
              )}
            </div>
            <ChevronDown className="h-4 w-4 opacity-50 flex-shrink-0" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuItem onClick={() => handleSelect(null, null)}>
            <span className="text-muted-foreground">None</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {portGroups
            .filter((group) => group.ports.length >= 2)
            .map((group) => {
              const pairs = getPortPairs(group.ports);
              if (pairs.length === 0) return null;
              return (
                <DropdownMenuSub key={group.device._id}>
                  <DropdownMenuSubTrigger className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: group.device.color }}
                    />
                    <span className="truncate">{group.device.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {pairs.length} pairs
                    </span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="max-h-64 overflow-y-auto min-w-44">
                    {pairs.map((pair) => {
                      const leftUsage = portUsageMap[pair.left._id];
                      const rightUsage = portUsageMap[pair.right._id];
                      const isLeftUsedByOther = isPortUsedByOther(leftUsage, row._id);
                      const isRightUsedByOther = isPortUsedByOther(rightUsage, row._id);
                      const isUsedByOther = isLeftUsedByOther || isRightUsedByOther;
                      const isCurrentPair = pair.left._id === row.ioPortId && pair.right._id === row.ioPortIdRight;
                      return (
                        <DropdownMenuItem
                          key={`${pair.left._id}-${pair.right._id}`}
                          onClick={() => handleSelect(pair.left._id, pair.right._id)}
                          className={cn(
                            "flex items-center justify-between gap-4",
                            isUsedByOther && "opacity-60",
                            isCurrentPair && "bg-accent"
                          )}
                        >
                          <span className="font-mono">{pair.label}</span>
                          {isUsedByOther && (
                            <span className="text-xs text-muted-foreground truncate max-w-24">
                              {isLeftUsedByOther && getPortUsageDisplayName(leftUsage)}
                              {isLeftUsedByOther && isRightUsedByOther && " / "}
                              {isRightUsedByOther && getPortUsageDisplayName(rightUsage)}
                            </span>
                          )}
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              );
            })}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Mono port selector
  return (
    <DropdownMenu open={isOpen} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center justify-between h-full w-full px-2 cursor-pointer hover:bg-muted/50 rounded focus:outline-none"
          onKeyDown={handleTriggerKeyDown}
          onKeyUp={handleTriggerKeyUp}
        >
          <div className="min-h-[24px] flex items-center">
            {portInfo ? (
              <Badge
                variant="outline"
                className="font-mono"
                style={{ borderColor: portInfo.deviceColor, color: portInfo.deviceColor }}
              >
                {portInfo.label}
              </Badge>
            ) : (
              <span className="text-muted-foreground">-</span>
            )}
          </div>
          <ChevronDown className="h-4 w-4 opacity-50 flex-shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuItem onClick={() => handleSelect(null)}>
          <span className="text-muted-foreground">None</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {portGroups
          .filter((group) => group.ports.length > 0)
          .map((group) => (
            <DropdownMenuSub key={group.device._id}>
              <DropdownMenuSubTrigger className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: group.device.color }}
                />
                <span className="truncate">{group.device.name}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {group.ports.length}
                </span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="max-h-64 overflow-y-auto min-w-40">
                {group.ports.map((port) => {
                  const usage = portUsageMap[port._id];
                  const isUsedByOther = isPortUsedByOther(usage, row._id);
                  const isCurrentPort = port._id === row.ioPortId;
                  const usageDisplayName = getPortUsageDisplayName(usage);
                  return (
                    <DropdownMenuItem
                      key={port._id}
                      onClick={() => handleSelect(port._id)}
                      className={cn(
                        "flex items-center justify-between gap-4",
                        isUsedByOther && "opacity-60",
                        isCurrentPort && "bg-accent"
                      )}
                    >
                      <span className="font-mono">{port.label}</span>
                      {isUsedByOther && (
                        <span
                          className="text-xs text-muted-foreground truncate max-w-20"
                          title={usageDisplayName}
                        >
                          {usageDisplayName}
                        </span>
                      )}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
