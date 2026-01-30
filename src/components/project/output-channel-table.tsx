"use client";

import { useMemo, useCallback, useRef, useState, createContext, useContext } from "react";
import DataGrid, { type Column, type RenderCellProps, textEditor, type CellSelectArgs } from "react-data-grid";
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
import { Plus, MoreVertical, ChevronUp, ChevronDown, Trash2, Zap, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { usePortData } from "./port-data-context";
import { useChannelSelection } from "./use-channel-selection";
import { AutoPatchDialog } from "./auto-patch-dialog";
import { incrementTrailingNumber } from "@/lib/string-utils";

interface OutputChannelTableProps {
  projectId: Id<"projects">;
}

interface ChannelRow {
  _id: string;
  rowNumber: number;
  ioPortId?: string;
  ioPortIdRight?: string;
  isStereo?: boolean;
  busName: string;
  destination: string;
  ampProcessor: string;
  location: string;
  cable: string;
  notes: string;
}

// Context for port dropdown state - avoids column recreation
interface PortDropdownContextValue {
  openRowId: string | null;
  setOpenRowId: (id: string | null) => void;
  refocusGrid: () => void;
}
const PortDropdownContext = createContext<PortDropdownContextValue | null>(null);

// Port cell with inline dropdown - opens on click, Enter, or Space (not on focus)
interface PortCellDropdownProps {
  row: ChannelRow;
  onSelect: (portId: string | null, portIdRight?: string | null) => void;
}

function PortCellDropdown({ row, onSelect }: PortCellDropdownProps) {
  const dropdownContext = useContext(PortDropdownContext);
  const isOpen = dropdownContext?.openRowId === row._id;
  const onOpenChange = (open: boolean) => dropdownContext?.setOpenRowId(open ? row._id : null);
  const { portInfoMap, portUsageMap, outputPortGroups } = usePortData();
  const portInfo = row.ioPortId ? portInfoMap[row.ioPortId] : null;
  const portInfoRight = row.ioPortIdRight ? portInfoMap[row.ioPortIdRight] : null;

  // Generate port pairs for stereo (consecutive ports)
  const getPortPairs = (ports: typeof outputPortGroups[0]["ports"]) => {
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
    onOpenChange(false);
    // Refocus grid to restore arrow key navigation
    dropdownContext?.refocusGrid();
  };

  // Prevent arrow keys on trigger from opening dropdown - let grid handle navigation
  const handleTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      e.stopPropagation();
      // Focus grid and dispatch a new key event so grid can handle navigation
      const key = e.key;
      const keyCode = e.key === "ArrowDown" ? 40 : e.key === "ArrowUp" ? 38 : e.key === "ArrowLeft" ? 37 : 39;
      requestAnimationFrame(() => {
        const grid = document.querySelector<HTMLDivElement>('[role="grid"]');
        if (grid) {
          grid.focus();
          // Dispatch a complete keyboard event that react-data-grid can process
          const event = new KeyboardEvent('keydown', {
            key,
            code: key,
            keyCode,
            which: keyCode,
            bubbles: true,
            cancelable: true,
          });
          grid.dispatchEvent(event);
        }
      });
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
          {outputPortGroups
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
                      const isLeftUsedByOther = leftUsage && leftUsage.channelId !== row._id;
                      const isRightUsedByOther = rightUsage && rightUsage.channelId !== row._id;
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
                              {isLeftUsedByOther && leftUsage.channelName}
                              {isLeftUsedByOther && isRightUsedByOther && " / "}
                              {isRightUsedByOther && rightUsage.channelName}
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
        {outputPortGroups
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
                  const isUsedByOther = usage && usage.channelId !== row._id;
                  const isCurrentPort = port._id === row.ioPortId;
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
                          title={usage.channelName}
                        >
                          {usage.channelName}
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

export function OutputChannelTable({ projectId }: OutputChannelTableProps) {
  const channels = useQuery(api.outputChannels.list, { projectId });
  const mixers = useQuery(api.mixers.list, { projectId });

  const createChannel = useMutation(api.outputChannels.create);
  const updateChannel = useMutation(api.outputChannels.update);
  const removeChannel = useMutation(api.outputChannels.remove);
  const moveChannel = useMutation(api.outputChannels.moveChannel);
  const patchChannel = useMutation(api.patching.patchOutputChannel);
  const toggleStereoChannel = useMutation(api.outputChannels.toggleStereo);

  const [autoPatchDialogOpen, setAutoPatchDialogOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ rowIdx: number; idx: number } | null>(null);
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
    return channels.map((channel, index) => ({
      _id: channel._id,
      rowNumber: index + 1,
      ioPortId: channel.ioPortId,
      ioPortIdRight: channel.ioPortIdRight,
      isStereo: channel.isStereo,
      busName: channel.busName,
      destination: channel.destination,
      ampProcessor: channel.ampProcessor ?? "",
      location: channel.location ?? "",
      cable: channel.cable ?? "",
      notes: channel.notes ?? "",
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
            channelId: row._id as Id<"outputChannels">,
            ioPortId: row.ioPortId as Id<"ioPorts"> | null ?? null,
            ioPortIdRight: row.ioPortIdRight as Id<"ioPorts"> | null ?? null,
          });
        } else {
          patchChannel({
            channelId: row._id as Id<"outputChannels">,
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
          channelId: row._id as Id<"outputChannels">,
          [columnKey]: value || undefined,
        });
      }
    }
  }, [rows, patchChannel, updateChannel]);

  const handleToggleStereo = useCallback(async (channelId: string) => {
    await toggleStereoChannel({ channelId: channelId as Id<"outputChannels"> });
  }, [toggleStereoChannel]);

  // Column definitions
  const columns: Column<ChannelRow>[] = useMemo(() => [
    {
      key: "select",
      name: "",
      width: 40,
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
      key: "rowNumber",
      name: "#",
      width: 48,
      frozen: true,
      cellClass: "text-center font-mono text-sm",
      headerCellClass: "text-center",
    },
    {
      key: "port",
      name: "Port",
      width: 140,
      renderCell: ({ row }) => (
        <PortCellDropdown
          row={row}
          onSelect={(portId, portIdRight) => {
            patchChannel({
              channelId: row._id as Id<"outputChannels">,
              ioPortId: portId as Id<"ioPorts"> | null,
              ioPortIdRight: row.isStereo ? (portIdRight as Id<"ioPorts"> | null) : undefined,
            });
          }}
        />
      ),
    },
    {
      key: "busName",
      name: "Bus Name",
      minWidth: 120,
      renderCell: TextCell,
      renderEditCell: textEditor,
      editable: true,
    },
    {
      key: "destination",
      name: "Destination",
      minWidth: 120,
      renderCell: TextCell,
      renderEditCell: textEditor,
      editable: true,
    },
    {
      key: "ampProcessor",
      name: "Amp/Processor",
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
      key: "notes",
      name: "Notes",
      minWidth: 100,
      renderCell: TextCell,
      renderEditCell: textEditor,
      editable: true,
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
            <DropdownMenuItem onClick={() => moveChannel({ channelId: row._id as Id<"outputChannels">, direction: "up" })}>
              <ChevronUp className="mr-2 h-4 w-4" />
              Move Up
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => moveChannel({ channelId: row._id as Id<"outputChannels">, direction: "down" })}>
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
              onClick={() => removeChannel({ channelId: row._id as Id<"outputChannels"> })}
              className="text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ], [rows, selection, isStereoAvailable, moveChannel, removeChannel, handleToggleStereo, patchChannel]);

  const handleAddChannel = async () => {
    await createChannel({
      projectId,
      busName: "",
      destination: "",
    });
  };

  // Handle cell selection changes
  const handleSelectedCellChange = useCallback((args: CellSelectArgs<ChannelRow>) => {
    setSelectedCell({ rowIdx: args.rowIdx, idx: args.column.idx });
  }, []);

  // Custom key handlers for Alt+Arrow (move rows) and Alt+Enter (copy+increment)
  const handleCellKeyDown = useCallback((args: { row: ChannelRow; rowIdx: number; column: Column<ChannelRow>; mode: "SELECT" | "EDIT" }, event: React.KeyboardEvent<HTMLDivElement>) => {
    const { row, rowIdx, column, mode } = args;

    // Only handle in SELECT mode
    if (mode !== "SELECT") return;

    // Enter or Space on port column: Open dropdown
    if ((event.key === "Enter" || event.key === " ") && column.key === "port") {
      event.preventDefault();
      event.stopPropagation();
      setOpenPortDropdownRowId(row._id);
      return;
    }

    // Alt+Arrow: Move row up/down
    if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      event.preventDefault();
      event.stopPropagation();
      const direction = event.key === "ArrowUp" ? "up" : "down";
      moveChannel({ channelId: row._id as Id<"outputChannels">, direction }).then(() => {
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
      if (rowIdx > 0 && column.key !== "port" && column.key !== "select" && column.key !== "rowNumber" && column.key !== "actions") {
        const aboveRow = rows[rowIdx - 1];
        if (aboveRow) {
          const aboveValue = aboveRow[column.key as keyof ChannelRow];
          const valueStr = typeof aboveValue === "string" ? aboveValue : "";
          const newValue = incrementTrailingNumber(valueStr);
          const nextRowIdx = Math.min(rowIdx + 1, rows.length - 1);
          updateChannel({
            channelId: row._id as Id<"outputChannels">,
            [column.key]: newValue || undefined,
          }).then(() => {
            // Move selection to next row and refocus
            setSelectedCell({ rowIdx: nextRowIdx, idx: column.idx });
            requestAnimationFrame(() => {
              gridRef.current?.querySelector<HTMLDivElement>('[role="grid"]')?.focus();
            });
          });
        }
      }
      return;
    }

    // Ctrl/Cmd+Shift+S: Toggle stereo
    if (isStereoAvailable && (event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "s") {
      event.preventDefault();
      event.stopPropagation();
      toggleStereoChannel({ channelId: row._id as Id<"outputChannels"> }).then(() => {
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
        channelId: row._id as Id<"outputChannels">,
        ioPortId: null,
        ioPortIdRight: row.isStereo ? null : undefined,
      }).then(() => {
        requestAnimationFrame(() => {
          gridRef.current?.querySelector<HTMLDivElement>('[role="grid"]')?.focus();
        });
      });
      return;
    }
  }, [rows, moveChannel, updateChannel, patchChannel, isStereoAvailable, toggleStereoChannel]);

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
          Output Channels ({channels.length})
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground hidden sm:inline">
            Tab/Enter navigate · F2 edit · Alt+↑↓ move · Alt+Enter copy+increment
          </span>
          <Button onClick={handleAddChannel} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add Output
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
              No output channels yet. Click &quot;Add Output&quot; to get started.
            </div>
          ) : (
            <DataGrid
              columns={columns}
              rows={rows}
              rowKeyGetter={(row: ChannelRow) => row._id}
              onRowsChange={handleRowsChange}
              onCellKeyDown={handleCellKeyDown}
              selectedCell={selectedCell}
              onSelectedCellChange={handleSelectedCellChange}
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
        channelType="output"
        selectedChannelIds={selection.getSelectedInOrder()}
        onComplete={selection.clearSelection}
      />
    </div>
  );
}
