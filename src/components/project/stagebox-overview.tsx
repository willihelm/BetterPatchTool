"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { StageboxGrid } from "./stagebox-grid";
import { Card, CardContent } from "@/components/ui/card";
import { Box } from "lucide-react";

interface StageboxOverviewProps {
  projectId: Id<"projects">;
}

export function StageboxOverview({ projectId }: StageboxOverviewProps) {
  const devicesWithPorts = useQuery(api.ioDevices.listWithPorts, { projectId });
  const portUsageMap = useQuery(api.patching.getPortUsageMap, { projectId });

  if (devicesWithPorts === undefined || portUsageMap === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-pulse text-muted-foreground">Loading stageboxes...</div>
      </div>
    );
  }

  // Filter to only show stagebox devices (or devices without deviceType for backwards compatibility)
  const stageboxDevices = devicesWithPorts.filter(
    (d) => d.deviceType === "stagebox" || d.deviceType === undefined
  );

  if (stageboxDevices.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Box className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">
            No stagebox devices configured yet.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Add stagebox devices in the IO Devices tab.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Separate devices with inputs from devices with outputs
  const devicesWithInputs = stageboxDevices.filter((d) => d.inputPorts.length > 0);
  const devicesWithOutputs = stageboxDevices.filter((d) => d.outputPorts.length > 0);

  return (
    <div className="space-y-8">
      {/* Inputs Section */}
      {devicesWithInputs.length > 0 && (
        <section>
          <h3 className="text-lg font-medium mb-4 pb-2 border-b">
            Stageboxes: Inputs
          </h3>
          {devicesWithInputs.map((device) => (
            <StageboxGrid
              key={`${device._id}-inputs`}
              device={device}
              ports={device.inputPorts}
              portUsageMap={portUsageMap}
              portsPerRow={device.portsPerRow ?? 12}
            />
          ))}
        </section>
      )}

      {/* Outputs Section */}
      {devicesWithOutputs.length > 0 && (
        <section>
          <h3 className="text-lg font-medium mb-4 pb-2 border-b">
            Stageboxes: Outputs
          </h3>
          {devicesWithOutputs.map((device) => (
            <StageboxGrid
              key={`${device._id}-outputs`}
              device={device}
              ports={device.outputPorts}
              portUsageMap={portUsageMap}
              portsPerRow={device.portsPerRow ?? 12}
            />
          ))}
        </section>
      )}
    </div>
  );
}
