"use client";

import { Id } from "../../../convex/_generated/dataModel";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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

  if (!activeMixer || mixers.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="hidden lg:flex gap-1.5 h-7 px-2.5">
          <span className="font-semibold">{activeMixer.designation}</span>
          <span className="text-muted-foreground">·</span>
          <span>{activeMixer.name}</span>
          <span className="text-muted-foreground text-xs">({activeMixer.channelCount}ch)</span>
          {mixers.length > 1 && <ChevronDown className="h-3 w-3 opacity-50 ml-0.5" />}
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
        {mixers.length === 1 && onOpenSettings && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onOpenSettings(activeMixer._id as Id<"mixers">)}>
              <Settings className="mr-2 h-4 w-4" />
              Mixer Settings
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
