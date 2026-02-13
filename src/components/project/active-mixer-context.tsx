"use client";

import { createContext, useContext, useState, useEffect, useMemo, ReactNode, useCallback, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import type { Mixer } from "@/types/convex";

interface ActiveMixerContextValue {
  activeMixerId: Id<"mixers"> | null;
  setActiveMixerId: (id: Id<"mixers">) => void;
  activeMixer: Mixer | null;
  mixers: Mixer[];
  needsMigration: boolean;
}

const ActiveMixerContext = createContext<ActiveMixerContextValue | null>(null);

interface ActiveMixerProviderProps {
  projectId: Id<"projects">;
  children: ReactNode;
}

export function ActiveMixerProvider({ projectId, children }: ActiveMixerProviderProps) {
  const mixers = useQuery(api.mixers.list, { projectId }) as Mixer[] | undefined;
  const inputChannels = useQuery(api.inputChannels.list, { projectId });
  const migrate = useMutation(api.migrations.assignChannelsToDefaultMixer);

  const [activeMixerId, setActiveMixerIdState] = useState<Id<"mixers"> | null>(null);
  const migrationTriggered = useRef(false);

  // Check if migration is needed (any channels without mixerId)
  const needsMigration = useMemo(() => {
    if (!inputChannels || !mixers || mixers.length === 0) return false;
    return inputChannels.some(ch => !ch.mixerId);
  }, [inputChannels, mixers]);

  // Trigger migration once
  useEffect(() => {
    if (needsMigration && !migrationTriggered.current) {
      migrationTriggered.current = true;
      migrate({ projectId });
    }
  }, [needsMigration, migrate, projectId]);

  // Initialize to first mixer
  useEffect(() => {
    if (mixers && mixers.length > 0 && !activeMixerId) {
      setActiveMixerIdState(mixers[0]._id as Id<"mixers">);
    }
  }, [mixers, activeMixerId]);

  // Fallback if active mixer is deleted
  useEffect(() => {
    if (mixers && mixers.length > 0 && activeMixerId) {
      const stillExists = mixers.some(m => m._id === activeMixerId);
      if (!stillExists) {
        setActiveMixerIdState(mixers[0]._id as Id<"mixers">);
      }
    }
  }, [mixers, activeMixerId]);

  const activeMixer = useMemo(() => {
    if (!mixers || !activeMixerId) return null;
    return (mixers.find(m => m._id === activeMixerId) as Mixer) ?? null;
  }, [mixers, activeMixerId]);

  const setActiveMixerId = useCallback((id: Id<"mixers">) => {
    setActiveMixerIdState(id);
  }, []);

  const value = useMemo<ActiveMixerContextValue>(() => ({
    activeMixerId,
    setActiveMixerId,
    activeMixer,
    mixers: (mixers ?? []) as Mixer[],
    needsMigration,
  }), [activeMixerId, setActiveMixerId, activeMixer, mixers, needsMigration]);

  return (
    <ActiveMixerContext.Provider value={value}>
      {children}
    </ActiveMixerContext.Provider>
  );
}

export function useActiveMixer() {
  const context = useContext(ActiveMixerContext);
  if (!context) {
    throw new Error("useActiveMixer must be used within an ActiveMixerProvider");
  }
  return context;
}
