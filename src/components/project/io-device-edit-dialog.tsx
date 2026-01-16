"use client";

import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Pencil, Grid3X3, List } from "lucide-react";
import type { IODevice } from "@/types/convex";

interface IODeviceEditDialogProps {
  ioDevice: IODevice;
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

export function IODeviceEditDialog({ ioDevice }: IODeviceEditDialogProps) {
  const updateIODevice = useMutation(api.ioDevices.update);
  const updatePortLabels = useMutation(api.ioDevices.updatePortLabels);
  const updatePortCounts = useMutation(api.ioDevices.updatePortCounts);

  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: ioDevice.name,
    shortName: ioDevice.shortName,
    color: ioDevice.color,
    deviceType: (ioDevice.deviceType ?? "stagebox") as "stagebox" | "generic",
    portsPerRow: ioDevice.portsPerRow ?? 12,
    inputCount: ioDevice.inputCount,
    outputCount: ioDevice.outputCount,
  });
  const [updateLabels, setUpdateLabels] = useState(false);

  // Reset form when dialog opens or ioDevice changes
  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: ioDevice.name,
        shortName: ioDevice.shortName,
        color: ioDevice.color,
        deviceType: (ioDevice.deviceType ?? "stagebox") as "stagebox" | "generic",
        portsPerRow: ioDevice.portsPerRow ?? 12,
        inputCount: ioDevice.inputCount,
        outputCount: ioDevice.outputCount,
      });
      setUpdateLabels(false);
    }
  }, [isOpen, ioDevice]);

  const shortNameChanged = formData.shortName !== ioDevice.shortName;
  const portCountsChanged = formData.inputCount !== ioDevice.inputCount || formData.outputCount !== ioDevice.outputCount;

  const handleSave = async () => {
    if (!formData.name || !formData.shortName) return;

    await updateIODevice({
      ioDeviceId: ioDevice._id as Parameters<typeof updateIODevice>[0]["ioDeviceId"],
      name: formData.name,
      shortName: formData.shortName,
      color: formData.color,
      deviceType: formData.deviceType,
      portsPerRow: formData.deviceType === "stagebox" ? formData.portsPerRow : undefined,
    });

    // Update port labels if requested and shortName changed
    if (updateLabels && shortNameChanged) {
      await updatePortLabels({
        ioDeviceId: ioDevice._id as Parameters<typeof updatePortLabels>[0]["ioDeviceId"],
        newShortName: formData.shortName,
      });
    }

    // Update port counts if changed
    if (portCountsChanged) {
      await updatePortCounts({
        ioDeviceId: ioDevice._id as Parameters<typeof updatePortCounts>[0]["ioDeviceId"],
        newInputCount: formData.inputCount,
        newOutputCount: formData.outputCount,
      });
    }

    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" title="Edit">
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit IO Device</DialogTitle>
          <DialogDescription>
            Modify the properties of this IO device.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="edit-io-name">Name</Label>
            <Input
              id="edit-io-name"
              placeholder="e.g. Stage Left"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-io-short">Short Name (for port prefix)</Label>
            <Input
              id="edit-io-short"
              placeholder="e.g. SL"
              value={formData.shortName}
              onChange={(e) =>
                setFormData({ ...formData, shortName: e.target.value.toUpperCase() })
              }
              maxLength={4}
            />
            <p className="text-xs text-muted-foreground">
              Ports will be named as {formData.shortName || "XX"}-I1, {formData.shortName || "XX"}-O1, etc.
            </p>
          </div>
          {shortNameChanged && (
            <div className="flex items-center space-x-2 p-3 bg-muted rounded-md">
              <Checkbox
                id="update-labels"
                checked={updateLabels}
                onCheckedChange={(checked) => setUpdateLabels(checked === true)}
              />
              <Label htmlFor="update-labels" className="text-sm font-normal cursor-pointer">
                Update all port labels to use the new short name
              </Label>
            </div>
          )}
          <div className="space-y-2">
            <Label>Device Type</Label>
            <Select
              value={formData.deviceType}
              onValueChange={(value: "stagebox" | "generic") =>
                setFormData({ ...formData, deviceType: value })
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
              {formData.deviceType === "stagebox"
                ? "Shows in the Stageboxes tab with horizontal grid layout"
                : "Only shows in IO Devices list view"}
            </p>
          </div>
          {formData.deviceType === "stagebox" && (
            <div className="space-y-2">
              <Label htmlFor="edit-io-portsPerRow">Ports per Row</Label>
              <Select
                value={formData.portsPerRow.toString()}
                onValueChange={(value) =>
                  setFormData({ ...formData, portsPerRow: parseInt(value) })
                }
              >
                <SelectTrigger id="edit-io-portsPerRow">
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
                    formData.color === color
                      ? "border-foreground scale-110"
                      : "border-transparent"
                  }`}
                  style={{ backgroundColor: color }}
                  onClick={() => setFormData({ ...formData, color })}
                />
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-io-inputs">Number of Inputs</Label>
              <Input
                id="edit-io-inputs"
                type="number"
                min={1}
                max={96}
                value={formData.inputCount}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    inputCount: parseInt(e.target.value) || 1,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-io-outputs">Number of Outputs</Label>
              <Input
                id="edit-io-outputs"
                type="number"
                min={1}
                max={96}
                value={formData.outputCount}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    outputCount: parseInt(e.target.value) || 1,
                  })
                }
              />
            </div>
          </div>
          {portCountsChanged && (formData.inputCount < ioDevice.inputCount || formData.outputCount < ioDevice.outputCount) && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Reducing port counts will remove ports and clear any channel assignments using those ports.
            </p>
          )}
          <Button
            onClick={handleSave}
            className="w-full"
            disabled={!formData.name || !formData.shortName}
          >
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
