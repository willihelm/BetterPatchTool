"use client";

import { useState } from "react";
import { Id } from "../../../convex/_generated/dataModel";
import { InputChannelTable } from "./input-channel-table";
import { OutputChannelTable } from "./output-channel-table";
import { useActiveMixer } from "./active-mixer-context";

interface PatchListProps {
  projectId: Id<"projects">;
}

export function PatchList({ projectId }: PatchListProps) {
  const [channelType, setChannelType] = useState<"input" | "output">("input");
  const { activeMixerId } = useActiveMixer();

  return (
    <div>
      {channelType === "input" ? (
        <InputChannelTable projectId={projectId} mixerId={activeMixerId} channelType={channelType} onChannelTypeChange={setChannelType} />
      ) : (
        <OutputChannelTable projectId={projectId} mixerId={activeMixerId} channelType={channelType} onChannelTypeChange={setChannelType} />
      )}
    </div>
  );
}
