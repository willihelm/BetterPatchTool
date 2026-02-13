"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Settings } from "lucide-react";
import type { Mixer } from "@/types/convex";

interface MixerSettingsDialogProps {
  projectId: Id<"projects">;
  mixer: Mixer;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function MixerSettingsDialog({
  projectId,
  mixer,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: MixerSettingsDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;
  const [name, setName] = useState(mixer.name);
  const [type, setType] = useState(mixer.type || "");
  const [stereoMode, setStereoMode] = useState(mixer.stereoMode);
  const [inputChannelCount, setInputChannelCount] = useState(mixer.channelCount.toString());
  const [outputChannelCount, setOutputChannelCount] = useState("0");
  const [isLoading, setIsLoading] = useState(false);

  const inputChannels = useQuery(api.inputChannels.list, { projectId });
  const outputChannels = useQuery(api.outputChannels.list, { projectId });

  const currentInputChannelCount = inputChannels?.length ?? 0;
  const currentOutputChannelCount = outputChannels?.length ?? 0;

  const updateMixer = useMutation(api.mixers.update);
  const generateInputChannels = useMutation(api.inputChannels.generateChannelsUpTo);
  const generateOutputChannels = useMutation(api.outputChannels.generateChannelsUpTo);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setName(mixer.name);
      setType(mixer.type || "");
      setStereoMode(mixer.stereoMode);
      setInputChannelCount(mixer.channelCount.toString());
      setOutputChannelCount(currentOutputChannelCount.toString());
    }
  }, [open, mixer, currentOutputChannelCount]);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const newInputCount = parseInt(inputChannelCount) || 48;
      const newOutputCount = parseInt(outputChannelCount) || 24;

      // Update mixer settings
      await updateMixer({
        mixerId: mixer._id as Id<"mixers">,
        name,
        type: type || undefined,
        stereoMode,
        channelCount: newInputCount,
      });

      // Generate input channels up to the new count
      if (newInputCount > currentInputChannelCount) {
        await generateInputChannels({
          projectId,
          targetCount: newInputCount,
        });
      }

      // Generate output channels up to the new count
      if (newOutputCount > currentOutputChannelCount) {
        await generateOutputChannels({
          projectId,
          targetCount: newOutputCount,
        });
      }

      setOpen(false);
    } catch (error) {
      console.error("Error updating mixer:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const inputsToAdd = Math.max(0, (parseInt(inputChannelCount) || 0) - currentInputChannelCount);
  const outputsToAdd = Math.max(0, (parseInt(outputChannelCount) || 0) - currentOutputChannelCount);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {controlledOpen === undefined && (
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon">
            <Settings className="h-4 w-4" />
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Mixer Settings</DialogTitle>
          <DialogDescription>
            Configure mixer settings and channel counts for this project.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="mixer-name">Mixer Name</Label>
            <Input
              id="mixer-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="FOH"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="mixer-type">Console Type</Label>
            <Input
              id="mixer-type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              placeholder="e.g. Yamaha CL5, DiGiCo SD12"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="stereo-mode">Stereo Mode</Label>
            <Select value={stereoMode} onValueChange={(v) => setStereoMode(v as typeof stereoMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="linked_mono">Linked Mono</SelectItem>
                <SelectItem value="true_stereo">True Stereo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="input-channel-count">Input Channels</Label>
              <Input
                id="input-channel-count"
                type="number"
                min="1"
                max="256"
                value={inputChannelCount}
                onChange={(e) => setInputChannelCount(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Current: {currentInputChannelCount}
                {inputsToAdd > 0 && (
                  <span className="text-primary"> (+{inputsToAdd})</span>
                )}
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="output-channel-count">Output Channels</Label>
              <Input
                id="output-channel-count"
                type="number"
                min="1"
                max="256"
                value={outputChannelCount}
                onChange={(e) => setOutputChannelCount(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Current: {currentOutputChannelCount}
                {outputsToAdd > 0 && (
                  <span className="text-primary"> (+{outputsToAdd})</span>
                )}
              </p>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
