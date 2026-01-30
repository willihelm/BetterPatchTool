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
  onSelectPair: (leftPortId: string | null, rightPortId: string | null) => void;
  onCellClick: () => void;
  onOpenChange?: (open: boolean) => void;
}

export const StereoPortSelectCell = memo(function StereoPortSelectCell({
  valueLeft,
  valueRight,
  portType,
  currentChannelId,
  isActive,
  onSelectPair,
  onCellClick,
  onOpenChange,
}: StereoPortSelectCellProps) {
  const [isOpen, setIsOpen] = useState(false);
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

  // Open dropdown when cell becomes active and user presses Enter/F2
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

  const handleSelectPair = (leftPortId: string | null, rightPortId: string | null) => {
    onSelectPair(leftPortId, rightPortId);
    setIsOpen(false);
    // Blur the trigger after Radix finishes restoring focus, so arrow navigation works
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        triggerRef.current?.blur();
      });
    });
  };

  // Generate port pairs for each group (consecutive ports: 1+2, 2+3, 3+4, etc.)
  const getPortPairs = (ports: typeof portGroups[0]["ports"]) => {
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
            <div className="flex flex-col gap-1">
              {currentPortInfoLeft ? (
                <Badge
                  variant="outline"
                  className="font-mono"
                  style={{
                    borderColor: currentPortInfoLeft.deviceColor,
                    color: currentPortInfoLeft.deviceColor,
                  }}
                >
                  {currentPortInfoLeft.label}
                </Badge>
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
              {currentPortInfoRight ? (
                <Badge
                  variant="outline"
                  className="font-mono"
                  style={{
                    borderColor: currentPortInfoRight.deviceColor,
                    color: currentPortInfoRight.deviceColor,
                  }}
                >
                  {currentPortInfoRight.label}
                </Badge>
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </div>
            <ChevronDown className="h-4 w-4 opacity-50 flex-shrink-0" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuItem onClick={() => handleSelectPair(null, null)}>
            <span className="text-muted-foreground">None</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {portGroups
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
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent className="max-h-64 overflow-y-auto min-w-44">
                      {pairs.map((pair) => {
                        const leftUsage = portUsageMap[pair.left._id];
                        const rightUsage = portUsageMap[pair.right._id];
                        const isLeftUsedByOther = leftUsage && leftUsage.channelId !== currentChannelId;
                        const isRightUsedByOther = rightUsage && rightUsage.channelId !== currentChannelId;
                        const isUsedByOther = isLeftUsedByOther || isRightUsedByOther;
                        const isCurrentPair = pair.left._id === valueLeft && pair.right._id === valueRight;

                        return (
                          <DropdownMenuItem
                            key={`${pair.left._id}-${pair.right._id}`}
                            onClick={() => handleSelectPair(pair.left._id, pair.right._id)}
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
                  </DropdownMenuPortal>
                </DropdownMenuSub>
              );
            })}
        </DropdownMenuContent>
      </DropdownMenu>
    </TableCell>
  );
});
