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
import { Check, Filter, ChevronDown, Trash2, X } from "lucide-react";
import { usePortData } from "./port-data-context";
import { Input } from "@/components/ui/input";
import { ClearPatchesDialog } from "./clear-patches-dialog";
import { ClearDevicePatchesDialog } from "./clear-device-patches-dialog";
import { useUndoRedo } from "@/hooks/use-undo-redo";
import { useActiveMixer } from "./active-mixer-context";
import { useOutputPatchWithConflict, OutputPatchConflictDialog } from "./output-patch-conflict-dialog";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

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
  const [editingChannel, setEditingChannel] = useState<{ id: string; name: string; stereoSide: "left" | "right" | null } | null>(null);
  const [showGlobalClearDialog, setShowGlobalClearDialog] = useState(false);
  const [deviceToClear, setDeviceToClear] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const deviceLabelRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const deviceHeaderRefs = useRef<Map<string, HTMLTableCellElement>>(new Map());

  // Active mixer
  const { activeMixerId, activeMixer } = useActiveMixer();

  // Queries scoped to active mixer
  const inputChannels = useQuery(api.inputChannels.list, { projectId, mixerId: activeMixerId ?? undefined });
  const outputChannels = useQuery(api.outputChannels.list, { projectId, mixerId: activeMixerId ?? undefined });

  // Check if stereo mode is available
  const isStereoAvailable = activeMixer?.stereoMode === "true_stereo";

  // Get port groups from context instead of separate query
  const { inputPortGroups, outputPortGroups, portUsageMap, isLoading: portDataLoading } = usePortData();
  const portGroups = channelType === "input" ? inputPortGroups : outputPortGroups;

  // Mutations
  const patchInputChannel = useMutation(api.patching.patchInputChannel);
  const patchOutputChannelDirect = useMutation(api.patching.patchOutputChannel);
  const batchPatchChannels = useMutation(api.patching.batchPatchChannels);
  const toggleInputStereo = useMutation(api.inputChannels.toggleStereo);
  const toggleOutputStereo = useMutation(api.outputChannels.toggleStereo);
  const updateInputChannel = useMutation(api.inputChannels.update);
  const updateOutputChannel = useMutation(api.outputChannels.update);
  const clearPatches = useMutation(api.patching.clearPatches);
  const { patchWithConflictCheck, conflict, confirmForce, cancelConflict } = useOutputPatchWithConflict();

  const { pushAction } = useUndoRedo();

  const rawChannels = channelType === "input" ? inputChannels : outputChannels;

  // Expand stereo channels into L/R rows
  const channels = useMemo(() => {
    if (!rawChannels) return null;
    const expanded: Array<{
      _id: string;
      originalChannel: typeof rawChannels[number];
      stereoSide: "left" | "right" | null;
      ioPortId: string | undefined;
    }> = [];

    for (const channel of rawChannels) {
      if (channel.isStereo) {
        // Add left row
        expanded.push({
          _id: `${channel._id}-L`,
          originalChannel: channel,
          stereoSide: "left",
          ioPortId: channel.ioPortId,
        });
        // Add right row
        expanded.push({
          _id: `${channel._id}-R`,
          originalChannel: channel,
          stereoSide: "right",
          ioPortId: channel.ioPortIdRight,
        });
      } else {
        // Mono channel - single row
        expanded.push({
          _id: channel._id,
          originalChannel: channel,
          stereoSide: null,
          ioPortId: channel.ioPortId,
        });
      }
    }
    return expanded;
  }, [rawChannels]);

  // Filter port groups by selected devices
  const filteredPortGroups = useMemo(
    () =>
      portGroups?.filter((group) => selectedDeviceIds.has(group.device._id)) ?? [],
    [portGroups, selectedDeviceIds]
  );

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
  rawChannels?.forEach((channel) => {
    if (channel.ioPortId) {
      portToChannelMap.set(channel.ioPortId, channel._id);
    }
    if (channel.ioPortIdRight) {
      portToChannelMap.set(channel.ioPortIdRight, channel._id);
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
      isShiftClick: boolean,
      stereoSide: "left" | "right" | null
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
          const cells = getDiagonalCells(diagonalAnchor, end);
          const patches = cells
            .filter((cell) => cell.row < channels.length && cell.col < visiblePorts.length)
            .map((cell) => {
              const expandedRow = channels[cell.row];
              return {
                channelId: expandedRow.originalChannel._id,
                ioPortId: diagonalAnchor.mode === "patch" ? visiblePorts[cell.col]._id : null,
                stereoSide: expandedRow.stereoSide,
              };
            });

          if (patches.length > 0) {
            // Capture old port ids for undo (respecting stereo side)
            const oldPatches = patches.map((p) => {
              const ch = rawChannels?.find((c) => c._id === p.channelId);
              const oldPortId = p.stereoSide === "right"
                ? (ch?.ioPortIdRight ?? null)
                : (ch?.ioPortId ?? null);
              return { channelId: p.channelId, ioPortId: oldPortId, stereoSide: p.stereoSide };
            });

            await batchPatchChannels({ channelType, patches });
            pushAction({
              label: "Diagonal patch",
              undo: async () => { await batchPatchChannels({ channelType, patches: oldPatches }); },
              redo: async () => { await batchPatchChannels({ channelType, patches }); },
            });
          }
        }
        setDiagonalAnchor(null);
        return;
      }

      // Normal click behavior - handle stereo side
      const channel = rawChannels?.find((c) => c._id === channelId);

      if (channelType === "input") {
        // Input channels: no cross-mixer conflict
        if (stereoSide === "right") {
          const oldPortIdRight = (channel?.ioPortIdRight as Id<"ioPorts">) ?? null;
          const leftPortId = (channel?.ioPortId as Id<"ioPorts">) ?? null;
          const newPortIdRight = isAssigned ? null : (portId as Id<"ioPorts">);
          await patchInputChannel({ channelId: channelId as Id<"inputChannels">, ioPortId: leftPortId, ioPortIdRight: newPortIdRight });
          pushAction({
            label: "Toggle patch",
            undo: async () => { await patchInputChannel({ channelId: channelId as Id<"inputChannels">, ioPortId: leftPortId, ioPortIdRight: oldPortIdRight }); },
            redo: async () => { await patchInputChannel({ channelId: channelId as Id<"inputChannels">, ioPortId: leftPortId, ioPortIdRight: newPortIdRight }); },
          });
        } else {
          const oldPortId = (channel?.ioPortId as Id<"ioPorts">) ?? null;
          const newPortId = isAssigned ? null : (portId as Id<"ioPorts">);
          const rightPortId = stereoSide === "left" ? ((channel?.ioPortIdRight as Id<"ioPorts">) ?? null) : undefined;
          await patchInputChannel({ channelId: channelId as Id<"inputChannels">, ioPortId: newPortId, ioPortIdRight: rightPortId });
          pushAction({
            label: "Toggle patch",
            undo: async () => { await patchInputChannel({ channelId: channelId as Id<"inputChannels">, ioPortId: oldPortId, ioPortIdRight: rightPortId }); },
            redo: async () => { await patchInputChannel({ channelId: channelId as Id<"inputChannels">, ioPortId: newPortId, ioPortIdRight: rightPortId }); },
          });
        }
      } else {
        // Output channels: check for cross-mixer conflicts
        const id = channelId as Id<"outputChannels">;
        if (stereoSide === "right") {
          const oldPortIdRight = (channel?.ioPortIdRight as Id<"ioPorts">) ?? null;
          const leftPortId = (channel?.ioPortId as Id<"ioPorts">) ?? null;
          const newPortIdRight = isAssigned ? null : (portId as Id<"ioPorts">);
          await patchWithConflictCheck({
            channelId: id, ioPortId: leftPortId, ioPortIdRight: newPortIdRight,
            onSuccess: () => pushAction({
              label: "Toggle patch",
              undo: async () => { await patchOutputChannelDirect({ channelId: id, ioPortId: leftPortId, ioPortIdRight: oldPortIdRight, force: true }); },
              redo: async () => { await patchOutputChannelDirect({ channelId: id, ioPortId: leftPortId, ioPortIdRight: newPortIdRight, force: true }); },
            }),
          });
        } else {
          const oldPortId = (channel?.ioPortId as Id<"ioPorts">) ?? null;
          const newPortId = isAssigned ? null : (portId as Id<"ioPorts">);
          const rightPortId = stereoSide === "left" ? ((channel?.ioPortIdRight as Id<"ioPorts">) ?? null) : undefined;
          await patchWithConflictCheck({
            channelId: id, ioPortId: newPortId, ioPortIdRight: rightPortId,
            onSuccess: () => pushAction({
              label: "Toggle patch",
              undo: async () => { await patchOutputChannelDirect({ channelId: id, ioPortId: oldPortId, ioPortIdRight: rightPortId, force: true }); },
              redo: async () => { await patchOutputChannelDirect({ channelId: id, ioPortId: newPortId, ioPortIdRight: rightPortId, force: true }); },
            }),
          });
        }
      }
    },
    [channelType, patchInputChannel, patchOutputChannelDirect, patchWithConflictCheck, batchPatchChannels, channels, rawChannels, visiblePorts, diagonalAnchor, isValidDiagonal, getDiagonalCells, pushAction]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!activeCell || !channels?.length || !visiblePorts.length) return;
      if (editingChannel) return;

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
            handleCellClick(row, col, port._id, channel.originalChannel._id, channel.ioPortId, e.shiftKey, channel.stereoSide);
          }
          break;
        case "Escape":
          e.preventDefault();
          setActiveCell(null);
          setDiagonalAnchor(null);
          break;
      }
    },
    [activeCell, channels, visiblePorts, handleCellClick, editingChannel]
  );

  // Handle toggling stereo mode for a channel
  const handleToggleStereo = useCallback(
    async (channelId: string) => {
      const ch = rawChannels?.find((c) => c._id === channelId);
      const oldIsStereo = ch?.isStereo ?? false;
      const oldPortIdRight = ch?.ioPortIdRight as Id<"ioPorts"> | undefined;
      const oldPortId = ch?.ioPortId as Id<"ioPorts"> | undefined;

      if (channelType === "input") {
        const id = channelId as Id<"inputChannels">;
        await toggleInputStereo({ channelId: id });
        pushAction({
          label: "Toggle stereo",
          undo: async () => {
            await toggleInputStereo({ channelId: id });
            if (oldIsStereo && oldPortIdRight) {
              await patchInputChannel({ channelId: id, ioPortId: oldPortId ?? null, ioPortIdRight: oldPortIdRight });
            }
          },
          redo: async () => { await toggleInputStereo({ channelId: id }); },
        });
      } else {
        const id = channelId as Id<"outputChannels">;
        await toggleOutputStereo({ channelId: id });
        pushAction({
          label: "Toggle stereo",
          undo: async () => {
            await toggleOutputStereo({ channelId: id });
            if (oldIsStereo && oldPortIdRight) {
              await patchOutputChannelDirect({ channelId: id, ioPortId: oldPortId ?? null, ioPortIdRight: oldPortIdRight, force: true });
            }
          },
          redo: async () => { await toggleOutputStereo({ channelId: id }); },
        });
      }
    },
    [channelType, toggleInputStereo, toggleOutputStereo, pushAction, rawChannels, patchInputChannel, patchOutputChannelDirect]
  );

  // Handle saving channel name
  const handleSaveChannelName = useCallback(
    async (channelId: string, name: string) => {
      const oldName = editingChannel?.name ?? "";
      if (channelType === "input") {
        const id = channelId as Id<"inputChannels">;
        await updateInputChannel({ channelId: id, source: name });
        pushAction({
          label: "Edit channel name",
          undo: async () => { await updateInputChannel({ channelId: id, source: oldName }); },
          redo: async () => { await updateInputChannel({ channelId: id, source: name }); },
        });
      } else {
        const id = channelId as Id<"outputChannels">;
        await updateOutputChannel({ channelId: id, busName: name });
        pushAction({
          label: "Edit channel name",
          undo: async () => { await updateOutputChannel({ channelId: id, busName: oldName }); },
          redo: async () => { await updateOutputChannel({ channelId: id, busName: name }); },
        });
      }
      setEditingChannel(null);
    },
    [channelType, updateInputChannel, updateOutputChannel, pushAction, editingChannel]
  );

  // Calculate count of channels with patches
  const getGlobalClearCount = useMemo(() => {
    return rawChannels?.filter(ch => ch.ioPortId || ch.ioPortIdRight).length ?? 0;
  }, [rawChannels]);

  // Get info about which channels would be cleared for a specific device
  const getDeviceClearInfo = useCallback((deviceId: string) => {
    const portGroup = filteredPortGroups.find(g => g.device._id === deviceId);
    if (!portGroup) return { count: 0, channelIds: [] };

    const devicePortIds = new Set(portGroup.ports.map(p => p._id));
    const affectedChannels = rawChannels?.filter(ch =>
      (ch.ioPortId && devicePortIds.has(ch.ioPortId)) ||
      (ch.ioPortIdRight && devicePortIds.has(ch.ioPortIdRight))
    ) ?? [];

    return {
      count: affectedChannels.length,
      channelIds: affectedChannels.map(ch => ch._id)
    };
  }, [filteredPortGroups, rawChannels]);

  // Handle global clear of all patches
  const handleGlobalClear = useCallback(async () => {
    const channelIds = rawChannels?.map(ch => ch._id) ?? [];
    if (channelType === "input") {
      await clearPatches({ inputChannelIds: channelIds as Id<"inputChannels">[] });
    } else {
      await clearPatches({ outputChannelIds: channelIds as Id<"outputChannels">[] });
    }
    setShowGlobalClearDialog(false);
  }, [channelType, rawChannels, clearPatches]);

  // Handle device-specific clear of patches
  const handleDeviceClear = useCallback(async (deviceId: string) => {
    const { channelIds } = getDeviceClearInfo(deviceId);
    if (channelIds.length === 0) return;

    if (channelType === "input") {
      await clearPatches({ inputChannelIds: channelIds as Id<"inputChannels">[] });
    } else {
      await clearPatches({ outputChannelIds: channelIds as Id<"outputChannels">[] });
    }
    setDeviceToClear(null);
  }, [channelType, getDeviceClearInfo, clearPatches]);

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
  }, [deviceIds, isDeviceFilterInitialized]);

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

  // Calculate device spans for two-row header
  const deviceSpans = useMemo(() => {
    const spans: Array<{
      deviceId: string;
      device: typeof visiblePorts[0]['device'];
      portCount: number;
    }> = [];

    let currentDeviceId: string | null = null;
    let currentDevice: typeof visiblePorts[0]['device'] | null = null;
    let currentCount = 0;

    visiblePorts.forEach((port) => {
      if (port.device._id !== currentDeviceId) {
        // Save previous device span
        if (currentDeviceId !== null && currentDevice !== null) {
          spans.push({
            deviceId: currentDeviceId,
            device: currentDevice,
            portCount: currentCount,
          });
        }
        // Start new device
        currentDeviceId = port.device._id;
        currentDevice = port.device;
        currentCount = 1;
      } else {
        currentCount++;
      }
    });

    // Add last device
    if (currentDeviceId !== null && currentDevice !== null) {
      spans.push({
        deviceId: currentDeviceId,
        device: currentDevice,
        portCount: currentCount,
      });
    }

    return spans;
  }, [visiblePorts]);

  // Handle sticky device labels on horizontal scroll
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const STICKY_LEFT = 180; // Width of the row label column

    const handleScroll = () => {
      const scrollLeft = container.scrollLeft;

      deviceHeaderRefs.current.forEach((th, deviceId) => {
        const labelDiv = deviceLabelRefs.current.get(deviceId);
        if (!th || !labelDiv) return;

        // Get the th's left position in the scrollable content
        const thLeft = th.offsetLeft;
        const thWidth = th.offsetWidth;

        // Calculate how much the label needs to offset to stay at STICKY_LEFT
        const stickyPoint = scrollLeft + STICKY_LEFT;

        if (stickyPoint > thLeft && stickyPoint < thLeft + thWidth - 100) {
          // The label should stick
          const offset = stickyPoint - thLeft;
          labelDiv.style.transform = `translateX(${offset}px)`;
        } else {
          // Reset to normal position
          labelDiv.style.transform = 'translateX(0)';
        }
      });
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial calculation

    return () => container.removeEventListener('scroll', handleScroll);
  }, [deviceSpans]);

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

  if (!channels || portDataLoading) {
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
          <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
            <button
              onClick={() => setChannelType("input")}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                channelType === "input"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Input
            </button>
            <button
              onClick={() => setChannelType("output")}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                channelType === "output"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Output
            </button>
          </div>
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
            <DropdownMenuContent align="start" className="w-56">
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
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-muted-foreground">
            Arrow keys navigate · Space/Enter toggle · Shift+Click diagonal · Esc deselect
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowGlobalClearDialog(true)}
            disabled={getGlobalClearCount === 0}
            className="text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear All Patches
          </Button>
        </div>
      </div>

      {/* Matrix or Empty State */}
      {noDevicesSelected ? (
        <div className="text-center py-12 text-muted-foreground border rounded-lg">
          No devices selected. Use the Devices filter to select which devices to show.
        </div>
      ) : (
        <TooltipProvider delayDuration={200}>
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
        <table className="w-full border-separate border-spacing-0">
          <thead className="sticky top-0 z-20 bg-background">
            {/* Row 1: Device Headers */}
            <tr>
              {/* Corner cell with rowspan="2" */}
              <th
                rowSpan={2}
                className="sticky left-0 top-0 z-30 bg-muted border-b border-r p-2 text-xs font-medium min-w-[180px] h-[72px]"
              >
                <div className="relative h-full">
                  {channelType === "input" ? (
                    <>
                      <div className="absolute bottom-6 right-0 flex items-end gap-1">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">From</span>
                      </div>
                      <div className="absolute bottom-0 right-0 flex items-end gap-1">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">To</span>
                        <svg viewBox="0 0 32 32" className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M 28 4 C 28 18, 28 24, 12 24" strokeLinecap="round" />
                          <path d="M 17 19 L 12 24 L 17 29" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                        </svg>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="absolute bottom-6 right-0 flex items-end gap-1">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">To</span>
                      </div>
                      <div className="absolute bottom-0 right-0 flex items-end gap-1">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">From</span>
                        <svg viewBox="0 0 32 32" className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M 12 24 C 28 24, 28 18, 28 4" strokeLinecap="round" />
                          <path d="M 23 9 L 28 4 L 33 9" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                        </svg>
                      </div>
                    </>
                  )}
                </div>
              </th>

              {/* Device headers with colspan */}
              {deviceSpans.map((span) => {
                const clearInfo = getDeviceClearInfo(span.deviceId);
                return (
                  <th
                    key={span.deviceId}
                    colSpan={span.portCount}
                    className="border-b border-l-2 p-0 bg-muted overflow-visible"
                    ref={(el) => {
                      if (el) deviceHeaderRefs.current.set(span.deviceId, el);
                      else deviceHeaderRefs.current.delete(span.deviceId);
                    }}
                  >
                    <div className="flex flex-col gap-1 overflow-visible">
                      {/* Device name - transforms applied via JS for sticky behavior */}
                      <div
                        ref={(el) => {
                          if (el) deviceLabelRefs.current.set(span.deviceId, el);
                          else deviceLabelRefs.current.delete(span.deviceId);
                        }}
                        className="flex items-center gap-2 px-2 pt-2 w-fit"
                      >
                        <span className="text-sm font-semibold whitespace-nowrap bg-muted pr-2">{span.device.name}</span>
                        {clearInfo.count > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeviceToClear(span.deviceId)}
                            className="h-5 w-5 p-0"
                            title={`Clear ${clearInfo.count} patch${clearInfo.count !== 1 ? 'es' : ''}`}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>

                      {/* Color bar - full width */}
                      <div
                        className="h-2 rounded-sm mx-1 mb-1"
                        style={{ backgroundColor: span.device.color }}
                      />
                    </div>
                  </th>
                );
              })}
            </tr>

            {/* Row 2: Port Labels */}
            <tr>
              {visiblePorts.map((port, colIndex) => {
                const isFirstOfDevice =
                  colIndex === 0 ||
                  visiblePorts[colIndex - 1]?.device._id !== port.device._id;

                return (
                  <th
                    key={port._id}
                    className={cn(
                      "border-b p-2 text-center text-xs font-medium min-w-[50px] bg-muted transition-colors",
                      isFirstOfDevice && "border-l-2",
                      activeCell?.col === colIndex && "bg-accent"
                    )}
                  >
                    <span className="font-mono text-[10px]">
                      {port.label.replace(`${port.device.shortName}-`, "")}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {channels.map((channel, rowIndex) => {
              const orig = channel.originalChannel;
              const channelNumber = channelType === "input"
                ? (orig as { channelNumber?: number }).channelNumber ?? rowIndex + 1
                : rowIndex + 1;
              const channelName = channelType === "input"
                ? (orig as { source?: string }).source
                : (orig as { busName?: string }).busName;

              const isEditingThisChannel = editingChannel?.id === orig._id && editingChannel?.stereoSide === channel.stereoSide;

              return (
                <tr key={channel._id}>
                  {/* Channel label cell */}
                  <td
                    className={cn(
                      "sticky left-0 z-10 border-r p-1 text-xs transition-colors",
                      activeCell?.row === rowIndex ? "bg-accent" : hoveredCell?.row === rowIndex ? "bg-muted" : "bg-background"
                    )}
                  >
                    <div className="flex items-center gap-1">
                      <span className="font-mono font-medium w-6 text-right shrink-0">
                        {channelNumber}
                      </span>
                      {isEditingThisChannel ? (
                        <Input
                          autoFocus
                          className="h-6 text-xs px-1 flex-1 min-w-0"
                          defaultValue={editingChannel.name}
                          onBlur={(e) => handleSaveChannelName(orig._id, e.target.value)}
                          onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === "Enter") {
                              handleSaveChannelName(orig._id, e.currentTarget.value);
                            } else if (e.key === "Escape") {
                              setEditingChannel(null);
                            }
                          }}
                        />
                      ) : (
                        <span
                          className="text-muted-foreground truncate flex-1 min-w-0 cursor-text hover:text-foreground"
                          onClick={() => setEditingChannel({ id: orig._id, name: channelName || "", stereoSide: channel.stereoSide })}
                        >
                          {channelName || "-"}
                        </span>
                      )}
                      {/* Stereo/Mono badge - fixed width for alignment */}
                      {isStereoAvailable && (
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] px-1 py-0 h-4 w-5 shrink-0 cursor-pointer flex items-center justify-center font-semibold",
                            channel.stereoSide === "left" && "bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-100 dark:border-blue-700 dark:hover:bg-blue-800",
                            channel.stereoSide === "right" && "bg-red-100 text-red-800 border-red-300 hover:bg-red-200 dark:bg-red-900 dark:text-red-100 dark:border-red-700 dark:hover:bg-red-800",
                            channel.stereoSide === null && "bg-gray-100 text-gray-800 border-gray-300 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600 dark:hover:bg-gray-600"
                          )}
                          onClick={() => handleToggleStereo(orig._id)}
                          title={channel.stereoSide ? "Click to switch to Mono" : "Click to switch to Stereo"}
                        >
                          {channel.stereoSide === "left" ? "L" : channel.stereoSide === "right" ? "R" : "M"}
                        </Badge>
                      )}
                    </div>
                  </td>
                  {/* Matrix cells */}
                  {visiblePorts.map((port, colIndex) => {
                    const isAssigned = channel.ioPortId === port._id;
                    const isActive =
                      activeCell?.row === rowIndex && activeCell?.col === colIndex;
                    const otherChannelId = portToChannelMap.get(port._id);
                    // For stereo channels, don't mark the opposite side's port as "used by other"
                    const isUsedByOther =
                      otherChannelId && otherChannelId !== orig._id;

                    // Cross-mixer detection: check if port is used by a channel on a different mixer
                    const portUsage = portUsageMap[port._id];
                    const crossMixerEntry = activeMixerId && portUsage && channelType === "output"
                      ? (Array.isArray(portUsage) ? portUsage : [portUsage]).find(
                          (entry) => entry.mixerId && entry.mixerId !== activeMixerId && entry.channelType === "output"
                        )
                      : undefined;
                    const isUsedByCrossMixer = !!crossMixerEntry;

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

                    // Tooltip for cross-mixer usage
                    const crossMixerTitle = crossMixerEntry
                      ? `Used by Ch ${crossMixerEntry.channelNumber} on ${crossMixerEntry.mixerName}`
                      : undefined;

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
                            isHovered
                              ? "bg-primary/15"
                              : isInCrosshair && isAssigned
                              ? "bg-primary/30"
                              : isInCrosshair
                              ? "bg-muted/40"
                              : isAssigned
                              ? "bg-primary/20"
                              : isUsedByCrossMixer
                              ? "bg-orange-100/40 dark:bg-orange-900/20"
                              : isUsedByOther
                              ? "bg-muted/30"
                              : "hover:bg-muted/50"
                          )
                        )}
                        onClick={(e) => {
                          setActiveCell({ row: rowIndex, col: colIndex });
                          handleCellClick(rowIndex, colIndex, port._id, orig._id, channel.ioPortId, e.shiftKey, channel.stereoSide);
                        }}
                        onMouseEnter={() => setHoveredCell({ row: rowIndex, col: colIndex })}
                        onMouseLeave={() => setHoveredCell(null)}
                      >
                        {isUsedByCrossMixer && !isAssigned ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="w-full h-8 flex items-center justify-center">
                                <span className="text-xs font-bold text-orange-500 dark:text-orange-400">×</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              {crossMixerTitle}
                            </TooltipContent>
                          </Tooltip>
                        ) : (
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
                        )}
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
          <div className="flex items-center gap-6 text-xs text-muted-foreground flex-wrap">
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
              <div className="w-4 h-4 bg-orange-100/40 dark:bg-orange-900/20 border rounded flex items-center justify-center">
                <span className="text-[10px] font-bold text-orange-500 dark:text-orange-400">×</span>
              </div>
              <span>Used by another mixer</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border rounded" />
              <span>Available</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="text-[10px] px-1 py-0 h-4 bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600">M</Badge>
              <Badge className="text-[10px] px-1 py-0 h-4 bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900 dark:text-blue-100 dark:border-blue-700">L</Badge>
              <Badge className="text-[10px] px-1 py-0 h-4 bg-red-100 text-red-800 border-red-300 dark:bg-red-900 dark:text-red-100 dark:border-red-700">R</Badge>
              <span>Click to toggle Mono/Stereo</span>
            </div>
          </div>
        </TooltipProvider>
      )}

      {/* Clear patches dialogs */}
      <ClearPatchesDialog
        open={showGlobalClearDialog}
        onOpenChange={setShowGlobalClearDialog}
        channelType={channelType}
        channelCount={getGlobalClearCount}
        onConfirm={handleGlobalClear}
      />

      {deviceToClear && (() => {
        const device = filteredPortGroups.find(g => g.device._id === deviceToClear)?.device;
        const clearInfo = getDeviceClearInfo(deviceToClear);
        return device ? (
          <ClearDevicePatchesDialog
            open={true}
            onOpenChange={(open) => !open && setDeviceToClear(null)}
            deviceName={device.name}
            deviceColor={device.color}
            channelType={channelType}
            channelCount={clearInfo.count}
            onConfirm={() => handleDeviceClear(deviceToClear)}
          />
        ) : null;
      })()}

      <OutputPatchConflictDialog
        conflict={conflict}
        onConfirm={confirmForce}
        onCancel={cancelConflict}
      />
    </div>
  );
}
