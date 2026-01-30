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

interface PortSelectCellProps {
  value: string | undefined;
  portType: "input" | "output";
  currentChannelId: string;
  isActive: boolean;
  onSelect: (portId: string | null) => void;
  onCellClick: () => void;
  onOpenChange?: (open: boolean) => void;
}

export const PortSelectCell = memo(function PortSelectCell({
  value,
  portType,
  currentChannelId,
  isActive,
  onSelect,
  onCellClick,
  onOpenChange,
}: PortSelectCellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Get data from context - only loaded once for the entire project
  const { portInfoMap, portUsageMap, inputPortGroups, outputPortGroups } = usePortData();

  // Get the port groups based on type
  const portGroups = portType === "input" ? inputPortGroups : outputPortGroups;

  // Get current port info for display (lightweight lookup)
  const currentPortInfo = value ? portInfoMap[value] : null;

  // Handle open state changes
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    onOpenChange?.(open);
  };

  // Open dropdown when cell becomes active and user presses Enter
  useEffect(() => {
    if (isActive && !isOpen) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Enter" || e.key === "F2") {
          e.preventDefault();
          setIsOpen(true);
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isActive, isOpen]);

  const handleSelectPort = (portId: string | null) => {
    onSelect(portId);
    setIsOpen(false);
    // Blur the trigger after Radix finishes restoring focus, so arrow navigation works
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        triggerRef.current?.blur();
      });
    });
  };

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
      <DropdownMenu open={isOpen} onOpenChange={handleOpenChange} modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            ref={triggerRef}
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
            }}
            onKeyDown={(e) => {
              // Block arrow keys to prevent Radix from opening dropdown on ArrowDown
              if (e.key.startsWith("Arrow")) {
                e.preventDefault();
              }
            }}
            className={cn(
              "flex items-center justify-between h-full w-full px-2 py-1.5",
              "bg-transparent outline-none focus:outline-none focus-visible:outline-none"
            )}
          >
            {currentPortInfo ? (
              <Badge
                variant="outline"
                className="font-mono"
                style={{
                  borderColor: currentPortInfo.deviceColor,
                  color: currentPortInfo.deviceColor,
                }}
              >
                {currentPortInfo.label}
              </Badge>
            ) : (
              <span className="text-muted-foreground">-</span>
            )}
            <ChevronDown className="h-4 w-4 opacity-50" />
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
                      const isCurrentPort = port._id === value;

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
    </TableCell>
  );
});
