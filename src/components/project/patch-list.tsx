"use client";

import { useState } from "react";
import { Id } from "../../../convex/_generated/dataModel";
import { InputChannelTable } from "./input-channel-table";
import { OutputChannelTable } from "./output-channel-table";

interface PatchListProps {
  projectId: Id<"projects">;
}

export function PatchList({ projectId }: PatchListProps) {
  const [channelType, setChannelType] = useState<"input" | "output">("input");

  return (
    <div>
      {channelType === "input" ? (
        <InputChannelTable projectId={projectId} channelType={channelType} onChannelTypeChange={setChannelType} />
      ) : (
        <OutputChannelTable projectId={projectId} channelType={channelType} onChannelTypeChange={setChannelType} />
      )}
    </div>
  );
}
