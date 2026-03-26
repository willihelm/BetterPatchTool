"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Save, ChevronDown, Plus, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "@/lib/date-utils";
import { SnapshotDiffDialog } from "./snapshot-diff-dialog";
import type { ProjectSnapshot } from "@/types/convex";

interface SnapshotPanelProps {
  projectId: Id<"projects">;
  onRestored?: (snapshotName: string) => void;
}

export function SnapshotPanel({ projectId, onRestored }: SnapshotPanelProps) {
  const snapshots = useQuery(api.snapshots.list, { projectId }) as ProjectSnapshot[] | undefined;
  const createSnapshot = useMutation(api.snapshots.create);
  const restoreSnapshot = useMutation(api.snapshots.restore);
  const deleteSnapshot = useMutation(api.snapshots.remove);

  const [createOpen, setCreateOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [diffSnapshotId, setDiffSnapshotId] = useState<Id<"projectSnapshots"> | null>(null);
  const [restoreSnapshotId, setRestoreSnapshotId] = useState<Id<"projectSnapshots"> | null>(null);
  const [deleteSnapshotId, setDeleteSnapshotId] = useState<Id<"projectSnapshots"> | null>(null);

  const selectedRestoreSnapshot = useMemo(
    () => snapshots?.find((snapshot) => snapshot._id === restoreSnapshotId) ?? null,
    [snapshots, restoreSnapshotId]
  );

  const selectedDeleteSnapshot = useMemo(
    () => snapshots?.find((snapshot) => snapshot._id === deleteSnapshotId) ?? null,
    [snapshots, deleteSnapshotId]
  );

  const handleCreate = async () => {
    if (!name.trim()) return;
    setIsSubmitting(true);
    try {
      await createSnapshot({
        projectId,
        name: name.trim(),
        note: note.trim() || undefined,
      });
      setName("");
      setNote("");
      setCreateOpen(false);
      setSheetOpen(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRestore = async () => {
    if (!restoreSnapshotId) return;
    const snapshot = snapshots?.find((item) => item._id === restoreSnapshotId);
    setIsSubmitting(true);
    try {
      await restoreSnapshot({ snapshotId: restoreSnapshotId });
      setRestoreSnapshotId(null);
      if (snapshot && onRestored) {
        onRestored(snapshot.name);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteSnapshotId) return;
    setIsSubmitting(true);
    try {
      await deleteSnapshot({ snapshotId: deleteSnapshotId });
      setDeleteSnapshotId(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2">
            <Save className="h-4 w-4" />
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Erstellen
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setSheetOpen(true)}>
            <List className="h-4 w-4" />
            Verwalten
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-2xl">
            <SheetHeader>
              <SheetTitle>Savepoints</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-4">
              {snapshots === undefined ? (
                <div className="text-sm text-muted-foreground">Loading savepoints...</div>
              ) : snapshots.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No savepoints yet. Create your first one!
                </div>
              ) : (
                <div className="space-y-3">
                  {snapshots.map((snapshot) => (
                    <div
                      key={snapshot._id}
                      className="rounded-lg border p-3 flex flex-col gap-2"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-medium">{snapshot.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatDistanceToNow(snapshot.createdAt)}
                          </div>
                        </div>
                        <Badge variant="outline">v{snapshot.dataVersion}</Badge>
                      </div>
                      {snapshot.note && (
                        <div className="text-sm text-muted-foreground">
                          {snapshot.note}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setDiffSnapshotId(snapshot._id as Id<"projectSnapshots">)
                          }
                        >
                          Diff anzeigen
                        </Button>
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() =>
                            setRestoreSnapshotId(snapshot._id as Id<"projectSnapshots">)
                          }
                        >
                          Wiederherstellen
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() =>
                            setDeleteSnapshotId(snapshot._id as Id<"projectSnapshots">)
                          }
                        >
                          Löschen
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Savepoint erstellen</DialogTitle>
            <DialogDescription>
              Speichert den aktuellen Projektzustand als Wiederherstellungspunkt.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="snapshot-name">Name</Label>
              <Input
                id="snapshot-name"
                placeholder="z.B. Vor Probe"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="snapshot-note">Notiz (optional)</Label>
              <Textarea
                id="snapshot-note"
                placeholder="Was ist besonders an diesem Stand?"
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleCreate} disabled={!name.trim() || isSubmitting}>
              {isSubmitting ? "Speichern..." : "Savepoint speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={restoreSnapshotId !== null}
        onOpenChange={(open) => !open && setRestoreSnapshotId(null)}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Savepoint wiederherstellen</DialogTitle>
            <DialogDescription>
              Der aktuelle Zustand wird vollständig ersetzt.
            </DialogDescription>
          </DialogHeader>
          {selectedRestoreSnapshot && (
            <div className="rounded-lg border p-3 text-sm">
              <div className="font-medium">{selectedRestoreSnapshot.name}</div>
              <div className="text-muted-foreground">
                Erstellt {formatDistanceToNow(selectedRestoreSnapshot.createdAt)}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoreSnapshotId(null)}>
              Abbrechen
            </Button>
            <Button
              variant="default"
              onClick={handleRestore}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Wiederherstellen..." : "Wiederherstellen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteSnapshotId !== null}
        onOpenChange={(open) => !open && setDeleteSnapshotId(null)}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Savepoint löschen</DialogTitle>
            <DialogDescription>
              Dieser Savepoint wird dauerhaft gelöscht.
            </DialogDescription>
          </DialogHeader>
          {selectedDeleteSnapshot && (
            <div className="rounded-lg border p-3 text-sm">
              <div className="font-medium">{selectedDeleteSnapshot.name}</div>
              <div className="text-muted-foreground">
                Erstellt {formatDistanceToNow(selectedDeleteSnapshot.createdAt)}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteSnapshotId(null)}>
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Löschen..." : "Löschen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SnapshotDiffDialog
        projectId={projectId}
        snapshotId={diffSnapshotId}
        open={diffSnapshotId !== null}
        onOpenChange={(open) => !open && setDiffSnapshotId(null)}
      />
    </>
  );
}
