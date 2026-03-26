"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { ProjectActivityEntry } from "@/types/convex";
import { formatDistanceToNow } from "@/lib/date-utils";
import { useProjectAccess } from "./project-access-context";

export function ProjectActivitySheet({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: Id<"projects">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { accessToken } = useProjectAccess();
  const activity = useQuery(api.collaboration.listActivity, {
    projectId,
    accessToken,
  }) as ProjectActivityEntry[] | undefined;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Recent Activity</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          {activity === undefined ? (
            <p className="text-sm text-muted-foreground">Loading activity...</p>
          ) : activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            activity.map((entry) => (
              <div key={entry._id} className="rounded-lg border p-3">
                <div className="text-sm font-medium">{entry.summary}</div>
                <div className="text-xs text-muted-foreground">
                  {entry.actorName} · {formatDistanceToNow(entry.createdAt)}
                </div>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
