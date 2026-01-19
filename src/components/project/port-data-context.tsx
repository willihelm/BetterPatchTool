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

interface PortUsage {
  channelType: "input" | "output";
  channelId: string;
  channelName: string;
  channelNumber: number;
}

interface PortGroup {
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
