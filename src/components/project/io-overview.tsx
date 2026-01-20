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
import { Plus, Trash2, Box, ArrowRight, ArrowLeft, Eye, Grid3X3, List, Headphones, GripVertical } from "lucide-react";
import Link from "next/link";
import type { IODevice } from "@/types/convex";
import { IODeviceEditDialog } from "./io-device-edit-dialog";
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
}

function SortableIODeviceCard({ ioDevice, projectId, onRemove }: SortableIODeviceCardProps) {
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

export function IOOverview({ projectId }: IOOverviewProps) {
  const ioDevices = useQuery(api.ioDevices.list, { projectId });
  const createIODevice = useMutation(api.ioDevices.create);
  const removeIODevice = useMutation(api.ioDevices.remove);
  const reorderDevices = useMutation(api.ioDevices.reorderDevices);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">
          IO Devices ({ioDevices.length})
        </h3>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
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
          </DialogContent>
        </Dialog>
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
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
