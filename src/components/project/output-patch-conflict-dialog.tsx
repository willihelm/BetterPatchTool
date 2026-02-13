"use client";

import { useState, useCallback, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ConflictInfo {
  mixerName: string;
  channelNumber: number;
}

interface PendingPatch {
  channelId: Id<"outputChannels">;
  ioPortId: Id<"ioPorts"> | null;
  ioPortIdRight?: Id<"ioPorts"> | null;
  onSuccess?: () => void;
}

/**
 * Hook that wraps patchOutputChannel with cross-mixer conflict detection.
 * When a conflict is detected (port already used by another mixer), it returns
 * the conflict info instead of patching, and provides a way to force the patch.
 */
export function useOutputPatchWithConflict() {
  const patchChannel = useMutation(api.patching.patchOutputChannel);
  const [conflict, setConflict] = useState<ConflictInfo | null>(null);
  const pendingPatchRef = useRef<PendingPatch | null>(null);

  const patchWithConflictCheck = useCallback(
    async (args: {
      channelId: Id<"outputChannels">;
      ioPortId: Id<"ioPorts"> | null;
      ioPortIdRight?: Id<"ioPorts"> | null;
      onSuccess?: () => void;
    }) => {
      // Clearing a port never conflicts
      if (args.ioPortId === null && (args.ioPortIdRight === null || args.ioPortIdRight === undefined)) {
        await patchChannel({
          channelId: args.channelId,
          ioPortId: args.ioPortId,
          ioPortIdRight: args.ioPortIdRight,
          force: true,
        });
        args.onSuccess?.();
        return;
      }

      // Try without force to check for conflicts
      const result = await patchChannel({
        channelId: args.channelId,
        ioPortId: args.ioPortId,
        ioPortIdRight: args.ioPortIdRight,
      });

      if (result && typeof result === "object" && "conflict" in result && result.conflict) {
        // Store pending patch for if user confirms
        pendingPatchRef.current = {
          channelId: args.channelId,
          ioPortId: args.ioPortId,
          ioPortIdRight: args.ioPortIdRight,
          onSuccess: args.onSuccess,
        };
        setConflict(result.usedBy as ConflictInfo);
      } else {
        args.onSuccess?.();
      }
    },
    [patchChannel]
  );

  const confirmForce = useCallback(async () => {
    const pending = pendingPatchRef.current;
    if (!pending) return;

    await patchChannel({
      channelId: pending.channelId,
      ioPortId: pending.ioPortId,
      ioPortIdRight: pending.ioPortIdRight,
      force: true,
    });
    pending.onSuccess?.();
    pendingPatchRef.current = null;
    setConflict(null);
  }, [patchChannel]);

  const cancelConflict = useCallback(() => {
    pendingPatchRef.current = null;
    setConflict(null);
  }, []);

  return { patchWithConflictCheck, conflict, confirmForce, cancelConflict };
}

/**
 * Dialog component for output patch conflicts.
 * Shows when a port is already assigned to a channel on a different mixer.
 */
export function OutputPatchConflictDialog({
  conflict,
  onConfirm,
  onCancel,
}: {
  conflict: ConflictInfo | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <AlertDialog open={!!conflict} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Port already assigned</AlertDialogTitle>
          <AlertDialogDescription>
            This port is currently assigned to output channel {conflict?.channelNumber} on{" "}
            <strong>{conflict?.mixerName}</strong>. Continuing will remove it from that mixer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Reassign</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
