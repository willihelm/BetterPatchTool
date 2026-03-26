"use client";

import { Id } from "../../../convex/_generated/dataModel";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ChevronDown, Settings } from "lucide-react";
import { useActiveMixer } from "./active-mixer-context";
import { cn } from "@/lib/utils";

interface MixerSelectorProps {
  onOpenSettings?: (mixerId: Id<"mixers">) => void;
}

export function MixerSelector({ onOpenSettings }: MixerSelectorProps) {
  const { activeMixer, activeMixerId, mixers, setActiveMixerId } = useActiveMixer();

  if (!activeMixer || mixers.length <= 1) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="hidden max-w-44 lg:flex gap-1.5 h-7 px-2.5">
          <span className="truncate font-medium">{activeMixer.name}</span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {mixers.map((mixer) => (
          <DropdownMenuItem
            key={mixer._id}
            onClick={() => setActiveMixerId(mixer._id as Id<"mixers">)}
            className={cn(
              "flex items-center justify-between",
              mixer._id === activeMixerId && "bg-accent"
            )}
          >
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-xs w-4">{mixer.designation}</span>
              <span>{mixer.name}</span>
              <span className="text-xs text-muted-foreground">({mixer.channelCount}ch)</span>
            </div>
            {onOpenSettings && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenSettings(mixer._id as Id<"mixers">);
                }}
              >
                <Settings className="h-3 w-3" />
              </Button>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
