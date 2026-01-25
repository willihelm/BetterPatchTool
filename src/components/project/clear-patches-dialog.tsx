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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ClearPatchesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channelType: "input" | "output";
  channelCount: number;
  onConfirm: () => Promise<void>;
}

export function ClearPatchesDialog({
  open,
  onOpenChange,
  channelType,
  channelCount,
  onConfirm,
}: ClearPatchesDialogProps) {
  const [confirmText, setConfirmText] = useState("");
  const [isClearing, setIsClearing] = useState(false);

  const isConfirmed = confirmText.toLowerCase() === "clear";

  const handleClear = async () => {
    if (!isConfirmed) return;

    setIsClearing(true);
    try {
      await onConfirm();
      setConfirmText("");
    } finally {
      setIsClearing(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setConfirmText("");
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Clear All Patches</DialogTitle>
          <DialogDescription>
            This will clear all patches for {channelCount}{" "}
            {channelType} channel{channelCount !== 1 ? "s" : ""}. This action
            cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="confirm-text">
              Type &quot;CLEAR&quot; to confirm
            </Label>
            <Input
              id="confirm-text"
              placeholder="CLEAR"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isClearing}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleClear}
            disabled={!isConfirmed || isClearing}
          >
            {isClearing ? "Clearing..." : "Clear All Patches"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
