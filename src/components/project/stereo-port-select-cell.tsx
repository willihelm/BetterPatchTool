"use client";

import { useState, useRef, useEffect, memo } from "react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TableCell } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { usePortData } from "./port-data-context";
import { ChevronDown } from "lucide-react";

interface StereoPortSelectCellProps {
  valueLeft: string | undefined;
  valueRight: string | undefined;
  portType: "input" | "output";
  currentChannelId: string;
  isActive: boolean;
  activeSubCell?: "left" | "right"; // Which sub-cell is active
  onSelectLeft: (portId: string | null) => void;
  onSelectRight: (portId: string | null) => void;
  onCellClick: () => void;
  onSubCellClick?: (side: "left" | "right") => void;
  onOpenChange?: (open: boolean) => void;
}

export const StereoPortSelectCell = memo(function StereoPortSelectCell({
  valueLeft,
  valueRight,
  portType,
  currentChannelId,
  isActive,
  activeSubCell,
  onSelectLeft,
  onSelectRight,
  onCellClick,
  onSubCellClick,
  onOpenChange,
}: StereoPortSelectCellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentSide, setCurrentSide] = useState<"left" | "right">("left");
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Get data from context
  const { portInfoMap, portUsageMap, inputPortGroups, outputPortGroups } = usePortData();

  // Get the port groups based on type
  const portGroups = portType === "input" ? inputPortGroups : outputPortGroups;

  // Get current port info for display
  const currentPortInfoLeft = valueLeft ? portInfoMap[valueLeft] : null;
  const currentPortInfoRight = valueRight ? portInfoMap[valueRight] : null;

  // Handle open state changes
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    onOpenChange?.(open);
  };

  // Open dropdown when cell becomes active
  useEffect(() => {
    if (isActive && !isOpen) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Enter" || e.key === "F2") {
          e.preventDefault();
          setIsOpen(true);
        } else if (e.key === "Tab") {
          // Tab between left and right
          e.preventDefault();
          if (currentSide === "left") {
            setCurrentSide("right");
            onSubCellClick?.("right");
          } else {
            setCurrentSide("left");
            onSubCellClick?.("left");
          }
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isActive, isOpen, currentSide, onSubCellClick]);

  const handleSelectPort = (portId: string | null) => {
    if (currentSide === "left") {
      onSelectLeft(portId);
      // After selecting left, move to right
      setCurrentSide("right");
      onSubCellClick?.("right");
    } else {
      onSelectRight(portId);
      setIsOpen(false);
    }
  };

  const currentValue = currentSide === "left" ? valueLeft : valueRight;
  const currentPortInfo = currentSide === "left" ? currentPortInfoLeft : currentPortInfoRight;

  return (
    <TableCell
      className={cn(
        "cursor-pointer transition-colors p-0",
        isActive
          ? "ring-2 ring-primary ring-inset bg-primary/5"
          : "hover:bg-muted/50"
      )}
      onClick={onCellClick}
    >
      <div className="flex flex-col h-full px-2 py-1 gap-0.5">
        {/* Left Port */}
        <DropdownMenu open={isOpen && currentSide === "left"} onOpenChange={(open) => {
          if (open) {
            setCurrentSide("left");
            handleOpenChange(true);
          } else if (currentSide === "left") {
            handleOpenChange(false);
          }
        }}>
          <DropdownMenuTrigger asChild>
            <button
              ref={currentSide === "left" ? triggerRef : undefined}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setCurrentSide("left");
                onSubCellClick?.("left");
              }}
              className={cn(
                "flex items-center justify-between w-full px-1.5 py-0.5 rounded",
                "bg-transparent outline-none focus:outline-none focus-visible:outline-none",
                currentSide === "left" && isActive && "ring-1 ring-primary/50"
              )}
            >
              <div className="flex items-center gap-1 flex-1">
                <span className="text-[10px] text-muted-foreground font-medium w-3">L</span>
                {currentPortInfoLeft ? (
                  <Badge
                    variant="outline"
                    className="font-mono text-[10px] px-1 py-0"
                    style={{
                      borderColor: currentPortInfoLeft.deviceColor,
                      color: currentPortInfoLeft.deviceColor,
                    }}
                  >
                    {currentPortInfoLeft.label}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground text-[10px]">-</span>
                )}
              </div>
              <ChevronDown className="h-3 w-3 opacity-50 flex-shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuItem onClick={() => handleSelectPort(null)}>
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
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent className="max-h-64 overflow-y-auto min-w-40">
                      {group.ports.map((port) => {
                        const usage = portUsageMap[port._id];
                        const isUsedByOther =
                          usage && usage.channelId !== currentChannelId;
                        const isCurrentPort = port._id === valueLeft;

                        return (
                          <DropdownMenuItem
                            key={port._id}
                            onClick={() => handleSelectPort(port._id)}
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
                  </DropdownMenuPortal>
                </DropdownMenuSub>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Right Port */}
        <DropdownMenu open={isOpen && currentSide === "right"} onOpenChange={(open) => {
          if (open) {
            setCurrentSide("right");
            handleOpenChange(true);
          } else if (currentSide === "right") {
            handleOpenChange(false);
          }
        }}>
          <DropdownMenuTrigger asChild>
            <button
              ref={currentSide === "right" ? triggerRef : undefined}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setCurrentSide("right");
                onSubCellClick?.("right");
              }}
              className={cn(
                "flex items-center justify-between w-full px-1.5 py-0.5 rounded",
                "bg-transparent outline-none focus:outline-none focus-visible:outline-none",
                currentSide === "right" && isActive && "ring-1 ring-primary/50"
              )}
            >
              <div className="flex items-center gap-1 flex-1">
                <span className="text-[10px] text-muted-foreground font-medium w-3">R</span>
                {currentPortInfoRight ? (
                  <Badge
                    variant="outline"
                    className="font-mono text-[10px] px-1 py-0"
                    style={{
                      borderColor: currentPortInfoRight.deviceColor,
                      color: currentPortInfoRight.deviceColor,
                    }}
                  >
                    {currentPortInfoRight.label}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground text-[10px]">-</span>
                )}
              </div>
              <ChevronDown className="h-3 w-3 opacity-50 flex-shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuItem onClick={() => handleSelectPort(null)}>
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
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent className="max-h-64 overflow-y-auto min-w-40">
                      {group.ports.map((port) => {
                        const usage = portUsageMap[port._id];
                        const isUsedByOther =
                          usage && usage.channelId !== currentChannelId;
                        const isCurrentPort = port._id === valueRight;

                        return (
                          <DropdownMenuItem
                            key={port._id}
                            onClick={() => handleSelectPort(port._id)}
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
                  </DropdownMenuPortal>
                </DropdownMenuSub>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </TableCell>
  );
});
