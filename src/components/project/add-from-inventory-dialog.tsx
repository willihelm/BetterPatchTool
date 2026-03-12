"use client";

import { useState } from "react";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, ArrowLeft, Headphones, Plus, Box } from "lucide-react";
import { PresetPicker } from "@/components/shared/preset-picker";
import {
  MIXER_PRESETS,
  IO_DEVICE_PRESETS,
  MIXER_MANUFACTURERS,
  IO_DEVICE_MANUFACTURERS,
  type MixerPreset,
  type IODevicePreset,
} from "@/lib/equipment-presets";
import { busConfigTotal, formatBusConfig } from "@/lib/bus-utils";
import type { InventoryIODevice, InventoryMixer, Mixer } from "@/types/convex";
import Link from "next/link";

const PRESET_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
];

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
            <DialogTitle>Add IO Device</DialogTitle>
            <DialogDescription>Select from presets or your inventory.</DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="presets">
            <TabsList className="w-full">
              <TabsTrigger value="presets" className="flex-1">Presets</TabsTrigger>
              <TabsTrigger value="inventory" className="flex-1">My Inventory</TabsTrigger>
            </TabsList>
            <TabsContent value="presets">
              <IODevicePresetList projectId={projectId} onDone={() => onOpenChange(false)} />
            </TabsContent>
            <TabsContent value="inventory">
              <IODeviceInventoryList projectId={projectId} onDone={() => onOpenChange(false)} />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Mixer</DialogTitle>
          <DialogDescription>Select from presets or your inventory.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="presets">
          <TabsList className="w-full">
            <TabsTrigger value="presets" className="flex-1">Presets</TabsTrigger>
            <TabsTrigger value="inventory" className="flex-1">My Inventory</TabsTrigger>
          </TabsList>
          <TabsContent value="presets">
            <MixerPresetList projectId={projectId} onDone={() => onOpenChange(false)} />
          </TabsContent>
          <TabsContent value="inventory">
            <MixerInventoryList projectId={projectId} onDone={() => onOpenChange(false)} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// Next designation letter based on existing mixers
function getNextDesignation(mixers: Mixer[]): string {
  const used = new Set(mixers.map(m => m.designation));
  for (let i = 0; i < 26; i++) {
    const letter = String.fromCharCode(65 + i);
    if (!used.has(letter)) return letter;
  }
  return String.fromCharCode(65 + mixers.length);
}

function MixerPresetList({ projectId, onDone }: { projectId: Id<"projects">; onDone: () => void }) {
  const mixers = useQuery(api.mixers.list, { projectId }) as Mixer[] | undefined;
  const createMixer = useMutation(api.mixers.create);

  return (
    <PresetPicker
      presets={MIXER_PRESETS}
      manufacturers={MIXER_MANUFACTURERS}
      searchPlaceholder="Search mixers..."
      onSelect={async (preset: MixerPreset) => {
        if (!mixers) return;
        await createMixer({
          projectId,
          name: preset.model,
          type: `${preset.manufacturer} ${preset.model}`,
          stereoMode: preset.stereoMode,
          channelCount: preset.channelCount,
          busConfig: preset.busConfig,
          designation: getNextDesignation(mixers),
        });
        onDone();
      }}
      renderItem={(preset: MixerPreset) => (
        <div className="flex items-center justify-between">
          <span className="font-medium text-sm">{preset.model}</span>
          <span className="text-xs text-muted-foreground">{preset.channelCount}ch / {busConfigTotal(preset.busConfig)} bus</span>
        </div>
      )}
    />
  );
}

function IODevicePresetList({ projectId, onDone }: { projectId: Id<"projects">; onDone: () => void }) {
  const createIODevice = useMutation(api.ioDevices.create);
  const [selectedPreset, setSelectedPreset] = useState<IODevicePreset | null>(null);
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);

  const handleCreate = async () => {
    if (!selectedPreset || !name || !shortName) return;
    await createIODevice({
      projectId,
      name,
      shortName,
      color,
      inputCount: selectedPreset.inputCount,
      outputCount: selectedPreset.outputCount,
      headphoneOutputCount: selectedPreset.headphoneOutputCount ?? 0,
      aesInputCount: selectedPreset.aesInputCount ?? 0,
      aesOutputCount: selectedPreset.aesOutputCount ?? 0,
      deviceType: selectedPreset.deviceType,
      portsPerRow: selectedPreset.portsPerRow,
    });
    onDone();
  };

  if (selectedPreset) {
    return (
      <div className="space-y-4 py-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-sm">{selectedPreset.manufacturer} {selectedPreset.model}</p>
            <p className="text-xs text-muted-foreground">{selectedPreset.inputCount}in / {selectedPreset.outputCount}out</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setSelectedPreset(null)}>Change</Button>
        </div>
        <div className="space-y-2">
          <Label>Name</Label>
          <Input placeholder="e.g. Stage Left" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Short Name (port prefix)</Label>
          <Input placeholder="e.g. SL" value={shortName} onChange={(e) => setShortName(e.target.value.toUpperCase())} maxLength={4} />
          <p className="text-xs text-muted-foreground">
            Ports: {shortName || "XX"}-I1, {shortName || "XX"}-O1, etc.
          </p>
        </div>
        <div className="space-y-2">
          <Label>Color</Label>
          <div className="flex gap-2 flex-wrap">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                className={`w-8 h-8 rounded-full border-2 transition-all ${color === c ? "border-foreground scale-110" : "border-transparent"}`}
                style={{ backgroundColor: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        </div>
        <Button onClick={handleCreate} className="w-full" disabled={!name || !shortName}>
          Add to Project
        </Button>
      </div>
    );
  }

  return (
    <PresetPicker
      presets={IO_DEVICE_PRESETS}
      manufacturers={IO_DEVICE_MANUFACTURERS}
      searchPlaceholder="Search IO devices..."
      onSelect={(preset: IODevicePreset) => {
        setSelectedPreset(preset);
        setName(preset.model);
        setShortName(preset.shortName);
      }}
      renderItem={(preset: IODevicePreset) => (
        <div className="flex items-center justify-between">
          <span className="font-medium text-sm">{preset.model}</span>
          <span className="text-xs text-muted-foreground">{preset.inputCount}in / {preset.outputCount}out</span>
        </div>
      )}
    />
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
                <span>{mixer.channelCount}ch / {mixer.busConfig ? formatBusConfig(mixer.busConfig) : "24 Aux"}</span>
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
