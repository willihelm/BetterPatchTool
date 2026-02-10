"use client";

import { createContext, useContext, ReactNode, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

interface PortInfo {
  label: string;
  deviceColor: string;
  deviceName: string;
}

interface PortUsageEntry {
  channelType: "input" | "output";
  channelId: string;
  channelName: string;
  channelNumber: number;
}

type PortUsage = PortUsageEntry[];

// Normalize port usage - handles both old single-object format and new array format
function normalizeUsage(usage: PortUsage | PortUsageEntry | undefined): PortUsageEntry[] {
  if (!usage) return [];
  // Handle old single-object format (backwards compatibility)
  if (!Array.isArray(usage)) {
    return [usage];
  }
  return usage;
}

// Helper to check if port is used by a different channel
export function isPortUsedByOther(usage: PortUsage | PortUsageEntry | undefined, currentChannelId: string): boolean {
  const normalized = normalizeUsage(usage);
  if (normalized.length === 0) return false;
  return normalized.some(entry => entry.channelId !== currentChannelId);
}

// Helper to get the first channel name from port usage (for display when port is taken)
export function getPortUsageDisplayName(usage: PortUsage | PortUsageEntry | undefined): string {
  const normalized = normalizeUsage(usage);
  if (normalized.length === 0) return "";
  return normalized[0].channelName;
}

export interface PortGroup {
  device: {
    _id: string;
    name: string;
    shortName: string;
    color: string;
  };
  ports: Array<{
    _id: string;
    label: string;
    portNumber: number;
    isUsed: boolean;
    subType?: string;
  }>;
}

interface PortDataContextValue {
  isLoading: boolean;
  portInfoMap: Record<string, PortInfo>;
  portUsageMap: Record<string, PortUsage>;
  inputPortGroups: PortGroup[];
  outputPortGroups: PortGroup[];
}

const PortDataContext = createContext<PortDataContextValue | null>(null);

interface PortDataProviderProps {
  projectId: Id<"projects">;
  children: ReactNode;
}

export function PortDataProvider({ projectId, children }: PortDataProviderProps) {
  const data = useQuery(api.patching.getAllPatchingData, { projectId });

  const value = useMemo<PortDataContextValue>(() => {
    if (!data) {
      return {
        isLoading: true,
        portInfoMap: {},
        portUsageMap: {},
        inputPortGroups: [],
        outputPortGroups: [],
      };
    }

    return {
      isLoading: false,
      portInfoMap: data.portInfoMap,
      portUsageMap: data.portUsageMap,
      inputPortGroups: data.inputPortGroups,
      outputPortGroups: data.outputPortGroups,
    };
  }, [data]);

  return (
    <PortDataContext.Provider value={value}>
      {children}
    </PortDataContext.Provider>
  );
}

export function usePortData() {
  const context = useContext(PortDataContext);
  if (!context) {
    throw new Error("usePortData must be used within a PortDataProvider");
  }
  return context;
}

// Hook to get the display info for a specific port (for closed dropdown state)
export function usePortInfo(portId: string | undefined) {
  const { portInfoMap } = usePortData();
  return portId ? portInfoMap[portId] : null;
}
