"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { StageboxGrid } from "./stagebox-grid";
import { Card, CardContent } from "@/components/ui/card";
import { Box } from "lucide-react";
import { usePortData } from "./port-data-context";

interface StageboxOverviewProps {
  projectId: Id<"projects">;
}

export function StageboxOverview({ projectId }: StageboxOverviewProps) {
  const devicesWithPorts = useQuery(api.ioDevices.listWithPorts, { projectId });
  // Get port usage map from context instead of separate query
  const { portUsageMap, isLoading: portDataLoading } = usePortData();

  if (devicesWithPorts === undefined || portDataLoading) {
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
  const devicesWithHeadphones = stageboxDevices.filter((d) => d.headphonePorts && d.headphonePorts.length > 0);
  const devicesWithAesInputs = stageboxDevices.filter((d) => d.aesInputPorts && d.aesInputPorts.length > 0);
  const devicesWithAesOutputs = stageboxDevices.filter((d) => d.aesOutputPorts && d.aesOutputPorts.length > 0);

  return (
    <div className="space-y-6 sm:space-y-8 px-1 sm:px-0">
      {/* Inputs Section */}
      {devicesWithInputs.length > 0 && (
        <section>
          <h3 className="text-base sm:text-lg font-medium mb-3 sm:mb-4 pb-2 border-b sticky top-0 bg-background z-10">
            Inputs
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
          <h3 className="text-base sm:text-lg font-medium mb-3 sm:mb-4 pb-2 border-b sticky top-0 bg-background z-10">
            Outputs
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

      {/* Headphone Outputs Section */}
      {devicesWithHeadphones.length > 0 && (
        <section>
          <h3 className="text-base sm:text-lg font-medium mb-3 sm:mb-4 pb-2 border-b sticky top-0 bg-background z-10">
            Headphone Outputs
          </h3>
          {devicesWithHeadphones.map((device) => (
            <StageboxGrid
              key={`${device._id}-headphones`}
              device={device}
              ports={device.headphonePorts!}
              portUsageMap={portUsageMap}
              portsPerRow={device.portsPerRow ?? 12}
              isHeadphone={true}
            />
          ))}
        </section>
      )}

      {/* AES Inputs Section */}
      {devicesWithAesInputs.length > 0 && (
        <section>
          <h3 className="text-base sm:text-lg font-medium mb-3 sm:mb-4 pb-2 border-b sticky top-0 bg-background z-10">
            AES Inputs
          </h3>
          {devicesWithAesInputs.map((device) => (
            <StageboxGrid
              key={`${device._id}-aes-inputs`}
              device={device}
              ports={device.aesInputPorts!}
              portUsageMap={portUsageMap}
              portsPerRow={device.portsPerRow ?? 12}
              isAes={true}
            />
          ))}
        </section>
      )}

      {/* AES Outputs Section */}
      {devicesWithAesOutputs.length > 0 && (
        <section>
          <h3 className="text-base sm:text-lg font-medium mb-3 sm:mb-4 pb-2 border-b sticky top-0 bg-background z-10">
            AES Outputs
          </h3>
          {devicesWithAesOutputs.map((device) => (
            <StageboxGrid
              key={`${device._id}-aes-outputs`}
              device={device}
              ports={device.aesOutputPorts!}
              portUsageMap={portUsageMap}
              portsPerRow={device.portsPerRow ?? 12}
              isAes={true}
            />
          ))}
        </section>
      )}
    </div>
  );
}
