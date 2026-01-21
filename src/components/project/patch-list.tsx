"use client";

import { useState } from "react";
import { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { InputChannelTable } from "./input-channel-table";
import { OutputChannelTable } from "./output-channel-table";

interface PatchListProps {
  projectId: Id<"projects">;
}

export function PatchList({ projectId }: PatchListProps) {
  const [channelType, setChannelType] = useState<"input" | "output">("input");

  return (
    <div className="space-y-4">
      {/* Sub-tabs for input/output switching */}
      <div className="flex items-center gap-2">
        <Button
          variant={channelType === "input" ? "default" : "outline"}
          size="sm"
          onClick={() => setChannelType("input")}
        >
          Input Channels
        </Button>
        <Button
          variant={channelType === "output" ? "default" : "outline"}
          size="sm"
          onClick={() => setChannelType("output")}
        >
          Output Channels
        </Button>
      </div>

      {/* Content */}
      {channelType === "input" ? (
        <InputChannelTable projectId={projectId} />
      ) : (
        <OutputChannelTable projectId={projectId} />
      )}
    </div>
  );
}
