"use client";

import { useState, useCallback, useRef, useEffect } from "react";
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
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, MoreVertical, ChevronUp, ChevronDown, Trash2, Check } from "lucide-react";
import type { InputChannel, StageboxPort } from "@/types/convex";

interface InputChannelTableProps {
  projectId: Id<"projects">;
}

// Editable columns in order
const EDITABLE_COLUMNS = [
  "source",
  "uhf",
  "micInputDev",
  "location",
  "cable",
  "stand",
  "notes",
];

// Increment trailing number in string, e.g. "Vocal 1" -> "Vocal 2"
function incrementTrailingNumber(value: string): string {
  const match = value.match(/^(.*?)(\d+)$/);
  if (match) {
    const [, prefix, numStr] = match;
    const num = parseInt(numStr, 10) + 1;
    return prefix + num;
  }
  return value;
}

export function InputChannelTable({ projectId }: InputChannelTableProps) {
  const channels = useQuery(api.inputChannels.list, { projectId }) as InputChannel[] | undefined;
  const stageboxPorts = useQuery(api.stageboxes.listAllPorts, { projectId }) as StageboxPort[] | undefined;

  const createChannel = useMutation(api.inputChannels.create);
  const updateChannel = useMutation(api.inputChannels.update);
  const removeChannel = useMutation(api.inputChannels.remove);
  const moveChannel = useMutation(api.inputChannels.moveChannel);

  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const inputPorts = stageboxPorts?.filter((p) => p.type === "input") ?? [];

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
    if (!activeCell && channels && channels.length > 0 && EDITABLE_COLUMNS.length > 0) {
      setActiveCell({ rowIndex: 0, columnId: EDITABLE_COLUMNS[0] });
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
      source: "",
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
        const currentColIndex = EDITABLE_COLUMNS.indexOf(activeCell.columnId);
        let nextColIndex = e.shiftKey ? currentColIndex - 1 : currentColIndex + 1;
        let nextRowIndex = activeCell.rowIndex;

        if (nextColIndex < 0) {
          nextColIndex = EDITABLE_COLUMNS.length - 1;
          nextRowIndex = Math.max(0, nextRowIndex - 1);
        } else if (nextColIndex >= EDITABLE_COLUMNS.length) {
          nextColIndex = 0;
          nextRowIndex = Math.min((channels?.length ?? 1) - 1, nextRowIndex + 1);
        }

        selectCell({ rowIndex: nextRowIndex, columnId: EDITABLE_COLUMNS[nextColIndex] });
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
        const colIndex = EDITABLE_COLUMNS.indexOf(columnId);
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
            nextColIndex = Math.min(EDITABLE_COLUMNS.length - 1, colIndex + 1);
            break;
        }
        selectCell({ rowIndex: nextRowIndex, columnId: EDITABLE_COLUMNS[nextColIndex] });
      }
      containerRef.current?.focus();
    }
  };

  const handleCellClick = (rowIndex: number, columnId: string) => {
    // Start editing immediately on click
    selectCell({ rowIndex, columnId });
    const channel = channels?.[rowIndex];
    if (channel) {
      const value = channel[columnId as keyof InputChannel];
      setEditValue(typeof value === "string" ? value : "");
      setShouldSelectAll(true); // Select all when clicking to edit
      setIsEditing(true);
    }
  };

  const handleTableKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (isEditing) return; // Input handled by input element

    if (!activeCell) {
      // If no cell is active, activate first cell on any key
      if (channels && channels.length > 0) {
        selectCell({ rowIndex: 0, columnId: EDITABLE_COLUMNS[0] });
      }
      return;
    }

    const { rowIndex, columnId } = activeCell;
    const colIndex = EDITABLE_COLUMNS.indexOf(columnId);

    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        if (e.altKey) {
          const channel = channels?.[rowIndex];
          if (channel) moveChannel({ channelId: channel._id, direction: "up" });
        } else {
          selectCell({ rowIndex: Math.max(0, rowIndex - 1), columnId });
        }
        break;
      case "ArrowDown":
        e.preventDefault();
        if (e.altKey) {
          const channel = channels?.[rowIndex];
          if (channel) moveChannel({ channelId: channel._id, direction: "down" });
        } else {
          selectCell({ rowIndex: Math.min((channels?.length ?? 1) - 1, rowIndex + 1), columnId });
        }
        break;
      case "ArrowLeft":
        e.preventDefault();
        selectCell({ rowIndex, columnId: EDITABLE_COLUMNS[Math.max(0, colIndex - 1)] });
        break;
      case "ArrowRight":
        e.preventDefault();
        selectCell({ rowIndex, columnId: EDITABLE_COLUMNS[Math.min(EDITABLE_COLUMNS.length - 1, colIndex + 1)] });
        break;
      case "Tab":
        e.preventDefault();
        e.stopPropagation();
        {
          let nextColIndex = e.shiftKey ? colIndex - 1 : colIndex + 1;
          let nextRowIndex = rowIndex;
          if (nextColIndex < 0) {
            nextColIndex = EDITABLE_COLUMNS.length - 1;
            nextRowIndex = Math.max(0, rowIndex - 1);
          } else if (nextColIndex >= EDITABLE_COLUMNS.length) {
            nextColIndex = 0;
            nextRowIndex = Math.min((channels?.length ?? 1) - 1, rowIndex + 1);
          }
          selectCell({ rowIndex: nextRowIndex, columnId: EDITABLE_COLUMNS[nextColIndex] });
        }
        break;
      case "Enter":
        e.preventDefault();
        if (e.altKey) {
          // Alt+Enter: Copy value from cell above, increment trailing number, save, and move down
          const aboveChannel = channels?.[rowIndex - 1];
          const currentChannel = channels?.[rowIndex];
          if (aboveChannel && currentChannel && rowIndex > 0) {
            const aboveValue = aboveChannel[columnId as keyof InputChannel];
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
            const value = channel[columnId as keyof InputChannel];
            setEditValue(typeof value === "string" ? value : "");
            setShouldSelectAll(true);
            setIsEditing(true);
          }
        }
        break;
      case "F2":
        e.preventDefault();
        {
          const channel = channels?.[rowIndex];
          if (channel) {
            const value = channel[columnId as keyof InputChannel];
            setEditValue(typeof value === "string" ? value : "");
            setShouldSelectAll(true); // Select all when using Enter/F2
            setIsEditing(true);
          }
        }
        break;
      case "Delete":
      case "Backspace":
        e.preventDefault();
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
        // Alphanumeric input starts editing - don't select, cursor at end
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          setEditValue(e.key);
          setShouldSelectAll(false); // Don't select - keep the typed character
          setIsEditing(true);
        }
        break;
    }
  };

  const togglePatched = async (channelId: string, currentValue: boolean) => {
    await updateChannel({
      channelId: channelId as Id<"inputChannels">,
      patched: !currentValue,
    });
  };

  const getPortLabel = (portId: string | undefined) => {
    if (!portId) return "-";
    const port = inputPorts.find((p) => p._id === portId);
    return port?.label ?? "-";
  };

  const getPortColor = (portId: string | undefined) => {
    if (!portId) return undefined;
    const port = inputPorts.find((p) => p._id === portId);
    return port?.stageboxColor;
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
              <TableHead className="w-12 text-center">Ch#</TableHead>
              <TableHead className="w-32">Port</TableHead>
              <TableHead className="min-w-[120px]">Source</TableHead>
              <TableHead className="w-24">UHF</TableHead>
              <TableHead className="min-w-[100px]">Mic/Input</TableHead>
              <TableHead className="w-24">Location</TableHead>
              <TableHead className="w-24">Cable</TableHead>
              <TableHead className="w-24">Stand</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="w-16 text-center">Patched</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {channels.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                  No channels yet. Click &quot;Add Channel&quot; to get started.
                </TableCell>
              </TableRow>
            ) : (
              channels.map((channel, rowIndex) => (
                <TableRow
                  key={channel._id}
                  className={`group ${activeCell?.rowIndex === rowIndex ? "bg-muted/30" : ""}`}
                >
                  <TableCell className="text-center font-mono text-sm">
                    {channel.channelNumber}
                  </TableCell>
                  <TableCell>
                    {channel.stageboxPortId ? (
                      <Badge
                        variant="outline"
                        style={{
                          borderColor: getPortColor(channel.stageboxPortId),
                          color: getPortColor(channel.stageboxPortId),
                        }}
                      >
                        {getPortLabel(channel.stageboxPortId)}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>

                  {/* Editable Cells */}
                  {EDITABLE_COLUMNS.map((columnId) => (
                    <EditableCell
                      key={columnId}
                      value={channel[columnId as keyof InputChannel] as string | undefined}
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

                  <TableCell className="text-center">
                    <button
                      onClick={() => togglePatched(channel._id, channel.patched)}
                      className={`h-6 w-6 rounded border-2 flex items-center justify-center transition-colors mx-auto ${
                        channel.patched
                          ? "bg-green-500 border-green-500 text-white"
                          : "border-muted-foreground/30 hover:border-muted-foreground"
                      }`}
                    >
                      {channel.patched && <Check className="h-4 w-4" />}
                    </button>
                  </TableCell>
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

function EditableCell({
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
}
