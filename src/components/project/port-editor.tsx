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

interface PortEditorRow {
  _id: string;
  ioPortId?: string;
}

interface PortEditorProps<TRow extends PortEditorRow> extends RenderEditCellProps<TRow> {
  portType: "input" | "output";
}

export function PortEditor<TRow extends PortEditorRow>({
  row,
  onRowChange,
  onClose,
  portType,
}: PortEditorProps<TRow>) {
  const [isOpen, setIsOpen] = useState(true);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const { portInfoMap, portUsageMap, inputPortGroups, outputPortGroups } = usePortData();
  const portGroups = portType === "input" ? inputPortGroups : outputPortGroups;
  const currentPortInfo = row.ioPortId ? portInfoMap[row.ioPortId] : null;

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

  const handleSelectPort = (portId: string | null) => {
    onRowChange({ ...row, ioPortId: portId ?? undefined } as TRow, true);
    setIsOpen(false);
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
                      const usedByOther = isPortUsedByOther(usage, row._id);
                      const isCurrentPort = port._id === row.ioPortId;
                      const usageDisplayName = getPortUsageDisplayName(usage);

                      return (
                        <DropdownMenuItem
                          key={port._id}
                          onClick={() => handleSelectPort(port._id)}
                          className={cn(
                            "flex items-center justify-between gap-4",
                            usedByOther && "opacity-60",
                            isCurrentPort && "bg-accent"
                          )}
                        >
                          <span className="font-mono">{port.label}</span>
                          {usedByOther && (
                            <span
                              className="text-xs text-muted-foreground truncate max-w-20"
                              title={usageDisplayName}
                            >
                              {usageDisplayName}
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
  );
}
