"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { StageboxGrid } from "./stagebox-grid";
import { Card, CardContent } from "@/components/ui/card";
import { Box } from "lucide-react";
import { usePortData } from "./port-data-context";

type GroupMode = "device" | "type";

interface StageboxOverviewProps {
  projectId: Id<"projects">;
}

export function StageboxOverview({ projectId }: StageboxOverviewProps) {
  const [groupMode, setGroupMode] = useState<GroupMode>("device");
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

  const devicesWithInputs = stageboxDevices.filter((d) => d.inputPorts.length > 0);
  const devicesWithOutputs = stageboxDevices.filter((d) => d.outputPorts.length > 0);
  const devicesWithHeadphones = stageboxDevices.filter((d) => d.headphonePorts && d.headphonePorts.length > 0);
  const devicesWithAesInputs = stageboxDevices.filter((d) => d.aesInputPorts && d.aesInputPorts.length > 0);
  const devicesWithAesOutputs = stageboxDevices.filter((d) => d.aesOutputPorts && d.aesOutputPorts.length > 0);

  return (
    <div className="space-y-6 sm:space-y-8 px-1 sm:px-0">
      {/* Group mode toggle */}
      <div className="flex items-center gap-1 rounded-lg bg-muted p-1 w-fit">
        <button
          onClick={() => setGroupMode("device")}
          className={`px-3 py-1 text-sm rounded-md transition-colors ${
            groupMode === "device"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          By Device
        </button>
        <button
          onClick={() => setGroupMode("type")}
          className={`px-3 py-1 text-sm rounded-md transition-colors ${
            groupMode === "type"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          By Type
        </button>
      </div>

      {groupMode === "device" ? (
        // Group by device
        stageboxDevices.map((device) => {
          const hasInputs = device.inputPorts.length > 0;
          const hasOutputs = device.outputPorts.length > 0;
          const hasHeadphones = device.headphonePorts && device.headphonePorts.length > 0;
          const hasAesInputs = device.aesInputPorts && device.aesInputPorts.length > 0;
          const hasAesOutputs = device.aesOutputPorts && device.aesOutputPorts.length > 0;

          return (
            <section key={device._id}>
              <div className="flex items-center gap-3 mb-3 sm:mb-4 pb-2 border-b sticky top-0 bg-background z-10">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: device.color }}
                />
                <h3 className="text-base sm:text-lg font-medium">
                  {device.name}
                </h3>
                <span className="text-sm text-muted-foreground">
                  ({device.shortName})
                </span>
              </div>

              {hasInputs && (
                <StageboxGrid
                  key={`${device._id}-inputs`}
                  device={device}
                  ports={device.inputPorts}
                  portUsageMap={portUsageMap}
                  portsPerRow={device.portsPerRow ?? 12}
                  sectionLabel="Inputs"
                />
              )}

              {hasOutputs && (
                <StageboxGrid
                  key={`${device._id}-outputs`}
                  device={device}
                  ports={device.outputPorts}
                  portUsageMap={portUsageMap}
                  portsPerRow={device.portsPerRow ?? 12}
                  sectionLabel="Outputs"
                />
              )}

              {hasHeadphones && (
                <StageboxGrid
                  key={`${device._id}-headphones`}
                  device={device}
                  ports={device.headphonePorts!}
                  portUsageMap={portUsageMap}
                  portsPerRow={device.portsPerRow ?? 12}
                  isHeadphone={true}
                  sectionLabel="Headphone Outputs"
                />
              )}

              {hasAesInputs && (
                <StageboxGrid
                  key={`${device._id}-aes-inputs`}
                  device={device}
                  ports={device.aesInputPorts!}
                  portUsageMap={portUsageMap}
                  portsPerRow={device.portsPerRow ?? 12}
                  isAes={true}
                  sectionLabel="AES Inputs"
                />
              )}

              {hasAesOutputs && (
                <StageboxGrid
                  key={`${device._id}-aes-outputs`}
                  device={device}
                  ports={device.aesOutputPorts!}
                  portUsageMap={portUsageMap}
                  portsPerRow={device.portsPerRow ?? 12}
                  isAes={true}
                  sectionLabel="AES Outputs"
                />
              )}
            </section>
          );
        })
      ) : (
        // Group by type
        <>
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
        </>
      )}
    </div>
  );
}
