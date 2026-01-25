"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ClearDevicePatchesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deviceName: string;
  deviceColor: string;
  channelType: "input" | "output";
  channelCount: number;
  onConfirm: () => Promise<void>;
}

export function ClearDevicePatchesDialog({
  open,
  onOpenChange,
  deviceName,
  deviceColor,
  channelType,
  channelCount,
  onConfirm,
}: ClearDevicePatchesDialogProps) {
  const [isClearing, setIsClearing] = useState(false);

  const handleClear = async () => {
    setIsClearing(true);
    try {
      await onConfirm();
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Clear Device Patches</DialogTitle>
          <DialogDescription>
            Clear all patches to{" "}
            <span className="inline-flex items-center gap-2 font-medium text-foreground">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: deviceColor }}
              />
              {deviceName}
            </span>
            ? This will affect {channelCount}{" "}
            {channelType} channel{channelCount !== 1 ? "s" : ""}.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isClearing}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleClear}
            disabled={isClearing}
          >
            {isClearing ? "Clearing..." : "Clear Patches"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
