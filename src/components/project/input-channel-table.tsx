"use client";

import { useMemo, useCallback, useRef, useState } from "react";
import DataGrid, { type Column, textEditor } from "react-data-grid";
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
import { useChannelSelection } from "./use-channel-selection";
import { AutoPatchDialog } from "./auto-patch-dialog";
import { incrementTrailingNumber } from "@/lib/string-utils";
import { PortCellDropdown, PortDropdownContext, SELECTION_BLOCK_WINDOW, lastPortSelectionTimestamp } from "./port-cell-dropdown";
import { TextCell, type InputChannelRow } from "./channel-table-shared";

interface InputChannelTableProps {
  projectId: Id<"projects">;
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
  const rowsRef = useRef<InputChannelRow[]>([]);

  // Get stereo mode from first mixer
  const firstMixer = mixers?.[0];
  const isStereoAvailable = firstMixer?.stereoMode === "true_stereo";

  // Multi-select for auto-patching
  const channelIds = channels?.map((c) => c._id) ?? [];
  const selection = useChannelSelection({ channelIds });

  // Convert channels to rows
  const rows: InputChannelRow[] = useMemo(() => {
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
  rowsRef.current = rows;

  // Handle row changes from the grid
  const handleRowsChange = useCallback((newRows: InputChannelRow[], { indexes, column }: { indexes: number[]; column: Column<InputChannelRow> }) => {
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
      const value = row[columnKey as keyof InputChannelRow];
      const originalValue = originalRow[columnKey as keyof InputChannelRow];
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
  const columns: Column<InputChannelRow>[] = useMemo(() => [
    {
      key: "select",
      name: "",
      width: 32,
      frozen: true,
      renderHeaderCell: () => (
        <input
          type="checkbox"
          checked={rowsRef.current.length > 0 && selection.selectionCount === rowsRef.current.length}
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
            if (e.shiftKey && rowsRef.current.length > 0) {
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
          portType="input"
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
        const patchedCount = rowsRef.current.filter((r) => r.patched).length;
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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- rows accessed via ref, openPortDropdownRowId excluded to prevent column recreation
], [selection, isStereoAvailable, projectId, clearAllPatched, moveChannel, removeChannel, togglePatched, handleToggleStereo, patchChannel]);

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
  const handleCellKeyDown = useCallback((args: { row: InputChannelRow; rowIdx: number; column: Column<InputChannelRow>; mode: "SELECT" | "EDIT" }, event: React.KeyboardEvent<HTMLDivElement>) => {
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
          const aboveValue = aboveRow[column.key as keyof InputChannelRow];
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
  const rowClass = useCallback((row: InputChannelRow) => {
    return cn(
      "group",
      row.isStereo && "stereo-row",
      selection.isSelected(row._id) && "selected"
    );
  }, [selection]);

  // Row height for stereo rows
  const rowHeight = (row: InputChannelRow) => {
    return row.isStereo ? 64 : 40;
  };

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
              rowKeyGetter={(row: InputChannelRow) => row._id}
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
