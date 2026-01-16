"use client";

import { useState, useRef, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableCell } from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface PortGroup {
  device: {
    _id: string;
    name: string;
    shortName: string;
    color: string;
  };
  ports: Array<{
    _id: string;
    label: string;
    portNumber: number;
    isUsed: boolean;
  }>;
}

interface PortUsage {
  channelType: "input" | "output";
  channelId: string;
  channelName: string;
  channelNumber: number;
}

interface PortSelectCellProps {
  value: string | undefined;
  portGroups: PortGroup[];
  portUsageMap: Record<string, PortUsage>;
  currentChannelId: string;
  isActive: boolean;
  onSelect: (portId: string | null) => void;
  onCellClick: () => void;
  onOpenChange?: (open: boolean) => void;
}

export function PortSelectCell({
  value,
  portGroups,
  portUsageMap,
  currentChannelId,
  isActive,
  onSelect,
  onCellClick,
  onOpenChange,
}: PortSelectCellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Find current port info for display
  const currentPort = value
    ? portGroups
        .flatMap((g) => g.ports.map((p) => ({ ...p, device: g.device })))
        .find((p) => p._id === value)
    : null;

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

  // Focus trigger when active
  useEffect(() => {
    if (isActive && !isOpen && triggerRef.current) {
      triggerRef.current.focus();
    }
  }, [isActive, isOpen]);

  const handleValueChange = (newValue: string) => {
    if (newValue === "__none__") {
      onSelect(null);
    } else {
      onSelect(newValue);
    }
    setIsOpen(false);
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
      <Select
        value={value ?? "__none__"}
        onValueChange={handleValueChange}
        open={isOpen}
        onOpenChange={handleOpenChange}
      >
        <SelectTrigger
          ref={triggerRef}
          className={cn(
            "h-full w-full border-0 shadow-none rounded-none focus:ring-0 px-2",
            "bg-transparent"
          )}
        >
          <SelectValue>
            {currentPort ? (
              <Badge
                variant="outline"
                className="font-mono"
                style={{
                  borderColor: currentPort.device.color,
                  color: currentPort.device.color,
                }}
              >
                {currentPort.label}
              </Badge>
            ) : (
              <span className="text-muted-foreground">-</span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">
            <span className="text-muted-foreground">None</span>
          </SelectItem>
          <SelectSeparator />
          {portGroups.map((group) => (
            <SelectGroup key={group.device._id}>
              <SelectLabel className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: group.device.color }}
                />
                {group.device.name}
              </SelectLabel>
              {group.ports.map((port) => {
                const usage = portUsageMap[port._id];
                const isUsedByOther =
                  usage && usage.channelId !== currentChannelId;

                return (
                  <SelectItem
                    key={port._id}
                    value={port._id}
                    className={cn(isUsedByOther && "opacity-60")}
                  >
                    <div className="flex items-center justify-between w-full gap-4">
                      <span className="font-mono">{port.label}</span>
                      {isUsedByOther && (
                        <span className="text-xs text-muted-foreground">
                          {usage.channelName}
                        </span>
                      )}
                    </div>
                  </SelectItem>
                );
              })}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    </TableCell>
  );
}
