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
import { Plus, Trash2, Box, ArrowRight, ArrowLeft, Eye, Grid3X3, List, Headphones, GripVertical, Settings, Package, Save } from "lucide-react";
import Link from "next/link";
import type { IODevice, Mixer } from "@/types/convex";
import { IODeviceEditDialog } from "./io-device-edit-dialog";
import { MixerSettingsDialog } from "./mixer-settings-dialog";
import { AddFromInventoryDialog } from "./add-from-inventory-dialog";
import { PresetPicker } from "@/components/shared/preset-picker";
import {
  MIXER_PRESETS,
  IO_DEVICE_PRESETS,
  MIXER_MANUFACTURERS,
  IO_DEVICE_MANUFACTURERS,
  type MixerPreset,
  type IODevicePreset,
} from "@/lib/equipment-presets";
import { busConfigTotal, type BusConfig } from "@/lib/bus-utils";
import { BusConfigFields } from "@/components/shared/bus-config-fields";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface IOOverviewProps {
  projectId: Id<"projects">;
}

const PRESET_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
];

interface SortableIODeviceCardProps {
  ioDevice: IODevice;
  projectId: Id<"projects">;
  onRemove: () => void;
  onSaveToInventory: () => void;
}

function SortableIODeviceCard({ ioDevice, projectId, onRemove, onSaveToInventory }: SortableIODeviceCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: ioDevice._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card ref={setNodeRef} style={style} className={isDragging ? "z-50" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <button
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing touch-none p-1 -ml-1 hover:bg-muted rounded"
              title="Drag to reorder"
            >
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </button>
            <div
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: ioDevice.color }}
            />
            <CardTitle className="text-base">{ioDevice.name}</CardTitle>
          </div>
          <Badge variant="outline">{ioDevice.shortName}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground mb-4">
          <div className="flex items-center gap-1">
            <ArrowRight className="h-4 w-4" />
            <span>{ioDevice.inputCount} In</span>
          </div>
          <div className="flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" />
            <span>{ioDevice.outputCount} Out</span>
          </div>
          {(ioDevice.headphoneOutputCount ?? 0) > 0 && (
            <div className="flex items-center gap-1">
              <Headphones className="h-4 w-4" />
              <span>{ioDevice.headphoneOutputCount} HP</span>
            </div>
          )}
          {((ioDevice.aesInputCount ?? 0) > 0 || (ioDevice.aesOutputCount ?? 0) > 0) && (
            <div className="flex items-center gap-1">
              <span className="font-mono text-xs">AES</span>
              <span>
                {(ioDevice.aesInputCount ?? 0) > 0 && `${ioDevice.aesInputCount}In`}
                {(ioDevice.aesInputCount ?? 0) > 0 && (ioDevice.aesOutputCount ?? 0) > 0 && "/"}
                {(ioDevice.aesOutputCount ?? 0) > 0 && `${ioDevice.aesOutputCount}Out`}
              </span>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            asChild
            title="View Ports"
          >
            <Link href={`/project/${projectId}/io/${ioDevice._id}`}>
              <Eye className="h-4 w-4" />
            </Link>
          </Button>
          <IODeviceEditDialog ioDevice={ioDevice} />
          <Button
            variant="outline"
            size="icon"
            onClick={onSaveToInventory}
            title="Save to Inventory"
          >
            <Save className="h-4 w-4" />
          </Button>
          <Button
            variant="destructive"
            size="icon"
            onClick={onRemove}
            title="Remove"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface SortableMixerCardProps {
  mixer: Mixer;
  canDelete: boolean;
  onEdit: () => void;
  onRemove: () => void;
  onSaveToInventory: () => void;
}

function SortableMixerCard({ mixer, canDelete, onEdit, onRemove, onSaveToInventory }: SortableMixerCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: mixer._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card ref={setNodeRef} style={style} className={isDragging ? "z-50" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <button
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing touch-none p-1 -ml-1 hover:bg-muted rounded"
              title="Drag to reorder"
            >
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </button>
            <Badge variant="secondary" className="font-mono font-bold">
              {mixer.designation}
            </Badge>
            <CardTitle className="text-base">{mixer.name}</CardTitle>
          </div>
          {mixer.type && (
            <Badge variant="outline" className="text-xs">{mixer.type}</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3 text-sm text-muted-foreground mb-4">
          <span>{mixer.channelCount} ch</span>
          <span>·</span>
          <span>{mixer.stereoMode === "true_stereo" ? "True Stereo" : "Linked Mono"}</span>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={onEdit}
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={onSaveToInventory}
            title="Save to Inventory"
          >
            <Save className="h-4 w-4" />
          </Button>
          <Button
            variant="destructive"
            size="icon"
            onClick={onRemove}
            disabled={!canDelete}
            title={canDelete ? "Remove" : "Cannot delete last mixer"}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
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

export function IOOverview({ projectId }: IOOverviewProps) {
  const ioDevices = useQuery(api.ioDevices.list, { projectId });
  const mixers = useQuery(api.mixers.list, { projectId }) as Mixer[] | undefined;
  const createIODevice = useMutation(api.ioDevices.create);
  const removeIODevice = useMutation(api.ioDevices.remove);
  const reorderDevices = useMutation(api.ioDevices.reorderDevices);
  const createMixer = useMutation(api.mixers.create);
  const removeMixer = useMutation(api.mixers.remove);
  const reorderMixers = useMutation(api.mixers.reorderMixers);
  const saveIODeviceToInventory = useMutation(api.inventoryIODevices.saveFromProject);
  const saveMixerToInventory = useMutation(api.inventoryMixers.saveFromProject);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isMixerDialogOpen, setIsMixerDialogOpen] = useState(false);
  const [inventoryDialogType, setInventoryDialogType] = useState<"io-device" | "mixer" | null>(null);
  const [mixerSettingsTarget, setMixerSettingsTarget] = useState<Mixer | null>(null);
  const [ioDialogTab, setIoDialogTab] = useState("preset");
  const [newMixer, setNewMixer] = useState({
    name: "",
    type: "",
    stereoMode: "linked_mono" as "linked_mono" | "true_stereo",
    channelCount: 48,
    busConfig: { auxes: 24 } as BusConfig,
  });
  const [newIODevice, setNewIODevice] = useState({
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
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id && ioDevices) {
      const oldIndex = ioDevices.findIndex((d) => d._id === active.id);
      const newIndex = ioDevices.findIndex((d) => d._id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(ioDevices, oldIndex, newIndex);
        reorderDevices({
          deviceIds: reordered.map((d) => d._id) as Id<"ioDevices">[],
        });
      }
    }
  };

  const handleMixerDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id && mixers) {
      const oldIndex = mixers.findIndex((m) => m._id === active.id);
      const newIndex = mixers.findIndex((m) => m._id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(mixers, oldIndex, newIndex);
        reorderMixers({
          mixerIds: reordered.map((m) => m._id) as Id<"mixers">[],
        });
      }
    }
  };

  const handleCreateMixer = async () => {
    if (!newMixer.name || !mixers) return;

    await createMixer({
      projectId,
      name: newMixer.name,
      type: newMixer.type || undefined,
      stereoMode: newMixer.stereoMode,
      channelCount: newMixer.channelCount,
      busConfig: newMixer.busConfig,
      designation: getNextDesignation(mixers),
    });

    setNewMixer({
      name: "",
      type: "",
      stereoMode: "linked_mono",
      channelCount: 48,
      busConfig: { auxes: 24 },
    });
    setIsMixerDialogOpen(false);
  };

  const handleRemoveMixer = async (mixerId: string) => {
    try {
      await removeMixer({ mixerId: mixerId as Id<"mixers"> });
    } catch (error) {
      // Will throw if last mixer - could show toast
      console.error("Cannot delete mixer:", error);
    }
  };

  const handleCreate = async () => {
    if (!newIODevice.name || !newIODevice.shortName) return;

    await createIODevice({
      projectId,
      name: newIODevice.name,
      shortName: newIODevice.shortName,
      color: newIODevice.color,
      inputCount: newIODevice.inputCount,
      outputCount: newIODevice.outputCount,
      headphoneOutputCount: newIODevice.headphoneOutputCount,
      aesInputCount: newIODevice.aesInputCount,
      aesOutputCount: newIODevice.aesOutputCount,
      deviceType: newIODevice.deviceType,
      portsPerRow: newIODevice.deviceType === "stagebox" ? newIODevice.portsPerRow : undefined,
    });

    setNewIODevice({
      name: "",
      shortName: "",
      color: PRESET_COLORS[(PRESET_COLORS.indexOf(newIODevice.color) + 1) % PRESET_COLORS.length],
      inputCount: 32,
      outputCount: 16,
      headphoneOutputCount: 0,
      aesInputCount: 0,
      aesOutputCount: 0,
      deviceType: "stagebox",
      portsPerRow: 12,
    });
    setIsDialogOpen(false);
  };

  if (ioDevices === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-pulse text-muted-foreground">Loading IO devices...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Mixers Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">
            Mixers ({mixers?.length ?? 0})
          </h3>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setInventoryDialogType("mixer")}>
              <Package className="mr-2 h-4 w-4" />
              From Inventory
            </Button>
          <Dialog open={isMixerDialogOpen} onOpenChange={setIsMixerDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Add Mixer
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Mixer</DialogTitle>
                <DialogDescription>
                  Add a new mixer to the project. Input and output channels will be auto-generated.
                </DialogDescription>
              </DialogHeader>
              <Tabs defaultValue="preset">
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
                      setIsMixerDialogOpen(false);
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
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="mixer-name">Name</Label>
                      <Input
                        id="mixer-name"
                        placeholder="e.g. Monitor, FOH, Broadcast"
                        value={newMixer.name}
                        onChange={(e) => setNewMixer({ ...newMixer, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="mixer-type">Console Type (optional)</Label>
                      <Input
                        id="mixer-type"
                        placeholder="e.g. Yamaha CL5, DiGiCo SD12"
                        value={newMixer.type}
                        onChange={(e) => setNewMixer({ ...newMixer, type: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Stereo Mode</Label>
                      <Select
                        value={newMixer.stereoMode}
                        onValueChange={(v) => setNewMixer({ ...newMixer, stereoMode: v as "linked_mono" | "true_stereo" })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="linked_mono">Linked Mono</SelectItem>
                          <SelectItem value="true_stereo">True Stereo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="mixer-ch-count">Input Channels</Label>
                      <Input
                        id="mixer-ch-count"
                        type="number"
                        min={1}
                        max={256}
                        value={newMixer.channelCount}
                        onChange={(e) => setNewMixer({ ...newMixer, channelCount: parseInt(e.target.value) || 48 })}
                      />
                    </div>
                    <BusConfigFields
                      value={newMixer.busConfig}
                      onChange={(busConfig) => setNewMixer({ ...newMixer, busConfig })}
                    />
                    <Button
                      onClick={handleCreateMixer}
                      className="w-full"
                      disabled={!newMixer.name}
                    >
                      Create Mixer
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        {mixers && mixers.length > 0 && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleMixerDragEnd}
          >
            <SortableContext
              items={mixers.map((m) => m._id)}
              strategy={rectSortingStrategy}
            >
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {mixers.map((mixer) => (
                  <SortableMixerCard
                    key={mixer._id}
                    mixer={mixer as Mixer}
                    canDelete={mixers.length > 1}
                    onEdit={() => setMixerSettingsTarget(mixer as Mixer)}
                    onRemove={() => handleRemoveMixer(mixer._id)}
                    onSaveToInventory={() => saveMixerToInventory({ mixerId: mixer._id as Id<"mixers"> })}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Mixer Settings Dialog */}
      {mixerSettingsTarget && (
        <MixerSettingsDialog
          projectId={projectId}
          mixer={mixerSettingsTarget}
          open={!!mixerSettingsTarget}
          onOpenChange={(open) => !open && setMixerSettingsTarget(null)}
        />
      )}

      {/* IO Devices Section */}
      <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">
          IO Devices ({ioDevices.length})
        </h3>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setInventoryDialogType("io-device")}>
            <Package className="mr-2 h-4 w-4" />
            From Inventory
          </Button>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (open) setIoDialogTab("preset");
        }}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add IO Device
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New IO Device</DialogTitle>
              <DialogDescription>
                Add a new IO device to the project.
              </DialogDescription>
            </DialogHeader>
            <Tabs value={ioDialogTab} onValueChange={setIoDialogTab}>
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
                    setNewIODevice({
                      ...newIODevice,
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
                    setIoDialogTab("manual");
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
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="io-name">Name</Label>
                    <Input
                      id="io-name"
                      placeholder="e.g. Stage Left"
                      value={newIODevice.name}
                      onChange={(e) =>
                        setNewIODevice({ ...newIODevice, name: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="io-short">Short Name (for port prefix)</Label>
                    <Input
                      id="io-short"
                      placeholder="e.g. SL"
                      value={newIODevice.shortName}
                      onChange={(e) =>
                        setNewIODevice({ ...newIODevice, shortName: e.target.value.toUpperCase() })
                      }
                      maxLength={4}
                    />
                    <p className="text-xs text-muted-foreground">
                      Ports will be named as {newIODevice.shortName || "XX"}-I1, {newIODevice.shortName || "XX"}-O1, etc.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Device Type</Label>
                    <Select
                      value={newIODevice.deviceType}
                      onValueChange={(value: "stagebox" | "generic") =>
                        setNewIODevice({ ...newIODevice, deviceType: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="stagebox">
                          <div className="flex items-center gap-2">
                            <Grid3X3 className="h-4 w-4" />
                            <span>Stagebox</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="generic">
                          <div className="flex items-center gap-2">
                            <List className="h-4 w-4" />
                            <span>Generic (List only)</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {newIODevice.deviceType === "stagebox"
                        ? "Shows in the Stageboxes tab with horizontal grid layout"
                        : "Only shows in IO Devices list view"}
                    </p>
                  </div>
                  {newIODevice.deviceType === "stagebox" && (
                    <div className="space-y-2">
                      <Label htmlFor="io-portsPerRow">Ports per Row</Label>
                      <Select
                        value={newIODevice.portsPerRow.toString()}
                        onValueChange={(value) =>
                          setNewIODevice({ ...newIODevice, portsPerRow: parseInt(value) })
                        }
                      >
                        <SelectTrigger id="io-portsPerRow">
                          <SelectValue />
                        </SelectTrigger>
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
                        <button
                          key={color}
                          className={`w-8 h-8 rounded-full border-2 transition-all ${
                            newIODevice.color === color
                              ? "border-foreground scale-110"
                              : "border-transparent"
                          }`}
                          style={{ backgroundColor: color }}
                          onClick={() => setNewIODevice({ ...newIODevice, color })}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="io-inputs">Number of Inputs</Label>
                      <Input
                        id="io-inputs"
                        type="number"
                        min={1}
                        max={96}
                        value={newIODevice.inputCount}
                        onChange={(e) =>
                          setNewIODevice({
                            ...newIODevice,
                            inputCount: parseInt(e.target.value) || 1,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="io-outputs">Number of Outputs</Label>
                      <Input
                        id="io-outputs"
                        type="number"
                        min={1}
                        max={96}
                        value={newIODevice.outputCount}
                        onChange={(e) =>
                          setNewIODevice({
                            ...newIODevice,
                            outputCount: parseInt(e.target.value) || 1,
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="io-headphones">Headphone Outputs (stereo pairs)</Label>
                    <Input
                      id="io-headphones"
                      type="number"
                      min={0}
                      max={16}
                      value={newIODevice.headphoneOutputCount}
                      onChange={(e) =>
                        setNewIODevice({
                          ...newIODevice,
                          headphoneOutputCount: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                    {newIODevice.headphoneOutputCount > 0 && (
                      <p className="text-xs text-muted-foreground">
                        HP ports: {Array.from({ length: newIODevice.headphoneOutputCount }, (_, i) =>
                          `${newIODevice.shortName || "XX"}-HP${i + 1}L, ${newIODevice.shortName || "XX"}-HP${i + 1}R`
                        ).join(", ")}
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="io-aes-inputs">AES Inputs (stereo pairs)</Label>
                      <Input
                        id="io-aes-inputs"
                        type="number"
                        min={0}
                        max={16}
                        value={newIODevice.aesInputCount}
                        onChange={(e) =>
                          setNewIODevice({
                            ...newIODevice,
                            aesInputCount: parseInt(e.target.value) || 0,
                          })
                        }
                      />
                      {newIODevice.aesInputCount > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {Array.from({ length: newIODevice.aesInputCount }, (_, i) =>
                            `${newIODevice.shortName || "XX"}-AES${i + 1}L/R`
                          ).join(", ")}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="io-aes-outputs">AES Outputs (stereo pairs)</Label>
                      <Input
                        id="io-aes-outputs"
                        type="number"
                        min={0}
                        max={16}
                        value={newIODevice.aesOutputCount}
                        onChange={(e) =>
                          setNewIODevice({
                            ...newIODevice,
                            aesOutputCount: parseInt(e.target.value) || 0,
                          })
                        }
                      />
                      {newIODevice.aesOutputCount > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {Array.from({ length: newIODevice.aesOutputCount }, (_, i) =>
                            `${newIODevice.shortName || "XX"}-AESO${i + 1}L/R`
                          ).join(", ")}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    onClick={handleCreate}
                    className="w-full"
                    disabled={!newIODevice.name || !newIODevice.shortName}
                  >
                    Create IO Device
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {ioDevices.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Box className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground mb-4">
              No IO devices configured yet.
            </p>
            <Button onClick={() => setIsDialogOpen(true)} variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              Add First IO Device
            </Button>
          </CardContent>
        </Card>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={ioDevices.map((d) => d._id)}
            strategy={rectSortingStrategy}
          >
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {ioDevices.map((ioDevice) => (
                <SortableIODeviceCard
                  key={ioDevice._id}
                  ioDevice={ioDevice as IODevice}
                  projectId={projectId}
                  onRemove={() => removeIODevice({ ioDeviceId: ioDevice._id })}
                  onSaveToInventory={() => saveIODeviceToInventory({ ioDeviceId: ioDevice._id })}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
      </div>

      {/* From Inventory Dialog */}
      {inventoryDialogType && (
        <AddFromInventoryDialog
          projectId={projectId}
          type={inventoryDialogType}
          open={!!inventoryDialogType}
          onOpenChange={(open) => !open && setInventoryDialogType(null)}
        />
      )}
    </div>
  );
}
