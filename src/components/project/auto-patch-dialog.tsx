"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { usePortData } from "./port-data-context";

interface AutoPatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: Id<"projects">;
  channelType: "input" | "output";
  selectedChannelIds: string[];
  onComplete: () => void;
}

export function AutoPatchDialog({
  open,
  onOpenChange,
  channelType,
  selectedChannelIds,
  onComplete,
}: AutoPatchDialogProps) {
  const [startPortId, setStartPortId] = useState<string>("");
  const [skipAssigned, setSkipAssigned] = useState(true);
  const [isPatching, setIsPatching] = useState(false);

  // Get port groups from context instead of separate query
  const { inputPortGroups, outputPortGroups } = usePortData();
  const portGroups = channelType === "input" ? inputPortGroups : outputPortGroups;

  const autoPatchInputs = useMutation(api.patching.autoPatchInputChannels);
  const autoPatchOutputs = useMutation(api.patching.autoPatchOutputChannels);

  const handleAutoPatch = async () => {
    if (!startPortId || selectedChannelIds.length === 0) return;

    setIsPatching(true);
    try {
      if (channelType === "input") {
        await autoPatchInputs({
          channelIds: selectedChannelIds as Id<"inputChannels">[],
          startPortId: startPortId as Id<"ioPorts">,
          skipAssigned,
        });
      } else {
        await autoPatchOutputs({
          channelIds: selectedChannelIds as Id<"outputChannels">[],
          startPortId: startPortId as Id<"ioPorts">,
          skipAssigned,
        });
      }
      onComplete();
      onOpenChange(false);
    } finally {
      setIsPatching(false);
    }
  };

  // Find the selected port info for preview
  const selectedPort = startPortId
    ? portGroups
        ?.flatMap((g) => g.ports.map((p) => ({ ...p, device: g.device })))
        .find((p) => p._id === startPortId)
    : null;

  // Calculate preview of assignments
  const previewAssignments = selectedPort
    ? (() => {
        const device = portGroups?.find(
          (g) => g.device._id === selectedPort.device._id
        );
        if (!device) return [];

        const portsFromStart = device.ports
          .filter((p) => p.portNumber >= selectedPort.portNumber)
          .sort((a, b) => a.portNumber - b.portNumber);

        const preview = [];
        let portIndex = 0;

        for (
          let i = 0;
          i < Math.min(selectedChannelIds.length, 5);
          i++
        ) {
          while (portIndex < portsFromStart.length) {
            const port = portsFromStart[portIndex];
            if (!skipAssigned || !port.isUsed) {
              preview.push({
                channelIndex: i + 1,
                portLabel: port.label,
              });
              portIndex++;
              break;
            }
            portIndex++;
          }
        }

        if (selectedChannelIds.length > 5) {
          preview.push({ channelIndex: -1, portLabel: "..." });
        }

        return preview;
      })()
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Auto-Patch Channels</DialogTitle>
          <DialogDescription>
            Assign consecutive ports to {selectedChannelIds.length} selected{" "}
            {channelType} channel{selectedChannelIds.length !== 1 ? "s" : ""}.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="start-port">Starting Port</Label>
            <Select value={startPortId} onValueChange={setStartPortId}>
              <SelectTrigger id="start-port">
                <SelectValue placeholder="Select starting port" />
              </SelectTrigger>
              <SelectContent>
                {portGroups?.map((group) => (
                  <SelectGroup key={group.device._id}>
                    <SelectLabel className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: group.device.color }}
                      />
                      {group.device.name}
                    </SelectLabel>
                    {group.ports.map((port) => (
                      <SelectItem
                        key={port._id}
                        value={port._id}
                        disabled={port.isUsed && skipAssigned}
                      >
                        <span className="font-mono">{port.label}</span>
                        {port.isUsed && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            (in use)
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="skip-assigned"
              checked={skipAssigned}
              onChange={(e) => setSkipAssigned(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="skip-assigned" className="text-sm font-normal">
              Skip already assigned ports
            </Label>
          </div>

          {previewAssignments.length > 0 && (
            <div className="rounded-md bg-muted p-3">
              <p className="text-sm font-medium mb-2">Preview:</p>
              <div className="space-y-1 text-sm text-muted-foreground font-mono">
                {previewAssignments.map((item, idx) =>
                  item.channelIndex === -1 ? (
                    <div key={idx}>{item.portLabel}</div>
                  ) : (
                    <div key={idx}>
                      Ch {item.channelIndex} → {item.portLabel}
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAutoPatch}
            disabled={!startPortId || isPatching}
          >
            {isPatching ? "Patching..." : "Apply"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
