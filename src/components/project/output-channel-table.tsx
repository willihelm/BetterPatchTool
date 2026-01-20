"use client";

import { useState, useCallback, useRef, useEffect, memo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, MoreVertical, ChevronUp, ChevronDown, Trash2, Zap, X } from "lucide-react";
import type { OutputChannel } from "@/types/convex";
import { PortSelectCell } from "./port-select-cell";
import { useChannelSelection } from "./use-channel-selection";
import { AutoPatchDialog } from "./auto-patch-dialog";
import { incrementTrailingNumber } from "@/lib/string-utils";

interface OutputChannelTableProps {
  projectId: Id<"projects">;
}

// Editable columns in order (text input cells)
const EDITABLE_COLUMNS = [
  "busName",
  "destination",
  "ampProcessor",
  "location",
  "cable",
  "notes",
];

// All navigable columns including special cells like port
const ALL_COLUMNS = ["port", ...EDITABLE_COLUMNS];

export function OutputChannelTable({ projectId }: OutputChannelTableProps) {
  const channels = useQuery(api.outputChannels.list, { projectId });

  const createChannel = useMutation(api.outputChannels.create);
  const updateChannel = useMutation(api.outputChannels.update);
  const removeChannel = useMutation(api.outputChannels.remove);
  const moveChannel = useMutation(api.outputChannels.moveChannel);
  const patchChannel = useMutation(api.patching.patchOutputChannel);

  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [portDropdownOpen, setPortDropdownOpen] = useState<number | null>(null);
  const [autoPatchDialogOpen, setAutoPatchDialogOpen] = useState(false);

  // Multi-select for auto-patching
  const channelIds = channels?.map((c) => c._id) ?? [];
  const selection = useChannelSelection({ channelIds });

  // Use local state for navigation instead of hook to avoid duplicate handlers
  const [activeCell, setActiveCell] = useState<{ rowIndex: number; columnId: string } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [shouldSelectAll, setShouldSelectAll] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectCell = useCallback((position: { rowIndex: number; columnId: string }) => {
    setActiveCell(position);
    setIsEditing(false);
  }, []);

  const stopEditing = useCallback((save = true) => {
    setIsEditing(false);
  }, []);

  const initializeNavigation = useCallback(() => {
    if (!activeCell && channels && channels.length > 0 && ALL_COLUMNS.length > 0) {
      setActiveCell({ rowIndex: 0, columnId: ALL_COLUMNS[0] });
    }
  }, [activeCell, channels]);

  // Focus on input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if (shouldSelectAll) {
        inputRef.current.select();
      } else {
        // Move cursor to end when typing initiated editing
        const len = inputRef.current.value.length;
        inputRef.current.setSelectionRange(len, len);
      }
      setShouldSelectAll(false);
    }
  }, [isEditing, shouldSelectAll]);

  const handleAddChannel = async () => {
    await createChannel({
      projectId,
      busName: "",
      destination: "",
    });
  };

  const saveEdit = useCallback(async () => {
    if (!activeCell || !channels) return;

    const channel = channels[activeCell.rowIndex];
    if (!channel) return;

    await updateChannel({
      channelId: channel._id,
      [activeCell.columnId]: editValue || undefined,
    });
  }, [activeCell, channels, editValue, updateChannel]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      saveEdit();
      stopEditing(true);
      // Navigate to next row (same column)
      if (activeCell && channels) {
        const nextRowIndex = Math.min(channels.length - 1, activeCell.rowIndex + 1);
        selectCell({ rowIndex: nextRowIndex, columnId: activeCell.columnId });
      }
      containerRef.current?.focus();
    } else if (e.key === "Tab") {
      e.preventDefault();
      e.stopPropagation();
      saveEdit();
      stopEditing(true);
      if (activeCell) {
        const currentColIndex = ALL_COLUMNS.indexOf(activeCell.columnId);
        let nextColIndex = e.shiftKey ? currentColIndex - 1 : currentColIndex + 1;
        let nextRowIndex = activeCell.rowIndex;

        if (nextColIndex < 0) {
          nextColIndex = ALL_COLUMNS.length - 1;
          nextRowIndex = Math.max(0, nextRowIndex - 1);
        } else if (nextColIndex >= ALL_COLUMNS.length) {
          nextColIndex = 0;
          nextRowIndex = Math.min((channels?.length ?? 1) - 1, nextRowIndex + 1);
        }

        selectCell({ rowIndex: nextRowIndex, columnId: ALL_COLUMNS[nextColIndex] });
      }
      containerRef.current?.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      stopEditing(false);
      containerRef.current?.focus();
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      e.stopPropagation();
      saveEdit();
      stopEditing(true);
      if (activeCell) {
        const { rowIndex, columnId } = activeCell;
        const colIndex = ALL_COLUMNS.indexOf(columnId);
        let nextRowIndex = rowIndex;
        let nextColIndex = colIndex;

        switch (e.key) {
          case "ArrowUp":
            nextRowIndex = Math.max(0, rowIndex - 1);
            break;
          case "ArrowDown":
            nextRowIndex = Math.min((channels?.length ?? 1) - 1, rowIndex + 1);
            break;
          case "ArrowLeft":
            nextColIndex = Math.max(0, colIndex - 1);
            break;
          case "ArrowRight":
            nextColIndex = Math.min(ALL_COLUMNS.length - 1, colIndex + 1);
            break;
        }
        selectCell({ rowIndex: nextRowIndex, columnId: ALL_COLUMNS[nextColIndex] });
      }
      containerRef.current?.focus();
    }
  };

  const handleCellClick = (rowIndex: number, columnId: string) => {
    // Start editing immediately on click
    selectCell({ rowIndex, columnId });
    const channel = channels?.[rowIndex];
    if (channel) {
      const value = channel[columnId as keyof OutputChannel];
      setEditValue(typeof value === "string" ? value : "");
      setShouldSelectAll(true); // Select all when clicking to edit
      setIsEditing(true);
    }
  };

  const handleTableKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (isEditing) return;
    if (portDropdownOpen !== null) return; // Port dropdown is open

    if (!activeCell) {
      if (channels && channels.length > 0) {
        selectCell({ rowIndex: 0, columnId: ALL_COLUMNS[0] });
      }
      return;
    }

    const { rowIndex, columnId } = activeCell;
    const colIndex = ALL_COLUMNS.indexOf(columnId);
    const isPortColumn = columnId === "port";

    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        if (e.altKey) {
          const channel = channels?.[rowIndex];
          if (channel && rowIndex > 0) {
            moveChannel({ channelId: channel._id, direction: "up" });
            selectCell({ rowIndex: rowIndex - 1, columnId });
          }
        } else {
          selectCell({ rowIndex: Math.max(0, rowIndex - 1), columnId });
        }
        break;
      case "ArrowDown":
        e.preventDefault();
        if (e.altKey) {
          const channel = channels?.[rowIndex];
          if (channel && rowIndex < (channels?.length ?? 1) - 1) {
            moveChannel({ channelId: channel._id, direction: "down" });
            selectCell({ rowIndex: rowIndex + 1, columnId });
          }
        } else {
          selectCell({ rowIndex: Math.min((channels?.length ?? 1) - 1, rowIndex + 1), columnId });
        }
        break;
      case "ArrowLeft":
        e.preventDefault();
        selectCell({ rowIndex, columnId: ALL_COLUMNS[Math.max(0, colIndex - 1)] });
        break;
      case "ArrowRight":
        e.preventDefault();
        selectCell({ rowIndex, columnId: ALL_COLUMNS[Math.min(ALL_COLUMNS.length - 1, colIndex + 1)] });
        break;
      case "Tab":
        e.preventDefault();
        {
          let nextColIndex = e.shiftKey ? colIndex - 1 : colIndex + 1;
          let nextRowIndex = rowIndex;
          if (nextColIndex < 0) {
            nextColIndex = ALL_COLUMNS.length - 1;
            nextRowIndex = Math.max(0, rowIndex - 1);
          } else if (nextColIndex >= ALL_COLUMNS.length) {
            nextColIndex = 0;
            nextRowIndex = Math.min((channels?.length ?? 1) - 1, rowIndex + 1);
          }
          selectCell({ rowIndex: nextRowIndex, columnId: ALL_COLUMNS[nextColIndex] });
        }
        break;
      case "Enter":
        e.preventDefault();
        if (isPortColumn) {
          // Port column: Enter opens the dropdown (handled by PortSelectCell)
          break;
        }
        if (e.altKey) {
          // Alt+Enter: Copy value from cell above, increment trailing number, save, and move down
          const aboveChannel = channels?.[rowIndex - 1];
          const currentChannel = channels?.[rowIndex];
          if (aboveChannel && currentChannel && rowIndex > 0) {
            const aboveValue = aboveChannel[columnId as keyof OutputChannel];
            const valueStr = typeof aboveValue === "string" ? aboveValue : "";
            const newValue = incrementTrailingNumber(valueStr);
            // Save immediately and move to next row
            updateChannel({
              channelId: currentChannel._id,
              [columnId]: newValue || undefined,
            });
            const nextRowIndex = Math.min((channels?.length ?? 1) - 1, rowIndex + 1);
            selectCell({ rowIndex: nextRowIndex, columnId });
          }
        } else {
          const channel = channels?.[rowIndex];
          if (channel) {
            const value = channel[columnId as keyof OutputChannel];
            setEditValue(typeof value === "string" ? value : "");
            setShouldSelectAll(true);
            setIsEditing(true);
          }
        }
        break;
      case "F2":
        e.preventDefault();
        if (isPortColumn) {
          // Port column: F2 opens the dropdown (handled by PortSelectCell)
          break;
        }
        {
          const channel = channels?.[rowIndex];
          if (channel) {
            const value = channel[columnId as keyof OutputChannel];
            setEditValue(typeof value === "string" ? value : "");
            setShouldSelectAll(true); // Select all when using Enter/F2
            setIsEditing(true);
          }
        }
        break;
      case "Delete":
      case "Backspace":
        e.preventDefault();
        if (isPortColumn) {
          // Port column: Clear port assignment
          const channel = channels?.[rowIndex];
          if (channel) {
            handlePortSelect(channel._id, null);
          }
          break;
        }
        {
          const channel = channels?.[rowIndex];
          if (channel) {
            // Clear cell immediately and save (use empty string, not undefined)
            updateChannel({
              channelId: channel._id,
              [columnId]: "",
            });
          }
        }
        break;
      case "Escape":
        e.preventDefault();
        setActiveCell(null); // Deselect
        break;
      default:
        // Alphanumeric input starts editing (only for text columns)
        if (!isPortColumn && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          setEditValue(e.key);
          setShouldSelectAll(false); // Don't select - keep the typed character
          setIsEditing(true);
        }
        break;
    }
  };

  const handlePortSelect = async (channelId: string, portId: string | null) => {
    await patchChannel({
      channelId: channelId as Id<"outputChannels">,
      ioPortId: portId as Id<"ioPorts"> | null,
    });
  };

  const isCellActive = (rowIndex: number, columnId: string) => {
    return activeCell?.rowIndex === rowIndex && activeCell?.columnId === columnId;
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

      <div
        ref={containerRef}
        className="border rounded-lg overflow-hidden focus:outline-none"
        tabIndex={0}
        onKeyDown={handleTableKeyDown}
        onFocus={initializeNavigation}
      >
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-10 text-center">
                <input
                  type="checkbox"
                  checked={channels.length > 0 && selection.selectionCount === channels.length}
                  onChange={(e) => {
                    if (e.target.checked) {
                      selection.selectAll();
                    } else {
                      selection.clearSelection();
                    }
                  }}
                  className="h-4 w-4 rounded border-gray-300"
                />
              </TableHead>
              <TableHead className="w-12 text-center">#</TableHead>
              <TableHead className="w-32">Port</TableHead>
              <TableHead className="min-w-[120px]">Bus Name</TableHead>
              <TableHead className="min-w-[120px]">Destination</TableHead>
              <TableHead className="min-w-[100px]">Amp/Processor</TableHead>
              <TableHead className="w-24">Location</TableHead>
              <TableHead className="w-24">Cable</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {channels.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                  No output channels yet.
                </TableCell>
              </TableRow>
            ) : (
              channels.map((channel, rowIndex) => (
                <TableRow
                  key={channel._id}
                  className={`group ${activeCell?.rowIndex === rowIndex ? "bg-muted/30" : ""} ${selection.isSelected(channel._id) ? "bg-primary/5" : ""}`}
                >
                  <TableCell className="text-center">
                    <input
                      type="checkbox"
                      checked={selection.isSelected(channel._id)}
                      onChange={() => selection.toggleSelection(channel._id)}
                      onClick={(e) => {
                        if (e.shiftKey && channels.length > 0) {
                          // Shift+click for range selection
                          const lastSelected = selection.getSelectedInOrder().at(-1);
                          if (lastSelected) {
                            selection.selectRange(lastSelected, channel._id);
                          }
                        }
                      }}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                  </TableCell>
                  <TableCell className="text-center font-mono text-sm">
                    {rowIndex + 1}
                  </TableCell>
                  <PortSelectCell
                    value={channel.ioPortId}
                    portType="output"
                    currentChannelId={channel._id}
                    isActive={isCellActive(rowIndex, "port")}
                    onSelect={(portId) => handlePortSelect(channel._id, portId)}
                    onCellClick={() => selectCell({ rowIndex, columnId: "port" })}
                    onOpenChange={(open) => setPortDropdownOpen(open ? rowIndex : null)}
                  />

                  {EDITABLE_COLUMNS.map((columnId) => (
                    <EditableCell
                      key={columnId}
                      value={channel[columnId as keyof OutputChannel] as string | undefined}
                      isActive={isCellActive(rowIndex, columnId)}
                      isEditing={isCellActive(rowIndex, columnId) && isEditing}
                      editValue={editValue}
                      inputRef={isCellActive(rowIndex, columnId) ? inputRef : undefined}
                      onClick={() => handleCellClick(rowIndex, columnId)}
                      onValueChange={setEditValue}
                      onKeyDown={handleKeyDown}
                      onBlur={() => {
                        saveEdit();
                        stopEditing(true);
                      }}
                    />
                  ))}

                  <TableCell>
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
                        <DropdownMenuItem
                          onClick={() => moveChannel({ channelId: channel._id, direction: "up" })}
                        >
                          <ChevronUp className="mr-2 h-4 w-4" />
                          Move Up
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => moveChannel({ channelId: channel._id, direction: "down" })}
                        >
                          <ChevronDown className="mr-2 h-4 w-4" />
                          Move Down
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => removeChannel({ channelId: channel._id })}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

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

interface EditableCellProps {
  value: string | undefined;
  isActive: boolean;
  isEditing: boolean;
  editValue: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  onClick: () => void;
  onValueChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onBlur: () => void;
}

const EditableCell = memo(function EditableCell({
  value,
  isActive,
  isEditing,
  editValue,
  inputRef,
  onClick,
  onValueChange,
  onKeyDown,
  onBlur,
}: EditableCellProps) {
  return (
    <TableCell
      className={`cursor-pointer transition-colors ${
        isActive
          ? "ring-2 ring-primary ring-inset bg-primary/5"
          : "hover:bg-muted/50"
      }`}
      onClick={onClick}
    >
      {isEditing ? (
        <Input
          ref={inputRef}
          autoFocus
          value={editValue}
          onChange={(e) => onValueChange(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={onBlur}
          className="h-7 text-sm -my-1"
        />
      ) : (
        <span className={!value ? "text-muted-foreground" : ""}>
          {value || "-"}
        </span>
      )}
    </TableCell>
  );
});
