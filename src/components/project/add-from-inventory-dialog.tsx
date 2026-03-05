"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, ArrowLeft, Headphones, Plus, Box } from "lucide-react";
import type { InventoryIODevice, InventoryMixer } from "@/types/convex";
import Link from "next/link";

interface AddFromInventoryDialogProps {
  projectId: Id<"projects">;
  type: "io-device" | "mixer";
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddFromInventoryDialog({ projectId, type, open, onOpenChange }: AddFromInventoryDialogProps) {
  if (type === "io-device") {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add IO Device from Inventory</DialogTitle>
            <DialogDescription>Select an IO device to copy into this project.</DialogDescription>
          </DialogHeader>
          <IODeviceInventoryList projectId={projectId} onDone={() => onOpenChange(false)} />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Mixer from Inventory</DialogTitle>
          <DialogDescription>Select a mixer to copy into this project.</DialogDescription>
        </DialogHeader>
        <MixerInventoryList projectId={projectId} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function IODeviceInventoryList({ projectId, onDone }: { projectId: Id<"projects">; onDone: () => void }) {
  const devices = useQuery(api.inventoryIODevices.list) as InventoryIODevice[] | undefined;
  const copyToProject = useMutation(api.inventoryIODevices.copyToProject);

  const handleAdd = async (deviceId: string) => {
    await copyToProject({ id: deviceId as Id<"inventoryIODevices">, projectId });
    onDone();
  };

  if (devices === undefined) return <div className="py-4 text-center text-muted-foreground">Loading...</div>;

  if (devices.length === 0) {
    return (
      <div className="py-8 text-center">
        <Box className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
        <p className="text-sm text-muted-foreground mb-3">No IO devices in your inventory.</p>
        <Button variant="outline" size="sm" asChild>
          <Link href="/inventory">Go to Inventory</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-80 overflow-y-auto">
      {devices.map((device) => (
        <Card key={device._id} className="cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => handleAdd(device._id)}>
          <CardContent className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: device.color }} />
              <div className="min-w-0">
                <div className="font-medium text-sm truncate">{device.name}</div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="text-[10px] px-1">{device.shortName}</Badge>
                  <span className="flex items-center gap-0.5"><ArrowRight className="h-3 w-3" />{device.inputCount}</span>
                  <span className="flex items-center gap-0.5"><ArrowLeft className="h-3 w-3" />{device.outputCount}</span>
                  {(device.headphoneOutputCount ?? 0) > 0 && (
                    <span className="flex items-center gap-0.5"><Headphones className="h-3 w-3" />{device.headphoneOutputCount}</span>
                  )}
                </div>
              </div>
            </div>
            <Button size="sm" variant="ghost">
              <Plus className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function MixerInventoryList({ projectId, onDone }: { projectId: Id<"projects">; onDone: () => void }) {
  const mixers = useQuery(api.inventoryMixers.list) as InventoryMixer[] | undefined;
  const copyToProject = useMutation(api.inventoryMixers.copyToProject);

  const handleAdd = async (mixerId: string) => {
    await copyToProject({ id: mixerId as Id<"inventoryMixers">, projectId });
    onDone();
  };

  if (mixers === undefined) return <div className="py-4 text-center text-muted-foreground">Loading...</div>;

  if (mixers.length === 0) {
    return (
      <div className="py-8 text-center">
        <Box className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
        <p className="text-sm text-muted-foreground mb-3">No mixers in your inventory.</p>
        <Button variant="outline" size="sm" asChild>
          <Link href="/inventory">Go to Inventory</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-80 overflow-y-auto">
      {mixers.map((mixer) => (
        <Card key={mixer._id} className="cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => handleAdd(mixer._id)}>
          <CardContent className="p-3 flex items-center justify-between">
            <div className="min-w-0">
              <div className="font-medium text-sm truncate">{mixer.name}</div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {mixer.type && <Badge variant="outline" className="text-[10px] px-1">{mixer.type}</Badge>}
                <span>{mixer.channelCount} in / {mixer.outputChannelCount ?? 24} out</span>
                <span>&middot;</span>
                <span>{mixer.stereoMode === "true_stereo" ? "True Stereo" : "Linked Mono"}</span>
              </div>
            </div>
            <Button size="sm" variant="ghost">
              <Plus className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
