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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, MoreVertical, ChevronUp, ChevronDown, Trash2, Check, Zap, X } from "lucide-react";
import type { InputChannel } from "@/types/convex";
import { PortSelectCell } from "./port-select-cell";
import { StereoPortSelectCell } from "./stereo-port-select-cell";
import { useChannelSelection } from "./use-channel-selection";
import { AutoPatchDialog } from "./auto-patch-dialog";
import { incrementTrailingNumber } from "@/lib/string-utils";

interface InputChannelTableProps {
  projectId: Id<"projects">;
}

// Editable columns in order (text input cells)
const EDITABLE_COLUMNS = [
  "source",
  "uhf",
  "micInputDev",
  "location",
  "cable",
  "stand",
  "notes",
];

// All navigable columns including special cells like port
const ALL_COLUMNS = ["port", ...EDITABLE_COLUMNS];

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

  const [portDropdownOpen, setPortDropdownOpen] = useState<number | null>(null);
  const [autoPatchDialogOpen, setAutoPatchDialogOpen] = useState(false);

  // Get stereo mode from first mixer (simplified approach)
  const firstMixer = mixers?.[0];
  const isStereoAvailable = firstMixer?.stereoMode === "true_stereo";

  // Multi-select for auto-patching
  const channelIds = channels?.map((c) => c._id) ?? [];
  const selection = useChannelSelection({ channelIds });

  // Only track which cell is active - editing state is managed by each cell
  const [activeCell, setActiveCell] = useState<{ rowIndex: number; columnId: string } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Use refs to hold latest values so callbacks can be stable
  const channelsRef = useRef(channels);
  channelsRef.current = channels;

  const handleAddChannel = async () => {
    await createChannel({
      projectId,
      source: "",
    });
  };

  // Stable callback for saving cell values - uses ref so no dependency on channels
  const handleCellSave = useCallback((rowIndex: number, columnId: string, value: string) => {
    const channel = channelsRef.current?.[rowIndex];
    if (!channel) return;
    updateChannel({
      channelId: channel._id,
      [columnId]: value || undefined,
    });
  }, [updateChannel]);

  // Stable callback for cell navigation - uses ref so no dependency on channels
  const handleCellNavigate = useCallback((rowIndex: number, columnId: string, direction: "up" | "down" | "left" | "right" | "next" | "prev") => {
    const currentChannels = channelsRef.current;
    if (!currentChannels) return;
    const colIndex = ALL_COLUMNS.indexOf(columnId);
    let nextRowIndex = rowIndex;
    let nextColIndex = colIndex;

    switch (direction) {
      case "up":
        nextRowIndex = Math.max(0, rowIndex - 1);
        break;
      case "down":
        nextRowIndex = Math.min(currentChannels.length - 1, rowIndex + 1);
        break;
      case "left":
        nextColIndex = Math.max(0, colIndex - 1);
        break;
      case "right":
        nextColIndex = Math.min(ALL_COLUMNS.length - 1, colIndex + 1);
        break;
      case "next":
        nextColIndex = colIndex + 1;
        if (nextColIndex >= ALL_COLUMNS.length) {
          nextColIndex = 0;
          nextRowIndex = Math.min(currentChannels.length - 1, rowIndex + 1);
        }
        break;
      case "prev":
        nextColIndex = colIndex - 1;
        if (nextColIndex < 0) {
          nextColIndex = ALL_COLUMNS.length - 1;
          nextRowIndex = Math.max(0, rowIndex - 1);
        }
        break;
    }
    setActiveCell({ rowIndex: nextRowIndex, columnId: ALL_COLUMNS[nextColIndex] });
    containerRef.current?.focus();
  }, []);

  // Stable callback for activating a cell
  const handleCellActivate = useCallback((rowIndex: number, columnId: string) => {
    setActiveCell({ rowIndex, columnId });
  }, []);

  // Stable callback for copy from above (Alt+Enter) - uses ref so no dependency on channels
  const handleCopyFromAbove = useCallback((rowIndex: number, columnId: string): string | undefined => {
    const currentChannels = channelsRef.current;
    if (rowIndex <= 0 || !currentChannels) return undefined;
    const aboveChannel = currentChannels[rowIndex - 1];
    if (!aboveChannel) return undefined;
    const aboveValue = aboveChannel[columnId as keyof InputChannel];
    const valueStr = typeof aboveValue === "string" ? aboveValue : "";
    return incrementTrailingNumber(valueStr);
  }, []);

  const handleTableKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (portDropdownOpen !== null) return; // Port dropdown is open

    if (!activeCell) {
      // If no cell is active, activate first cell on any key
      if (channels && channels.length > 0) {
        setActiveCell({ rowIndex: 0, columnId: ALL_COLUMNS[0] });
      }
      return;
    }

    const { rowIndex, columnId } = activeCell;
    const colIndex = ALL_COLUMNS.indexOf(columnId);
    const isPortColumn = columnId === "port";

    // Only handle navigation for port column - EditableCell handles its own keyboard events
    if (!isPortColumn) {
      // Handle Alt+Arrow for moving rows
      if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
        e.preventDefault();
        const channel = channels?.[rowIndex];
        if (channel) {
          if (e.key === "ArrowUp" && rowIndex > 0) {
            moveChannel({ channelId: channel._id, direction: "up" });
            setActiveCell({ rowIndex: rowIndex - 1, columnId });
          } else if (e.key === "ArrowDown" && rowIndex < (channels?.length ?? 1) - 1) {
            moveChannel({ channelId: channel._id, direction: "down" });
            setActiveCell({ rowIndex: rowIndex + 1, columnId });
          }
        }
      } else if (e.altKey && e.key === "Enter") {
        // Alt+Enter: Copy value from cell above, increment trailing number, save, and move down
        e.preventDefault();
        const copiedValue = handleCopyFromAbove(rowIndex, columnId);
        if (copiedValue !== undefined) {
          handleCellSave(rowIndex, columnId, copiedValue);
          const nextRowIndex = Math.min((channels?.length ?? 1) - 1, rowIndex + 1);
          setActiveCell({ rowIndex: nextRowIndex, columnId });
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        setActiveCell(null);
      } else if (isStereoAvailable && (e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "s") {
        // Ctrl/Cmd+Shift+S: Toggle stereo for current row
        e.preventDefault();
        const channel = channels?.[rowIndex];
        if (channel) {
          handleToggleStereo(channel._id);
        }
      }
      return;
    }

    // Port column keyboard handling
    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        if (e.altKey) {
          const channel = channels?.[rowIndex];
          if (channel && rowIndex > 0) {
            moveChannel({ channelId: channel._id, direction: "up" });
            setActiveCell({ rowIndex: rowIndex - 1, columnId });
          }
        } else {
          setActiveCell({ rowIndex: Math.max(0, rowIndex - 1), columnId });
        }
        break;
      case "ArrowDown":
        e.preventDefault();
        if (e.altKey) {
          const channel = channels?.[rowIndex];
          if (channel && rowIndex < (channels?.length ?? 1) - 1) {
            moveChannel({ channelId: channel._id, direction: "down" });
            setActiveCell({ rowIndex: rowIndex + 1, columnId });
          }
        } else {
          setActiveCell({ rowIndex: Math.min((channels?.length ?? 1) - 1, rowIndex + 1), columnId });
        }
        break;
      case "ArrowLeft":
        e.preventDefault();
        setActiveCell({ rowIndex, columnId: ALL_COLUMNS[Math.max(0, colIndex - 1)] });
        break;
      case "ArrowRight":
        e.preventDefault();
        setActiveCell({ rowIndex, columnId: ALL_COLUMNS[Math.min(ALL_COLUMNS.length - 1, colIndex + 1)] });
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
          setActiveCell({ rowIndex: nextRowIndex, columnId: ALL_COLUMNS[nextColIndex] });
        }
        break;
      case "Delete":
      case "Backspace":
        e.preventDefault();
        {
          const channel = channels?.[rowIndex];
          if (channel) {
            handlePortSelect(channel._id, null);
          }
        }
        break;
      case "Escape":
        e.preventDefault();
        setActiveCell(null);
        break;
    }
  };

  const togglePatched = async (channelId: string, currentValue: boolean) => {
    await updateChannel({
      channelId: channelId as Id<"inputChannels">,
      patched: !currentValue,
    });
  };

  const handlePortSelect = async (channelId: string, portId: string | null) => {
    await patchChannel({
      channelId: channelId as Id<"inputChannels">,
      ioPortId: portId as Id<"ioPorts"> | null,
    });
  };

  const handlePortSelectStereo = async (channelId: string, portId: string | null, side: "left" | "right") => {
    const channel = channels?.find(c => c._id === channelId);
    if (!channel) return;

    await patchChannel({
      channelId: channelId as Id<"inputChannels">,
      ioPortId: side === "left" ? (portId as Id<"ioPorts"> | null) : (channel.ioPortId as Id<"ioPorts"> | null),
      ioPortIdRight: side === "right" ? (portId as Id<"ioPorts"> | null) : (channel.ioPortIdRight as Id<"ioPorts"> | null),
    });
  };

  const handleToggleStereo = async (channelId: string) => {
    await toggleStereoChannel({ channelId: channelId as Id<"inputChannels"> });
  };

  const isCellActive = (rowIndex: number, columnId: string) => {
    return activeCell?.rowIndex === rowIndex && activeCell?.columnId === columnId;
  };

  const patchedCount = channels?.filter((c) => c.patched).length ?? 0;

  const handleClearAllPatched = async () => {
    await clearAllPatched({ projectId });
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

      <div
        ref={containerRef}
        className="border rounded-lg overflow-hidden focus:outline-none"
        tabIndex={0}
        onKeyDown={handleTableKeyDown}
        onFocus={() => {
          if (!activeCell && channels && channels.length > 0) {
            setActiveCell({ rowIndex: 0, columnId: ALL_COLUMNS[0] });
          }
        }}
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
              <TableHead className="w-12 text-center">Ch#</TableHead>
              <TableHead className="w-32">Port</TableHead>
              <TableHead className="min-w-[120px]">Source</TableHead>
              <TableHead className="w-24">UHF</TableHead>
              <TableHead className="min-w-[100px]">Mic/Input</TableHead>
              <TableHead className="w-24">Location</TableHead>
              <TableHead className="w-24">Cable</TableHead>
              <TableHead className="w-24">Stand</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="w-16 text-center">
                <div className="flex items-center justify-center gap-1">
                  <span>Patched</span>
                  {patchedCount > 0 && (
                    <button
                      onClick={handleClearAllPatched}
                      className="h-5 w-5 rounded hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"
                      title={`Clear all ${patchedCount} patched checkbox${patchedCount !== 1 ? "es" : ""}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {channels.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                  No channels yet. Click &quot;Add Channel&quot; to get started.
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
                    {channel.channelNumber}
                  </TableCell>
                  {channel.isStereo ? (
                    <StereoPortSelectCell
                      valueLeft={channel.ioPortId}
                      valueRight={channel.ioPortIdRight}
                      portType="input"
                      currentChannelId={channel._id}
                      isActive={isCellActive(rowIndex, "port")}
                      onSelectLeft={(portId) => handlePortSelectStereo(channel._id, portId, "left")}
                      onSelectRight={(portId) => handlePortSelectStereo(channel._id, portId, "right")}
                      onCellClick={() => setActiveCell({ rowIndex, columnId: "port" })}
                      onOpenChange={(open) => setPortDropdownOpen(open ? rowIndex : null)}
                    />
                  ) : (
                    <PortSelectCell
                      value={channel.ioPortId}
                      portType="input"
                      currentChannelId={channel._id}
                      isActive={isCellActive(rowIndex, "port")}
                      onSelect={(portId) => handlePortSelect(channel._id, portId)}
                      onCellClick={() => setActiveCell({ rowIndex, columnId: "port" })}
                      onOpenChange={(open) => setPortDropdownOpen(open ? rowIndex : null)}
                    />
                  )}

                  {/* Editable Cells */}
                  {EDITABLE_COLUMNS.map((columnId) => (
                    <EditableCell
                      key={columnId}
                      value={channel[columnId as keyof InputChannel] as string | undefined}
                      isActive={isCellActive(rowIndex, columnId)}
                      rowIndex={rowIndex}
                      columnId={columnId}
                      onSave={handleCellSave}
                      onNavigate={handleCellNavigate}
                      onActivate={handleCellActivate}
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
                        {isStereoAvailable && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleToggleStereo(channel._id)}
                            >
                              {channel.isStereo ? "Mono" : "Stereo"}
                            </DropdownMenuItem>
                          </>
                        )}
                        <DropdownMenuSeparator />
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
        channelType="input"
        selectedChannelIds={selection.getSelectedInOrder()}
        onComplete={selection.clearSelection}
      />
    </div>
  );
}

interface EditableCellProps {
  value: string | undefined;
  isActive: boolean;
  rowIndex: number;
  columnId: string;
  onSave: (rowIndex: number, columnId: string, value: string) => void;
  onNavigate: (rowIndex: number, columnId: string, direction: "up" | "down" | "left" | "right" | "next" | "prev") => void;
  onActivate: (rowIndex: number, columnId: string) => void;
}

const EditableCell = memo(function EditableCell({
  value,
  isActive,
  rowIndex,
  columnId,
  onSave,
  onNavigate,
  onActivate,
}: EditableCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Handle external activation (keyboard nav to this cell while it should edit)
  useEffect(() => {
    if (!isActive && isEditing) {
      // Lost focus, save and stop editing
      onSave(rowIndex, columnId, editValue);
      setIsEditing(false);
    }
  }, [isActive, isEditing, editValue, rowIndex, columnId, onSave]);

  const startEditing = useCallback((initialValue?: string) => {
    setEditValue(initialValue ?? value ?? "");
    setIsEditing(true);
  }, [value]);

  const handleClick = useCallback(() => {
    onActivate(rowIndex, columnId);
    startEditing();
  }, [rowIndex, columnId, onActivate, startEditing]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case "Enter":
        e.preventDefault();
        onSave(rowIndex, columnId, editValue);
        setIsEditing(false);
        onNavigate(rowIndex, columnId, "down");
        break;
      case "Tab":
        e.preventDefault();
        onSave(rowIndex, columnId, editValue);
        setIsEditing(false);
        onNavigate(rowIndex, columnId, e.shiftKey ? "prev" : "next");
        break;
      case "Escape":
        e.preventDefault();
        setIsEditing(false);
        setEditValue(value ?? "");
        break;
      case "ArrowUp":
      case "ArrowDown":
      case "ArrowLeft":
      case "ArrowRight":
        e.preventDefault();
        onSave(rowIndex, columnId, editValue);
        setIsEditing(false);
        onNavigate(rowIndex, columnId, e.key.replace("Arrow", "").toLowerCase() as "up" | "down" | "left" | "right");
        break;
    }
  }, [rowIndex, columnId, editValue, value, onSave, onNavigate]);

  const handleBlur = useCallback(() => {
    onSave(rowIndex, columnId, editValue);
    setIsEditing(false);
  }, [rowIndex, columnId, editValue, onSave]);

  // Handle keyboard events when cell is active but not editing
  useEffect(() => {
    if (!isActive || isEditing) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Alt+Enter is handled by parent component
      if (e.altKey) return;

      switch (e.key) {
        case "Enter":
        case "F2":
          e.preventDefault();
          startEditing();
          break;
        case "Delete":
        case "Backspace":
          e.preventDefault();
          onSave(rowIndex, columnId, "");
          break;
        default:
          // Start editing on alphanumeric input
          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            startEditing(e.key);
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isActive, isEditing, rowIndex, columnId, startEditing, onSave]);

  return (
    <TableCell
      className={`cursor-pointer transition-colors ${
        isActive
          ? "ring-2 ring-primary ring-inset bg-primary/5"
          : "hover:bg-muted/50"
      }`}
      onClick={handleClick}
    >
      {isEditing ? (
        <Input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
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
