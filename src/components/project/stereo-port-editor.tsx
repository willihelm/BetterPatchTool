"use client";

import { useState, useRef, useEffect } from "react";
import type { RenderEditCellProps } from "react-data-grid";
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
import { cn } from "@/lib/utils";
import { usePortData, isPortUsedByOther, getPortUsageDisplayName } from "./port-data-context";
import { ChevronDown } from "lucide-react";

interface StereoPortEditorRow {
  _id: string;
  ioPortId?: string;
  ioPortIdRight?: string;
}

interface StereoPortEditorProps<TRow extends StereoPortEditorRow> extends RenderEditCellProps<TRow> {
  portType: "input" | "output";
}

export function StereoPortEditor<TRow extends StereoPortEditorRow>({
  row,
  onRowChange,
  onClose,
  portType,
}: StereoPortEditorProps<TRow>) {
  const [isOpen, setIsOpen] = useState(true);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const { portInfoMap, portUsageMap, inputPortGroups, outputPortGroups } = usePortData();
  const portGroups = portType === "input" ? inputPortGroups : outputPortGroups;

  const currentPortInfoLeft = row.ioPortId ? portInfoMap[row.ioPortId] : null;
  const currentPortInfoRight = row.ioPortIdRight ? portInfoMap[row.ioPortIdRight] : null;

  // Auto-focus trigger when editor opens
  useEffect(() => {
    triggerRef.current?.focus();
  }, []);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      onClose(false, true);
    }
  };

  const handleSelectPair = (leftPortId: string | null, rightPortId: string | null) => {
    onRowChange({
      ...row,
      ioPortId: leftPortId ?? undefined,
      ioPortIdRight: rightPortId ?? undefined,
    } as TRow, true);
    setIsOpen(false);
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
    <div className="h-full w-full flex items-center">
      <DropdownMenu open={isOpen} onOpenChange={handleOpenChange} modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            ref={triggerRef}
            type="button"
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
                        const isLeftUsedByOther = isPortUsedByOther(leftUsage, row._id);
                        const isRightUsedByOther = isPortUsedByOther(rightUsage, row._id);
                        const isUsedByOther = isLeftUsedByOther || isRightUsedByOther;
                        const isCurrentPair = pair.left._id === row.ioPortId && pair.right._id === row.ioPortIdRight;

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
                                {isLeftUsedByOther && getPortUsageDisplayName(leftUsage)}
                                {isLeftUsedByOther && isRightUsedByOther && " / "}
                                {isRightUsedByOther && getPortUsageDisplayName(rightUsage)}
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
    </div>
  );
}
