"use client";

import { useState, useCallback } from "react";
import { useQuery } from "convex/react";
import { pdf } from "@react-pdf/renderer";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { PDFDocument } from "./pdf/pdf-document";
import { defaultPDFExportOptions, type PDFExportOptions } from "@/types/pdf-export";
import type { Project, Mixer, InputChannel, OutputChannel } from "@/types/convex";
import { usePortData } from "./port-data-context";

interface PDFExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
  inputChannels: InputChannel[];
  outputChannels: OutputChannel[];
  mixers: Mixer[];
  projectId: Id<"projects">;
}

export function PDFExportDialog({
  open,
  onOpenChange,
  project,
  inputChannels,
  outputChannels,
  mixers,
  projectId,
}: PDFExportDialogProps) {
  const [options, setOptions] = useState<PDFExportOptions>(defaultPDFExportOptions);
  const [isExporting, setIsExporting] = useState(false);

  // Fetch IO devices
  const ioDevices = useQuery(api.ioDevices.list, { projectId });
  const devicesWithPorts = useQuery(api.ioDevices.listWithPorts, { projectId });

  // Get port data from context
  const { portInfoMap, portUsageMap } = usePortData();

  const currentMixer = mixers?.[0];

  const updateOption = useCallback(<K extends keyof PDFExportOptions>(
    key: K,
    value: PDFExportOptions[K]
  ) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
  }, []);

  const updateInputColumn = useCallback((
    column: keyof PDFExportOptions["inputColumns"],
    value: boolean
  ) => {
    setOptions((prev) => ({
      ...prev,
      inputColumns: { ...prev.inputColumns, [column]: value },
    }));
  }, []);

  const updateOutputColumn = useCallback((
    column: keyof PDFExportOptions["outputColumns"],
    value: boolean
  ) => {
    setOptions((prev) => ({
      ...prev,
      outputColumns: { ...prev.outputColumns, [column]: value },
    }));
  }, []);

  const toggleDeviceSelection = useCallback((deviceId: string) => {
    setOptions((prev) => {
      const currentIds = prev.selectedDeviceIds;
      if (currentIds.length === 0) {
        // If empty (all selected), switch to all except this one
        const allDeviceIds = ioDevices?.map((d) => d._id) ?? [];
        return {
          ...prev,
          selectedDeviceIds: allDeviceIds.filter((id) => id !== deviceId),
        };
      }
      if (currentIds.includes(deviceId)) {
        // Remove from selection
        const newIds = currentIds.filter((id) => id !== deviceId);
        // If all would be deselected, reset to all
        if (newIds.length === 0) {
          return { ...prev, selectedDeviceIds: [] };
        }
        return { ...prev, selectedDeviceIds: newIds };
      }
      // Add to selection
      const newIds = [...currentIds, deviceId];
      // If all devices are selected, reset to empty (meaning all)
      if (ioDevices && newIds.length === ioDevices.length) {
        return { ...prev, selectedDeviceIds: [] };
      }
      return { ...prev, selectedDeviceIds: newIds };
    });
  }, [ioDevices]);

  const isDeviceSelected = useCallback((deviceId: string) => {
    if (options.selectedDeviceIds.length === 0) return true;
    return options.selectedDeviceIds.includes(deviceId);
  }, [options.selectedDeviceIds]);

  const handleExport = async () => {
    if (!devicesWithPorts) return;

    setIsExporting(true);
    try {
      const doc = (
        <PDFDocument
          project={project}
          mixer={currentMixer}
          inputChannels={inputChannels}
          outputChannels={outputChannels}
          devicesWithPorts={devicesWithPorts}
          portInfoMap={portInfoMap}
          portUsageMap={portUsageMap}
          options={options}
        />
      );

      const blob = await pdf(doc).toBlob();
      const url = URL.createObjectURL(blob);

      // Create filename
      const sanitizedTitle = project.title.replace(/[^a-zA-Z0-9]/g, "_");
      const date = project.date || new Date().toISOString().split("T")[0];
      const filename = `${sanitizedTitle}_${date}_patch_sheet.pdf`;

      // Trigger download
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      onOpenChange(false);
    } catch (error) {
      console.error("Error exporting PDF:", error);
    } finally {
      setIsExporting(false);
    }
  };

  const canExport =
    devicesWithPorts &&
    (options.includeInputs || options.includeOutputs || options.includeStageboxOverview);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Export PDF</DialogTitle>
          <DialogDescription>
            Configure which sections and columns to include in the exported patch sheet.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Content Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Content</Label>
            <div className="grid gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={options.includeInputs}
                  onCheckedChange={(checked) =>
                    updateOption("includeInputs", checked === true)
                  }
                />
                <span className="text-sm">Input Channels</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={options.includeOutputs}
                  onCheckedChange={(checked) =>
                    updateOption("includeOutputs", checked === true)
                  }
                />
                <span className="text-sm">Output Channels</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={options.includeStageboxOverview}
                  onCheckedChange={(checked) =>
                    updateOption("includeStageboxOverview", checked === true)
                  }
                />
                <span className="text-sm">Stagebox Overview</span>
              </label>
            </div>
          </div>

          {/* IO Device Selection */}
          {ioDevices && ioDevices.length > 0 && (
            <div className="space-y-3">
              <Label className="text-sm font-semibold">IO Devices</Label>
              <p className="text-xs text-muted-foreground">
                Filter which devices to include. Unpatched channels are always included.
              </p>
              <div className="grid gap-2 max-h-32 overflow-y-auto border rounded-md p-2">
                {ioDevices.map((device) => (
                  <label
                    key={device._id}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Checkbox
                      checked={isDeviceSelected(device._id)}
                      onCheckedChange={() => toggleDeviceSelection(device._id)}
                    />
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: device.color }}
                    />
                    <span className="text-sm">
                      {device.name} ({device.shortName})
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Input Column Selection */}
          {options.includeInputs && (
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Input Channel Columns</Label>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={options.inputColumns.channelNumber}
                    onCheckedChange={(checked) =>
                      updateInputColumn("channelNumber", checked === true)
                    }
                  />
                  <span className="text-sm">Channel Number</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={options.inputColumns.port}
                    onCheckedChange={(checked) =>
                      updateInputColumn("port", checked === true)
                    }
                  />
                  <span className="text-sm">Port</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={options.inputColumns.source}
                    onCheckedChange={(checked) =>
                      updateInputColumn("source", checked === true)
                    }
                  />
                  <span className="text-sm">Source</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={options.inputColumns.uhf}
                    onCheckedChange={(checked) =>
                      updateInputColumn("uhf", checked === true)
                    }
                  />
                  <span className="text-sm">UHF/Wireless</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={options.inputColumns.micInputDev}
                    onCheckedChange={(checked) =>
                      updateInputColumn("micInputDev", checked === true)
                    }
                  />
                  <span className="text-sm">Mic/Input Device</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={options.inputColumns.location}
                    onCheckedChange={(checked) =>
                      updateInputColumn("location", checked === true)
                    }
                  />
                  <span className="text-sm">Location</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={options.inputColumns.cable}
                    onCheckedChange={(checked) =>
                      updateInputColumn("cable", checked === true)
                    }
                  />
                  <span className="text-sm">Cable</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={options.inputColumns.stand}
                    onCheckedChange={(checked) =>
                      updateInputColumn("stand", checked === true)
                    }
                  />
                  <span className="text-sm">Stand</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={options.inputColumns.notes}
                    onCheckedChange={(checked) =>
                      updateInputColumn("notes", checked === true)
                    }
                  />
                  <span className="text-sm">Notes</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={options.inputColumns.patched}
                    onCheckedChange={(checked) =>
                      updateInputColumn("patched", checked === true)
                    }
                  />
                  <span className="text-sm">Patched</span>
                </label>
              </div>
            </div>
          )}

          {/* Output Column Selection */}
          {options.includeOutputs && (
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Output Channel Columns</Label>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={options.outputColumns.rowNumber}
                    onCheckedChange={(checked) =>
                      updateOutputColumn("rowNumber", checked === true)
                    }
                  />
                  <span className="text-sm">Row Number</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={options.outputColumns.port}
                    onCheckedChange={(checked) =>
                      updateOutputColumn("port", checked === true)
                    }
                  />
                  <span className="text-sm">Port</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={options.outputColumns.busName}
                    onCheckedChange={(checked) =>
                      updateOutputColumn("busName", checked === true)
                    }
                  />
                  <span className="text-sm">Bus Name</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={options.outputColumns.destination}
                    onCheckedChange={(checked) =>
                      updateOutputColumn("destination", checked === true)
                    }
                  />
                  <span className="text-sm">Destination</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={options.outputColumns.ampProcessor}
                    onCheckedChange={(checked) =>
                      updateOutputColumn("ampProcessor", checked === true)
                    }
                  />
                  <span className="text-sm">Amp/Processor</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={options.outputColumns.location}
                    onCheckedChange={(checked) =>
                      updateOutputColumn("location", checked === true)
                    }
                  />
                  <span className="text-sm">Location</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={options.outputColumns.cable}
                    onCheckedChange={(checked) =>
                      updateOutputColumn("cable", checked === true)
                    }
                  />
                  <span className="text-sm">Cable</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={options.outputColumns.notes}
                    onCheckedChange={(checked) =>
                      updateOutputColumn("notes", checked === true)
                    }
                  />
                  <span className="text-sm">Notes</span>
                </label>
              </div>
            </div>
          )}

          {/* Page Settings */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Page Settings</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="page-size" className="text-xs text-muted-foreground">
                  Page Size
                </Label>
                <Select
                  value={options.pageSize}
                  onValueChange={(value) =>
                    updateOption("pageSize", value as "A4" | "LETTER")
                  }
                >
                  <SelectTrigger id="page-size">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A4">A4</SelectItem>
                    <SelectItem value="LETTER">Letter</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="orientation" className="text-xs text-muted-foreground">
                  Orientation
                </Label>
                <Select
                  value={options.orientation}
                  onValueChange={(value) =>
                    updateOption("orientation", value as "portrait" | "landscape")
                  }
                >
                  <SelectTrigger id="orientation">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="portrait">Portrait</SelectItem>
                    <SelectItem value="landscape">Landscape</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={!canExport || isExporting}>
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              "Export PDF"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
