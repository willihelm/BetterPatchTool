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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, MoreVertical, ChevronUp, ChevronDown, Trash2, Zap, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useChannelSelection } from "./use-channel-selection";
import { AutoPatchDialog } from "./auto-patch-dialog";
import { incrementTrailingNumber } from "@/lib/string-utils";
import { PortCellDropdown, PortDropdownContext, SELECTION_BLOCK_WINDOW, lastPortSelectionTimestamp } from "./port-cell-dropdown";
import { TextCell, type OutputChannelRow } from "./channel-table-shared";
import { useUndoRedo } from "@/hooks/use-undo-redo";
import { useOutputPatchWithConflict, OutputPatchConflictDialog } from "./output-patch-conflict-dialog";

interface OutputChannelTableProps {
  projectId: Id<"projects">;
  mixerId?: Id<"mixers"> | null;
  channelType?: "input" | "output";
  onChannelTypeChange?: (type: "input" | "output") => void;
}

export function OutputChannelTable({ projectId, mixerId, channelType, onChannelTypeChange }: OutputChannelTableProps) {
  const channels = useQuery(api.outputChannels.list, { projectId, mixerId: mixerId ?? undefined });
  const mixers = useQuery(api.mixers.list, { projectId });

  const createChannel = useMutation(api.outputChannels.create);
  const updateChannel = useMutation(api.outputChannels.update);
  const removeChannel = useMutation(api.outputChannels.remove);
  const moveChannel = useMutation(api.outputChannels.moveChannel);
  const patchChannelDirect = useMutation(api.patching.patchOutputChannel);
  const toggleStereoChannel = useMutation(api.outputChannels.toggleStereo);
  const { patchWithConflictCheck, conflict, confirmForce, cancelConflict } = useOutputPatchWithConflict();

  const { pushAction } = useUndoRedo();

  const [autoPatchDialogOpen, setAutoPatchDialogOpen] = useState(false);
  const [openPortDropdownRowId, setOpenPortDropdownRowId] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const rowsRef = useRef<OutputChannelRow[]>([]);

  // Get stereo mode from active mixer
  const activeMixer = mixerId ? mixers?.find(m => m._id === mixerId) : mixers?.[0];
  const isStereoAvailable = activeMixer?.stereoMode === "true_stereo";

  // Multi-select for auto-patching
  const channelIds = channels?.map((c) => c._id) ?? [];
  const selection = useChannelSelection({ channelIds });

  // Convert channels to rows
  const rows: OutputChannelRow[] = useMemo(() => {
    if (!channels) return [];
    return channels.map((channel, index) => ({
      _id: channel._id,
      rowNumber: index + 1,
      busType: channel.busType,
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
  rowsRef.current = rows;

  // Handle row changes from the grid
  const handleRowsChange = useCallback((newRows: OutputChannelRow[], { indexes, column }: { indexes: number[]; column: Column<OutputChannelRow> }) => {
    for (const index of indexes) {
      const row = newRows[index];
      const originalRow = rows[index];
      if (!row || !originalRow) continue;

      const columnKey = column.key;
      const channelId = row._id as Id<"outputChannels">;

      // Handle port changes
      if (columnKey === "port") {
        const oldPortId = originalRow.ioPortId as Id<"ioPorts"> | null ?? null;
        const oldPortIdRight = originalRow.ioPortIdRight as Id<"ioPorts"> | null ?? null;
        const newPortId = row.ioPortId as Id<"ioPorts"> | null ?? null;
        const newPortIdRight = row.ioPortIdRight as Id<"ioPorts"> | null ?? null;

        if (row.isStereo) {
          patchWithConflictCheck({
            channelId, ioPortId: newPortId, ioPortIdRight: newPortIdRight,
            onSuccess: () => pushAction({
              label: "Change port",
              undo: async () => { await patchChannelDirect({ channelId, ioPortId: oldPortId, ioPortIdRight: oldPortIdRight, force: true }); },
              redo: async () => { await patchChannelDirect({ channelId, ioPortId: newPortId, ioPortIdRight: newPortIdRight, force: true }); },
            }),
          });
        } else {
          patchWithConflictCheck({
            channelId, ioPortId: newPortId,
            onSuccess: () => pushAction({
              label: "Change port",
              undo: async () => { await patchChannelDirect({ channelId, ioPortId: oldPortId, force: true }); },
              redo: async () => { await patchChannelDirect({ channelId, ioPortId: newPortId, force: true }); },
            }),
          });
        }
        continue;
      }

      // Handle text field changes
      const value = row[columnKey as keyof OutputChannelRow];
      const originalValue = originalRow[columnKey as keyof OutputChannelRow];
      if (value !== originalValue) {
        updateChannel({ channelId, [columnKey]: value || undefined });
        pushAction({
          label: `Edit ${columnKey}`,
          undo: async () => { await updateChannel({ channelId, [columnKey]: originalValue || undefined }); },
          redo: async () => { await updateChannel({ channelId, [columnKey]: value || undefined }); },
        });
      }
    }
  }, [rows, patchWithConflictCheck, patchChannelDirect, updateChannel, pushAction]);

  const handleToggleStereo = useCallback(async (channelId: string) => {
    const row = rows.find((r) => r._id === channelId);
    const oldIsStereo = row?.isStereo ?? false;
    const oldPortIdRight = row?.ioPortIdRight as Id<"ioPorts"> | undefined;
    const id = channelId as Id<"outputChannels">;

    await toggleStereoChannel({ channelId: id });
    pushAction({
      label: "Toggle stereo",
      undo: async () => {
        await toggleStereoChannel({ channelId: id });
        if (oldIsStereo && oldPortIdRight) {
          await patchChannelDirect({ channelId: id, ioPortId: (row?.ioPortId as Id<"ioPorts">) ?? null, ioPortIdRight: oldPortIdRight, force: true });
        }
      },
      redo: async () => { await toggleStereoChannel({ channelId: id }); },
    });
  }, [toggleStereoChannel, pushAction, rows, patchChannelDirect]);

  // Column definitions
  const columns: Column<OutputChannelRow>[] = useMemo(() => [
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
          className="h-4 w-4 rounded"
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
          className="h-4 w-4 rounded"
        />
      ),
    },
    {
      key: "rowNumber",
      name: "#",
      width: 64,
      frozen: true,
      cellClass: "text-center font-mono text-sm",
      headerCellClass: "text-center",
      renderCell: ({ row }: { row: OutputChannelRow }) => (
        <span>{row.busName || row.rowNumber}</span>
      ),
    },
    {
      key: "port",
      name: "Port",
      width: 140,
      frozen: true,
      renderCell: ({ row }) => (
        <PortCellDropdown
          row={row}
          portType="output"
          activeMixerId={mixerId ?? undefined}
          onSelect={(portId, portIdRight) => {
            const id = row._id as Id<"outputChannels">;
            const oldPortId = row.ioPortId as Id<"ioPorts"> | null ?? null;
            const oldPortIdRight = row.ioPortIdRight as Id<"ioPorts"> | null ?? null;
            const newPortId = portId as Id<"ioPorts"> | null;
            const newPortIdRight = row.isStereo ? (portIdRight as Id<"ioPorts"> | null) : undefined;
            patchWithConflictCheck({
              channelId: id, ioPortId: newPortId, ioPortIdRight: newPortIdRight,
              onSuccess: () => pushAction({
                label: "Change port",
                undo: async () => {
                  if (row.isStereo) {
                    await patchChannelDirect({ channelId: id, ioPortId: oldPortId, ioPortIdRight: oldPortIdRight, force: true });
                  } else {
                    await patchChannelDirect({ channelId: id, ioPortId: oldPortId, force: true });
                  }
                },
                redo: async () => { await patchChannelDirect({ channelId: id, ioPortId: newPortId, ioPortIdRight: newPortIdRight, force: true }); },
              }),
            });
          }}
        />
      ),
    },
    {
      key: "busName",
      name: "Bus Name",
      minWidth: 120,
      frozen: true,
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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- rows accessed via ref
  ], [selection, isStereoAvailable, moveChannel, removeChannel, handleToggleStereo, patchWithConflictCheck, patchChannelDirect, pushAction]);

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
      busName: "",
      destination: "",
      mixerId: mixerId ?? undefined,
    });
  };

  // Custom key handlers for Alt+Arrow (move rows) and Alt+Enter (copy+increment)
  const handleCellKeyDown = useCallback((args: { row: OutputChannelRow; rowIdx: number; column: Column<OutputChannelRow>; mode: "SELECT" | "EDIT" }, event: React.KeyboardEvent<HTMLDivElement>) => {
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
      const oppositeDirection = direction === "up" ? "down" : "up";
      const id = row._id as Id<"outputChannels">;
      moveChannel({ channelId: id, direction }).then(() => {
        requestAnimationFrame(() => {
          gridRef.current?.querySelector<HTMLDivElement>('[role="grid"]')?.focus();
        });
      });
      pushAction({
        label: `Move row ${direction}`,
        undo: async () => { await moveChannel({ channelId: id, direction: oppositeDirection }); },
        redo: async () => { await moveChannel({ channelId: id, direction }); },
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
          const aboveValue = aboveRow[column.key as keyof OutputChannelRow];
          const valueStr = typeof aboveValue === "string" ? aboveValue : "";
          const newValue = incrementTrailingNumber(valueStr);
          const nextRowIdx = Math.min(rowIdx + 1, rows.length - 1);
          const colIdx = columnIndexByKey.get(column.key);
          if (colIdx === undefined) return;

          const id = row._id as Id<"outputChannels">;
          const oldValue = row[column.key as keyof OutputChannelRow];
          updateChannel({
            channelId: id,
            [column.key]: newValue || undefined,
          }).then(() => {
            setTimeout(() => {
              const grid = gridRef.current?.querySelector('[role="grid"]');
              if (grid) {
                const rows = grid.querySelectorAll('[role="row"]');
                const targetRow = rows[nextRowIdx + 1];
                if (targetRow) {
                  const targetCell = targetRow.children[colIdx] as HTMLElement;
                  if (targetCell?.getAttribute('role') === 'gridcell') {
                    targetCell.click();
                  }
                }
              }
            }, 50);
          });
          pushAction({
            label: "Copy+increment",
            undo: async () => { await updateChannel({ channelId: id, [column.key]: oldValue || undefined }); },
            redo: async () => { await updateChannel({ channelId: id, [column.key]: newValue || undefined }); },
          });
        }
      }
      return;
    }

    // Ctrl/Cmd+Shift+S: Toggle stereo
    if (isStereoAvailable && (event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "s") {
      event.preventDefault();
      event.stopPropagation();
      const id = row._id as Id<"outputChannels">;
      const oldIsStereo = row.isStereo ?? false;
      const oldPortIdRight = row.ioPortIdRight as Id<"ioPorts"> | undefined;
      const oldPortId = row.ioPortId as Id<"ioPorts"> | undefined;
      toggleStereoChannel({ channelId: id }).then(() => {
        requestAnimationFrame(() => {
          gridRef.current?.querySelector<HTMLDivElement>('[role="grid"]')?.focus();
        });
      });
      pushAction({
        label: "Toggle stereo",
        undo: async () => {
          await toggleStereoChannel({ channelId: id });
          if (oldIsStereo && oldPortIdRight) {
            await patchChannelDirect({ channelId: id, ioPortId: oldPortId ?? null, ioPortIdRight: oldPortIdRight, force: true });
          }
        },
        redo: async () => { await toggleStereoChannel({ channelId: id }); },
      });
      return;
    }

    // Delete/Backspace on port column: Clear port
    if ((event.key === "Delete" || event.key === "Backspace") && column.key === "port") {
      event.preventDefault();
      event.stopPropagation();
      const id = row._id as Id<"outputChannels">;
      const oldPortId = row.ioPortId as Id<"ioPorts"> | null ?? null;
      const oldPortIdRight = row.ioPortIdRight as Id<"ioPorts"> | null ?? null;
      patchChannelDirect({
        channelId: id,
        ioPortId: null,
        ioPortIdRight: row.isStereo ? null : undefined,
        force: true,
      }).then(() => {
        requestAnimationFrame(() => {
          gridRef.current?.querySelector<HTMLDivElement>('[role="grid"]')?.focus();
        });
      });
      pushAction({
        label: "Clear port",
        undo: async () => {
          if (row.isStereo) {
            await patchChannelDirect({ channelId: id, ioPortId: oldPortId, ioPortIdRight: oldPortIdRight, force: true });
          } else {
            await patchChannelDirect({ channelId: id, ioPortId: oldPortId, force: true });
          }
        },
        redo: async () => {
          await patchChannelDirect({ channelId: id, ioPortId: null, ioPortIdRight: row.isStereo ? null : undefined, force: true });
        },
      });
      return;
    }
  }, [rows, moveChannel, updateChannel, patchChannelDirect, isStereoAvailable, toggleStereoChannel, columnIndexByKey, pushAction]);

  // Row class for stereo and selection
  const rowClass = useCallback((row: OutputChannelRow) => {
    return cn(
      "group",
      row.isStereo && "stereo-row",
      selection.isSelected(row._id) && "selected"
    );
  }, [selection]);

  // Row height for stereo rows
  const rowHeight = (row: OutputChannelRow) => {
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
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onChannelTypeChange ? (
            <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
              <button
                onClick={() => onChannelTypeChange("input")}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  channelType === "input"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Input
              </button>
              <button
                onClick={() => onChannelTypeChange("output")}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  channelType === "output"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Output
              </button>
            </div>
          ) : (
            <h3 className="text-lg font-medium">
              Output Channels ({channels.length})
            </h3>
          )}
        </div>
        <span className="text-xs text-muted-foreground hidden lg:inline">
          Tab/Enter navigate · F2 edit · Alt+↑↓ move · Alt+Enter copy+increment
        </span>
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
              rowKeyGetter={(row: OutputChannelRow) => row._id}
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

      <Button onClick={handleAddChannel} size="sm" variant="outline" className="w-full">
        <Plus className="mr-2 h-4 w-4" />
        Add Output
      </Button>

      <AutoPatchDialog
        open={autoPatchDialogOpen}
        onOpenChange={setAutoPatchDialogOpen}
        projectId={projectId}
        channelType="output"
        selectedChannelIds={selection.getSelectedInOrder()}
        onComplete={selection.clearSelection}
      />

      <OutputPatchConflictDialog
        conflict={conflict}
        onConfirm={confirmForce}
        onCancel={cancelConflict}
      />
    </div>
  );
}
