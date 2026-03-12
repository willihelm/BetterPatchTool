"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Plus, Trash2, Pencil, Box, ArrowRight, ArrowLeft, Headphones, Grid3X3, List } from "lucide-react";
import { AppHeader } from "@/components/shared/app-header";
import { PresetPicker } from "@/components/shared/preset-picker";
import {
  MIXER_PRESETS,
  IO_DEVICE_PRESETS,
  MIXER_MANUFACTURERS,
  IO_DEVICE_MANUFACTURERS,
  type MixerPreset,
  type IODevicePreset,
} from "@/lib/equipment-presets";
import { busConfigTotal, formatBusConfig, type BusConfig } from "@/lib/bus-utils";
import { BusConfigFields } from "@/components/shared/bus-config-fields";
import type { InventoryIODevice, InventoryMixer } from "@/types/convex";

const PRESET_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
];

export function InventoryContent() {
  const ioDevices = useQuery(api.inventoryIODevices.list) as InventoryIODevice[] | undefined;
  const mixers = useQuery(api.inventoryMixers.list) as InventoryMixer[] | undefined;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="container mx-auto px-4 py-8">
        <h2 className="text-xl font-semibold mb-4">Equipment Inventory</h2>
        <Tabs defaultValue="io-devices">
          <TabsList>
            <TabsTrigger value="io-devices">
              IO Devices ({ioDevices?.length ?? 0})
            </TabsTrigger>
            <TabsTrigger value="mixers">
              Mixers ({mixers?.length ?? 0})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="io-devices" className="mt-4">
            <IODevicesTab devices={ioDevices} />
          </TabsContent>
          <TabsContent value="mixers" className="mt-4">
            <MixersTab mixers={mixers} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

// === IO Devices Tab ===

function IODevicesTab({ devices }: { devices: InventoryIODevice[] | undefined }) {
  const createDevice = useMutation(api.inventoryIODevices.create);
  const removeDevice = useMutation(api.inventoryIODevices.remove);
  const updateDevice = useMutation(api.inventoryIODevices.update);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createTab, setCreateTab] = useState("preset");
  const [editTarget, setEditTarget] = useState<InventoryIODevice | null>(null);
  const [form, setForm] = useState(getDefaultIOForm());

  function getDefaultIOForm() {
    return {
      name: "",
      shortName: "",
      color: PRESET_COLORS[0],
      inputCount: 32,
      outputCount: 16,
      headphoneOutputCount: 0,
      aesInputCount: 0,
      aesOutputCount: 0,
      deviceType: "stagebox" as "stagebox" | "generic",
      portsPerRow: 12,
    };
  }

  const handleCreate = async () => {
    if (!form.name || !form.shortName) return;
    await createDevice({
      ...form,
      portsPerRow: form.deviceType === "stagebox" ? form.portsPerRow : undefined,
    });
    setForm(getDefaultIOForm());
    setIsCreateOpen(false);
  };

  const handleEdit = async () => {
    if (!editTarget || !form.name || !form.shortName) return;
    await updateDevice({
      id: editTarget._id as Id<"inventoryIODevices">,
      ...form,
      portsPerRow: form.deviceType === "stagebox" ? form.portsPerRow : undefined,
    });
    setEditTarget(null);
  };

  const openEdit = (device: InventoryIODevice) => {
    setForm({
      name: device.name,
      shortName: device.shortName,
      color: device.color,
      inputCount: device.inputCount,
      outputCount: device.outputCount,
      headphoneOutputCount: device.headphoneOutputCount ?? 0,
      aesInputCount: device.aesInputCount ?? 0,
      aesOutputCount: device.aesOutputCount ?? 0,
      deviceType: device.deviceType ?? "stagebox",
      portsPerRow: device.portsPerRow ?? 12,
    });
    setEditTarget(device);
  };

  if (devices === undefined) {
    return <div className="animate-pulse text-muted-foreground py-8 text-center">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={isCreateOpen} onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (open) { setForm(getDefaultIOForm()); setCreateTab("preset"); }
        }}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add IO Device
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Inventory IO Device</DialogTitle>
              <DialogDescription>Save an IO device configuration to your inventory.</DialogDescription>
            </DialogHeader>
            <Tabs value={createTab} onValueChange={setCreateTab}>
              <TabsList className="w-full">
                <TabsTrigger value="preset" className="flex-1">From Preset</TabsTrigger>
                <TabsTrigger value="manual" className="flex-1">Manual</TabsTrigger>
              </TabsList>
              <TabsContent value="preset">
                <PresetPicker
                  presets={IO_DEVICE_PRESETS}
                  manufacturers={IO_DEVICE_MANUFACTURERS}
                  searchPlaceholder="Search IO devices..."
                  onSelect={(preset: IODevicePreset) => {
                    setForm({
                      ...form,
                      name: preset.model,
                      shortName: preset.shortName,
                      inputCount: preset.inputCount,
                      outputCount: preset.outputCount,
                      headphoneOutputCount: preset.headphoneOutputCount ?? 0,
                      aesInputCount: preset.aesInputCount ?? 0,
                      aesOutputCount: preset.aesOutputCount ?? 0,
                      deviceType: preset.deviceType,
                      portsPerRow: preset.portsPerRow ?? 12,
                    });
                    setCreateTab("manual");
                  }}
                  renderItem={(preset: IODevicePreset) => (
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{preset.model}</span>
                      <span className="text-xs text-muted-foreground">{preset.inputCount}in / {preset.outputCount}out</span>
                    </div>
                  )}
                />
              </TabsContent>
              <TabsContent value="manual">
                <IODeviceForm form={form} setForm={setForm} />
                <Button onClick={handleCreate} className="w-full" disabled={!form.name || !form.shortName}>
                  Save to Inventory
                </Button>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit IO Device</DialogTitle>
            <DialogDescription>Update this inventory IO device.</DialogDescription>
          </DialogHeader>
          <IODeviceForm form={form} setForm={setForm} />
          <Button onClick={handleEdit} className="w-full" disabled={!form.name || !form.shortName}>
            Save Changes
          </Button>
        </DialogContent>
      </Dialog>

      {devices.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Box className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground mb-4">No IO devices in your inventory yet.</p>
            <Button variant="outline" onClick={() => setIsCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add First IO Device
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {devices.map((device) => (
            <Card key={device._id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: device.color }} />
                    <CardTitle className="text-base">{device.name}</CardTitle>
                  </div>
                  <Badge variant="outline">{device.shortName}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground mb-4">
                  <div className="flex items-center gap-1">
                    <ArrowRight className="h-4 w-4" />
                    <span>{device.inputCount} In</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <ArrowLeft className="h-4 w-4" />
                    <span>{device.outputCount} Out</span>
                  </div>
                  {(device.headphoneOutputCount ?? 0) > 0 && (
                    <div className="flex items-center gap-1">
                      <Headphones className="h-4 w-4" />
                      <span>{device.headphoneOutputCount} HP</span>
                    </div>
                  )}
                  {((device.aesInputCount ?? 0) > 0 || (device.aesOutputCount ?? 0) > 0) && (
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-xs">AES</span>
                      <span>
                        {(device.aesInputCount ?? 0) > 0 && `${device.aesInputCount}In`}
                        {(device.aesInputCount ?? 0) > 0 && (device.aesOutputCount ?? 0) > 0 && "/"}
                        {(device.aesOutputCount ?? 0) > 0 && `${device.aesOutputCount}Out`}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" onClick={() => openEdit(device)} title="Edit">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => removeDevice({ id: device._id as Id<"inventoryIODevices"> })}
                    title="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// === IO Device Form (shared between create and edit) ===

interface IOFormState {
  name: string;
  shortName: string;
  color: string;
  inputCount: number;
  outputCount: number;
  headphoneOutputCount: number;
  aesInputCount: number;
  aesOutputCount: number;
  deviceType: "stagebox" | "generic";
  portsPerRow: number;
}

function IODeviceForm({ form, setForm }: { form: IOFormState; setForm: (f: IOFormState) => void }) {
  return (
    <div className="space-y-4 py-4">
      <div className="space-y-2">
        <Label htmlFor="inv-io-name">Name</Label>
        <Input id="inv-io-name" placeholder="e.g. Yamaha Rio3224-D" value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="inv-io-short">Short Name (port prefix)</Label>
        <Input id="inv-io-short" placeholder="e.g. RIO1" value={form.shortName}
          onChange={(e) => setForm({ ...form, shortName: e.target.value.toUpperCase() })} maxLength={4} />
        <p className="text-xs text-muted-foreground">
          Ports: {form.shortName || "XX"}-I1, {form.shortName || "XX"}-O1, etc.
        </p>
      </div>
      <div className="space-y-2">
        <Label>Device Type</Label>
        <Select value={form.deviceType} onValueChange={(v: "stagebox" | "generic") => setForm({ ...form, deviceType: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="stagebox">
              <div className="flex items-center gap-2"><Grid3X3 className="h-4 w-4" /><span>Stagebox</span></div>
            </SelectItem>
            <SelectItem value="generic">
              <div className="flex items-center gap-2"><List className="h-4 w-4" /><span>Generic</span></div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      {form.deviceType === "stagebox" && (
        <div className="space-y-2">
          <Label>Ports per Row</Label>
          <Select value={form.portsPerRow.toString()} onValueChange={(v) => setForm({ ...form, portsPerRow: parseInt(v) })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="8">8 ports</SelectItem>
              <SelectItem value="12">12 ports</SelectItem>
              <SelectItem value="16">16 ports</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="space-y-2">
        <Label>Color</Label>
        <div className="flex gap-2 flex-wrap">
          {PRESET_COLORS.map((color) => (
            <button key={color}
              className={`w-8 h-8 rounded-full border-2 transition-all ${form.color === color ? "border-foreground scale-110" : "border-transparent"}`}
              style={{ backgroundColor: color }}
              onClick={() => setForm({ ...form, color })}
            />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Inputs</Label>
          <Input type="number" min={1} max={96} value={form.inputCount}
            onChange={(e) => setForm({ ...form, inputCount: parseInt(e.target.value) || 1 })} />
        </div>
        <div className="space-y-2">
          <Label>Outputs</Label>
          <Input type="number" min={1} max={96} value={form.outputCount}
            onChange={(e) => setForm({ ...form, outputCount: parseInt(e.target.value) || 1 })} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Headphone Outputs (stereo pairs)</Label>
        <Input type="number" min={0} max={16} value={form.headphoneOutputCount}
          onChange={(e) => setForm({ ...form, headphoneOutputCount: parseInt(e.target.value) || 0 })} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>AES Inputs (pairs)</Label>
          <Input type="number" min={0} max={16} value={form.aesInputCount}
            onChange={(e) => setForm({ ...form, aesInputCount: parseInt(e.target.value) || 0 })} />
        </div>
        <div className="space-y-2">
          <Label>AES Outputs (pairs)</Label>
          <Input type="number" min={0} max={16} value={form.aesOutputCount}
            onChange={(e) => setForm({ ...form, aesOutputCount: parseInt(e.target.value) || 0 })} />
        </div>
      </div>
    </div>
  );
}

// === Mixers Tab ===

function MixersTab({ mixers }: { mixers: InventoryMixer[] | undefined }) {
  const createMixer = useMutation(api.inventoryMixers.create);
  const removeMixer = useMutation(api.inventoryMixers.remove);
  const updateMixer = useMutation(api.inventoryMixers.update);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createTab, setCreateTab] = useState("preset");
  const [editTarget, setEditTarget] = useState<InventoryMixer | null>(null);
  const [form, setForm] = useState(getDefaultMixerForm());

  function getDefaultMixerForm() {
    return {
      name: "",
      type: "",
      stereoMode: "linked_mono" as "linked_mono" | "true_stereo",
      channelCount: 48,
      busConfig: { auxes: 24 } as BusConfig,
    };
  }

  const handleCreate = async () => {
    if (!form.name) return;
    await createMixer({
      name: form.name,
      type: form.type || undefined,
      stereoMode: form.stereoMode,
      channelCount: form.channelCount,
      busConfig: form.busConfig,
    });
    setForm(getDefaultMixerForm());
    setIsCreateOpen(false);
  };

  const handleEdit = async () => {
    if (!editTarget || !form.name) return;
    await updateMixer({
      id: editTarget._id as Id<"inventoryMixers">,
      name: form.name,
      type: form.type || undefined,
      stereoMode: form.stereoMode,
      channelCount: form.channelCount,
      busConfig: form.busConfig,
    });
    setEditTarget(null);
  };

  const openEdit = (mixer: InventoryMixer) => {
    setForm({
      name: mixer.name,
      type: mixer.type ?? "",
      stereoMode: mixer.stereoMode,
      channelCount: mixer.channelCount,
      busConfig: mixer.busConfig ?? { auxes: 24 },
    });
    setEditTarget(mixer);
  };

  if (mixers === undefined) {
    return <div className="animate-pulse text-muted-foreground py-8 text-center">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={isCreateOpen} onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (open) { setForm(getDefaultMixerForm()); setCreateTab("preset"); }
        }}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Mixer
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Inventory Mixer</DialogTitle>
              <DialogDescription>Save a mixer configuration to your inventory.</DialogDescription>
            </DialogHeader>
            <Tabs value={createTab} onValueChange={setCreateTab}>
              <TabsList className="w-full">
                <TabsTrigger value="preset" className="flex-1">From Preset</TabsTrigger>
                <TabsTrigger value="manual" className="flex-1">Manual</TabsTrigger>
              </TabsList>
              <TabsContent value="preset">
                <PresetPicker
                  presets={MIXER_PRESETS}
                  manufacturers={MIXER_MANUFACTURERS}
                  searchPlaceholder="Search mixers..."
                  onSelect={async (preset: MixerPreset) => {
                    await createMixer({
                      name: preset.model,
                      type: `${preset.manufacturer} ${preset.model}`,
                      stereoMode: preset.stereoMode,
                      channelCount: preset.channelCount,
                      busConfig: preset.busConfig,
                    });
                    setIsCreateOpen(false);
                  }}
                  renderItem={(preset: MixerPreset) => (
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{preset.model}</span>
                      <span className="text-xs text-muted-foreground">{preset.channelCount}ch / {busConfigTotal(preset.busConfig)} bus</span>
                    </div>
                  )}
                />
              </TabsContent>
              <TabsContent value="manual">
                <MixerForm form={form} setForm={setForm} />
                <Button onClick={handleCreate} className="w-full" disabled={!form.name}>
                  Save to Inventory
                </Button>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Mixer</DialogTitle>
            <DialogDescription>Update this inventory mixer.</DialogDescription>
          </DialogHeader>
          <MixerForm form={form} setForm={setForm} />
          <Button onClick={handleEdit} className="w-full" disabled={!form.name}>
            Save Changes
          </Button>
        </DialogContent>
      </Dialog>

      {mixers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Box className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground mb-4">No mixers in your inventory yet.</p>
            <Button variant="outline" onClick={() => setIsCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add First Mixer
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {mixers.map((mixer) => (
            <Card key={mixer._id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{mixer.name}</CardTitle>
                  {mixer.type && <Badge variant="outline" className="text-xs">{mixer.type}</Badge>}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3 text-sm text-muted-foreground mb-4">
                  <span>{mixer.channelCount}ch / {mixer.busConfig ? formatBusConfig(mixer.busConfig) : "24 Aux"}</span>
                  <span>&middot;</span>
                  <span>{mixer.stereoMode === "true_stereo" ? "True Stereo" : "Linked Mono"}</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" onClick={() => openEdit(mixer)} title="Edit">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => removeMixer({ id: mixer._id as Id<"inventoryMixers"> })}
                    title="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// === Mixer Form (shared between create and edit) ===

interface MixerFormState {
  name: string;
  type: string;
  stereoMode: "linked_mono" | "true_stereo";
  channelCount: number;
  busConfig: BusConfig;
}

function MixerForm({ form, setForm }: { form: MixerFormState; setForm: (f: MixerFormState) => void }) {
  return (
    <div className="space-y-4 py-4">
      <div className="space-y-2">
        <Label htmlFor="inv-mixer-name">Name</Label>
        <Input id="inv-mixer-name" placeholder="e.g. FOH, Monitor, Broadcast"
          value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="inv-mixer-type">Console Type (optional)</Label>
        <Input id="inv-mixer-type" placeholder="e.g. Yamaha CL5, DiGiCo SD12"
          value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Stereo Mode</Label>
        <Select value={form.stereoMode} onValueChange={(v) => setForm({ ...form, stereoMode: v as "linked_mono" | "true_stereo" })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="linked_mono">Linked Mono</SelectItem>
            <SelectItem value="true_stereo">True Stereo</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Input Channels</Label>
        <Input type="number" min={1} max={256} value={form.channelCount}
          onChange={(e) => setForm({ ...form, channelCount: parseInt(e.target.value) || 48 })} />
      </div>
      <BusConfigFields value={form.busConfig} onChange={(busConfig) => setForm({ ...form, busConfig })} />
    </div>
  );
}
