"use client";

import { useMemo, useCallback, useRef, useState, createContext, useContext } from "react";
import DataGrid, { type Column, type RenderCellProps, textEditor } from "react-data-grid";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
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
import { Plus, MoreVertical, ChevronUp, ChevronDown, Trash2, Check, Zap, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { usePortData, isPortUsedByOther, getPortUsageDisplayName } from "./port-data-context";
import { useChannelSelection } from "./use-channel-selection";
import { AutoPatchDialog } from "./auto-patch-dialog";
import { incrementTrailingNumber } from "@/lib/string-utils";

interface InputChannelTableProps {
  projectId: Id<"projects">;
}

interface ChannelRow {
  _id: string;
  channelNumber: number;
  ioPortId?: string;
  ioPortIdRight?: string;
  isStereo?: boolean;
  source: string;
  uhf: string;
  micInputDev: string;
  location: string;
  cable: string;
  stand: string;
  notes: string;
  patched: boolean;
}

// Context for port dropdown state - avoids column recreation
interface PortDropdownContextValue {
  openRowId: string | null;
  setOpenRowId: (id: string | null) => void;
  refocusGrid: () => void;
}
const PortDropdownContext = createContext<PortDropdownContextValue | null>(null);

// Time window to block dropdown reopening after selection (ms)
const SELECTION_BLOCK_WINDOW = 500;

// Module-level variable to track last selection time
// This persists across all component remounts and re-renders
let lastPortSelectionTimestamp = 0;

// Port cell with inline dropdown - opens on click, Enter, or Space (not on focus)
interface PortCellDropdownProps {
  row: ChannelRow;
  onSelect: (portId: string | null, portIdRight?: string | null) => void;
}

function PortCellDropdown({ row, onSelect }: PortCellDropdownProps) {
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
  const { portInfoMap, portUsageMap, inputPortGroups } = usePortData();
  const portInfo = row.ioPortId ? portInfoMap[row.ioPortId] : null;
  const portInfoRight = row.ioPortIdRight ? portInfoMap[row.ioPortIdRight] : null;

  // Generate port pairs for stereo (consecutive ports)
  const getPortPairs = (ports: typeof inputPortGroups[0]["ports"]) => {
    const pairs: Array<{
      left: typeof ports[0];
      right: typeof ports[0];
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
  };

  const handleSelect = (portId: string | null, portIdRight?: string | null) => {
    onSelect(portId, portIdRight);
    // Set timestamp to prevent immediate reopen from Space keyup
    // Uses module-level variable to ensure it persists across all remounts
    lastPortSelectionTimestamp = Date.now();
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
          {inputPortGroups
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
        {inputPortGroups
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

// Text cell renderer
function TextCell({ row, column }: RenderCellProps<ChannelRow>) {
  const value = row[column.key as keyof ChannelRow];
  return (
    <span className={!value ? "text-muted-foreground" : ""}>
      {value || "-"}
    </span>
  );
}

export function InputChannelTable({ projectId }: InputChannelTableProps) {
  const channels = useQuery(api.inputChannels.list, { projectId });
  const mixers = useQuery(api.mixers.list, { projectId });

  const createChannel = useMutation(api.inputChannels.create);
  const updateChannel = useMutation(api.inputChannels.update);
  const removeChannel = useMutation(api.inputChannels.remove);
  const moveChannel = useMutation(api.inputChannels.moveChannel);
  const patchChannel = useMutation(api.patching.patchInputChannel);
  const toggleStereoChannel = useMutation(api.inputChannels.toggleStereo);
  const clearAllPatched = useMutation(api.inputChannels.clearAllPatched);

  const [autoPatchDialogOpen, setAutoPatchDialogOpen] = useState(false);
  const [openPortDropdownRowId, setOpenPortDropdownRowId] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Get stereo mode from first mixer
  const firstMixer = mixers?.[0];
  const isStereoAvailable = firstMixer?.stereoMode === "true_stereo";

  // Multi-select for auto-patching
  const channelIds = channels?.map((c) => c._id) ?? [];
  const selection = useChannelSelection({ channelIds });

  // Convert channels to rows
  const rows: ChannelRow[] = useMemo(() => {
    if (!channels) return [];
    return channels.map((channel) => ({
      _id: channel._id,
      channelNumber: channel.channelNumber,
      ioPortId: channel.ioPortId,
      ioPortIdRight: channel.ioPortIdRight,
      isStereo: channel.isStereo,
      source: channel.source,
      uhf: channel.uhf ?? "",
      micInputDev: channel.micInputDev ?? "",
      location: channel.location ?? "",
      cable: channel.cable ?? "",
      stand: channel.stand ?? "",
      notes: channel.notes ?? "",
      patched: channel.patched,
    }));
  }, [channels]);

  // Handle row changes from the grid
  const handleRowsChange = useCallback((newRows: ChannelRow[], { indexes, column }: { indexes: number[]; column: Column<ChannelRow> }) => {
    for (const index of indexes) {
      const row = newRows[index];
      const originalRow = rows[index];
      if (!row || !originalRow) continue;

      const columnKey = column.key;

      // Handle port changes
      if (columnKey === "port") {
        if (row.isStereo) {
          patchChannel({
            channelId: row._id as Id<"inputChannels">,
            ioPortId: row.ioPortId as Id<"ioPorts"> | null ?? null,
            ioPortIdRight: row.ioPortIdRight as Id<"ioPorts"> | null ?? null,
          });
        } else {
          patchChannel({
            channelId: row._id as Id<"inputChannels">,
            ioPortId: row.ioPortId as Id<"ioPorts"> | null ?? null,
          });
        }
        continue;
      }

      // Handle text field changes
      const value = row[columnKey as keyof ChannelRow];
      const originalValue = originalRow[columnKey as keyof ChannelRow];
      if (value !== originalValue) {
        updateChannel({
          channelId: row._id as Id<"inputChannels">,
          [columnKey]: value || undefined,
        });
      }
    }
  }, [rows, patchChannel, updateChannel]);

  const togglePatched = useCallback(async (channelId: string, currentValue: boolean) => {
    await updateChannel({
      channelId: channelId as Id<"inputChannels">,
      patched: !currentValue,
    });
  }, [updateChannel]);

  const handleToggleStereo = useCallback(async (channelId: string) => {
    await toggleStereoChannel({ channelId: channelId as Id<"inputChannels"> });
  }, [toggleStereoChannel]);

  // Column definitions
  const columns: Column<ChannelRow>[] = useMemo(() => [
    {
      key: "select",
      name: "",
      width: 32,
      frozen: true,
      renderHeaderCell: () => (
        <input
          type="checkbox"
          checked={rows.length > 0 && selection.selectionCount === rows.length}
          onChange={(e) => {
            if (e.target.checked) {
              selection.selectAll();
            } else {
              selection.clearSelection();
            }
          }}
          className="h-4 w-4 rounded border-gray-300"
        />
      ),
      renderCell: ({ row }) => (
        <input
          type="checkbox"
          checked={selection.isSelected(row._id)}
          onChange={() => selection.toggleSelection(row._id)}
          onClick={(e) => {
            if (e.shiftKey && rows.length > 0) {
              const lastSelected = selection.getSelectedInOrder().at(-1);
              if (lastSelected) {
                selection.selectRange(lastSelected, row._id);
              }
            }
          }}
          className="h-4 w-4 rounded border-gray-300"
        />
      ),
    },
    {
      key: "channelNumber",
      name: "Ch#",
      width: 36,
      frozen: true,
      cellClass: "text-center font-mono text-sm",
      headerCellClass: "text-center",
    },
    {
      key: "port",
      name: "Port",
      width: 140,
      frozen: true,
      renderCell: ({ row }) => (
        <PortCellDropdown
          row={row}
          onSelect={(portId, portIdRight) => {
            patchChannel({
              channelId: row._id as Id<"inputChannels">,
              ioPortId: portId as Id<"ioPorts"> | null,
              ioPortIdRight: row.isStereo ? (portIdRight as Id<"ioPorts"> | null) : undefined,
            });
          }}
        />
      ),
    },
    {
      key: "source",
      name: "Source",
      minWidth: 120,
      frozen: true,
      renderCell: TextCell,
      renderEditCell: textEditor,
      editable: true,
    },
    {
      key: "uhf",
      name: "UHF",
      width: 96,
      renderCell: TextCell,
      renderEditCell: textEditor,
      editable: true,
    },
    {
      key: "micInputDev",
      name: "Mic/Input",
      minWidth: 100,
      renderCell: TextCell,
      renderEditCell: textEditor,
      editable: true,
    },
    {
      key: "location",
      name: "Location",
      width: 96,
      renderCell: TextCell,
      renderEditCell: textEditor,
      editable: true,
    },
    {
      key: "cable",
      name: "Cable",
      width: 96,
      renderCell: TextCell,
      renderEditCell: textEditor,
      editable: true,
    },
    {
      key: "stand",
      name: "Stand",
      width: 96,
      renderCell: TextCell,
      renderEditCell: textEditor,
      editable: true,
    },
    {
      key: "notes",
      name: "Notes",
      minWidth: 100,
      renderCell: TextCell,
      renderEditCell: textEditor,
      editable: true,
    },
    {
      key: "patched",
      name: "Patched",
      width: 72,
      headerCellClass: "text-center",
      renderHeaderCell: () => {
        const patchedCount = rows.filter((r) => r.patched).length;
        return (
          <div className="flex items-center justify-center gap-1">
            <span>Patched</span>
            {patchedCount > 0 && (
              <button
                onClick={() => clearAllPatched({ projectId })}
                className="h-5 w-5 rounded hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"
                title={`Clear all ${patchedCount} patched checkbox${patchedCount !== 1 ? "es" : ""}`}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        );
      },
      renderCell: ({ row }) => (
        <div className="flex justify-center">
          <button
            onClick={() => togglePatched(row._id, row.patched)}
            className={cn(
              "h-6 w-6 rounded border-2 flex items-center justify-center transition-colors",
              row.patched
                ? "bg-green-500 border-green-500 text-white"
                : "border-muted-foreground/30 hover:border-muted-foreground"
            )}
          >
            {row.patched && <Check className="h-4 w-4" />}
          </button>
        </div>
      ),
    },
    {
      key: "actions",
      name: "",
      width: 48,
      renderCell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 opacity-0 group-hover:opacity-100"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => moveChannel({ channelId: row._id as Id<"inputChannels">, direction: "up" })}>
              <ChevronUp className="mr-2 h-4 w-4" />
              Move Up
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => moveChannel({ channelId: row._id as Id<"inputChannels">, direction: "down" })}>
              <ChevronDown className="mr-2 h-4 w-4" />
              Move Down
            </DropdownMenuItem>
            {isStereoAvailable && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleToggleStereo(row._id)}>
                  {row.isStereo ? "Mono" : "Stereo"}
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => removeChannel({ channelId: row._id as Id<"inputChannels"> })}
              className="text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps -- openPortDropdownRowId excluded to prevent column recreation
], [rows, selection, isStereoAvailable, projectId, clearAllPatched, moveChannel, removeChannel, togglePatched, handleToggleStereo, patchChannel]);

  const columnIndexByKey = useMemo(() => {
    const indexByKey = new Map<string, number>();
    columns.forEach((column, index) => {
      indexByKey.set(column.key, index);
    });
    return indexByKey;
  }, [columns]);

  const handleAddChannel = async () => {
    await createChannel({
      projectId,
      source: "",
    });
  };

  // Custom key handlers for Alt+Arrow (move rows) and Alt+Enter (copy+increment)
  const handleCellKeyDown = useCallback((args: { row: ChannelRow; rowIdx: number; column: Column<ChannelRow>; mode: "SELECT" | "EDIT" }, event: React.KeyboardEvent<HTMLDivElement>) => {
    const { row, rowIdx, column, mode } = args;

    // Only handle in SELECT mode
    if (mode !== "SELECT") return;

    // Enter or Space on port column: Open dropdown
    // But block if we just made a selection (prevents key repeat from reopening)
    if ((event.key === "Enter" || event.key === " ") && column.key === "port") {
      event.preventDefault();
      event.stopPropagation();
      // Check if we're within the block window after a recent selection
      if (Date.now() - lastPortSelectionTimestamp < SELECTION_BLOCK_WINDOW) {
        return;
      }
      setOpenPortDropdownRowId(row._id);
      return;
    }

    // Alt+Arrow: Move row up/down
    if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      event.preventDefault();
      event.stopPropagation();
      const direction = event.key === "ArrowUp" ? "up" : "down";
      moveChannel({ channelId: row._id as Id<"inputChannels">, direction }).then(() => {
        // Refocus the grid after mutation to restore keyboard navigation
        requestAnimationFrame(() => {
          gridRef.current?.querySelector<HTMLDivElement>('[role="grid"]')?.focus();
        });
      });
      return;
    }

    // Alt+Enter: Copy value from cell above, increment, and move down
    if (event.altKey && event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      if (rowIdx > 0 && column.key !== "port" && column.key !== "select" && column.key !== "channelNumber" && column.key !== "patched" && column.key !== "actions") {
        const aboveRow = rows[rowIdx - 1];
        if (aboveRow) {
          const aboveValue = aboveRow[column.key as keyof ChannelRow];
          const valueStr = typeof aboveValue === "string" ? aboveValue : "";
          const newValue = incrementTrailingNumber(valueStr);
          const nextRowIdx = Math.min(rowIdx + 1, rows.length - 1);
          const colIdx = columnIndexByKey.get(column.key);
          if (colIdx === undefined) return;

          updateChannel({
            channelId: row._id as Id<"inputChannels">,
            [column.key]: newValue || undefined,
          }).then(() => {
            // After mutation completes, click on the target cell to establish proper focus
            // This simulates user clicking which properly restores keyboard navigation
            setTimeout(() => {
              const grid = gridRef.current?.querySelector('[role="grid"]');
              if (grid) {
                // Find the target row (accounting for header row at index 0)
                const rows = grid.querySelectorAll('[role="row"]');
                const targetRow = rows[nextRowIdx + 1]; // +1 for header row
                if (targetRow) {
                  const targetCell = targetRow.children[colIdx] as HTMLElement;
                  if (targetCell?.getAttribute('role') === 'gridcell') {
                    targetCell.click();
                  }
                }
              }
            }, 50);
          });
        }
      }
      return;
    }

    // Ctrl/Cmd+Shift+S: Toggle stereo
    if (isStereoAvailable && (event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "s") {
      event.preventDefault();
      event.stopPropagation();
      toggleStereoChannel({ channelId: row._id as Id<"inputChannels"> }).then(() => {
        requestAnimationFrame(() => {
          gridRef.current?.querySelector<HTMLDivElement>('[role="grid"]')?.focus();
        });
      });
      return;
    }

    // Delete/Backspace on port column: Clear port
    if ((event.key === "Delete" || event.key === "Backspace") && column.key === "port") {
      event.preventDefault();
      event.stopPropagation();
      patchChannel({
        channelId: row._id as Id<"inputChannels">,
        ioPortId: null,
        ioPortIdRight: row.isStereo ? null : undefined,
      }).then(() => {
        requestAnimationFrame(() => {
          gridRef.current?.querySelector<HTMLDivElement>('[role="grid"]')?.focus();
        });
      });
      return;
    }
  }, [rows, moveChannel, updateChannel, patchChannel, isStereoAvailable, toggleStereoChannel, columnIndexByKey]);

  // Row class for stereo and selection
  const rowClass = useCallback((row: ChannelRow) => {
    return cn(
      "group",
      row.isStereo && "stereo-row",
      selection.isSelected(row._id) && "selected"
    );
  }, [selection]);

  // Row height for stereo rows
  const rowHeight = useCallback((row: ChannelRow) => {
    return row.isStereo ? 64 : 40;
  }, []);

  if (channels === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-pulse text-muted-foreground">Loading channels...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">
          Input Channels ({channels.length})
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground hidden sm:inline">
            Tab/Enter navigate · F2 edit · Alt+↑↓ move · Alt+Enter copy+increment
          </span>
          <Button onClick={handleAddChannel} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add Channel
          </Button>
        </div>
      </div>

      {/* Selection toolbar */}
      {selection.hasSelection && (
        <div className="flex items-center gap-3 p-3 bg-primary/10 rounded-lg border border-primary/20">
          <span className="text-sm font-medium">
            {selection.selectionCount} channel{selection.selectionCount !== 1 ? "s" : ""} selected
          </span>
          <div className="flex-1" />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoPatchDialogOpen(true)}
          >
            <Zap className="mr-2 h-4 w-4" />
            Auto-Patch
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={selection.clearSelection}
          >
            <X className="mr-2 h-4 w-4" />
            Clear
          </Button>
        </div>
      )}

      <PortDropdownContext.Provider value={{
        openRowId: openPortDropdownRowId,
        setOpenRowId: setOpenPortDropdownRowId,
        refocusGrid: () => {
          requestAnimationFrame(() => {
            gridRef.current?.querySelector<HTMLDivElement>('[role="grid"]')?.focus();
          });
        },
      }}>
        <div ref={gridRef} className="border rounded-lg overflow-hidden">
          {rows.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No channels yet. Click &quot;Add Channel&quot; to get started.
            </div>
          ) : (
            <DataGrid
              columns={columns}
              rows={rows}
              rowKeyGetter={(row: ChannelRow) => row._id}
              onRowsChange={handleRowsChange}
              onCellKeyDown={handleCellKeyDown}
              rowClass={rowClass}
              rowHeight={rowHeight}
              headerRowHeight={40}
              className="rdg"
            />
          )}
        </div>
      </PortDropdownContext.Provider>

      <AutoPatchDialog
        open={autoPatchDialogOpen}
        onOpenChange={setAutoPatchDialogOpen}
        projectId={projectId}
        channelType="input"
        selectedChannelIds={selection.getSelectedInOrder()}
        onComplete={selection.clearSelection}
      />
    </div>
  );
}
