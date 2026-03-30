"use client";

import { useEffect, useMemo, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import type { ProjectPresenceEntry } from "@/types/convex";
import { Badge } from "@/components/ui/badge";
import { useProjectAccess } from "./project-access-context";

export function ProjectPresenceStrip({
  projectId,
  activeArea,
}: {
  projectId: Id<"projects">;
  activeArea: string;
}) {
  const { accessToken, accessRole } = useProjectAccess();
  const sessionIdRef = useRef(`session-${Math.random().toString(36).slice(2)}`);
  const heartbeat = useMutation(api.collaboration.heartbeat);
  const leavePresence = useMutation(api.collaboration.leavePresence);
  const presence = useQuery(api.collaboration.listPresence, {
    projectId,
    accessToken,
  }) as ProjectPresenceEntry[] | undefined;

  useEffect(() => {
    if (accessRole === "share_viewer") return;

    void heartbeat({
      projectId,
      sessionId: sessionIdRef.current,
      activeArea,
    });

    const interval = window.setInterval(() => {
      void heartbeat({
        projectId,
        sessionId: sessionIdRef.current,
        activeArea,
      });
    }, 15000);

    const handleUnload = () => {
      void leavePresence({ projectId, sessionId: sessionIdRef.current });
    };

    window.addEventListener("beforeunload", handleUnload);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("beforeunload", handleUnload);
      void leavePresence({ projectId, sessionId: sessionIdRef.current });
    };
  }, [accessRole, activeArea, heartbeat, leavePresence, projectId]);

  const others = useMemo(
    () => (presence ?? []).filter((entry) => entry.sessionId !== sessionIdRef.current),
    [presence]
  );

  if (!presence) return null;
  if (others.length === 0) return null;

  return (
    <div className="flex items-center gap-2 overflow-x-auto">
      {others.map((entry) => (
        <Badge key={entry._id} variant="secondary" className="whitespace-nowrap">
          {entry.displayName}
        </Badge>
      ))}
    </div>
  );
}
