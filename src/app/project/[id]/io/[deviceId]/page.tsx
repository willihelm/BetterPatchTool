"use client";

import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../../../../convex/_generated/api";
import { Id } from "../../../../../../convex/_generated/dataModel";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import { ThemeSwitcher } from "@/components/ui/theme-switcher";
import { IODevicePortList } from "@/components/project/io-device-port-list";

export default function IODeviceDetailPage() {
  const params = useParams();
  const projectId = params.id as Id<"projects"> | undefined;
  const deviceId = params.deviceId as Id<"ioDevices"> | undefined;

  const device = useQuery(
    api.ioDevices.getWithPorts,
    deviceId ? { ioDeviceId: deviceId } : "skip"
  );
  const portUsageMap = useQuery(
    api.patching.getPortUsageMap,
    projectId ? { projectId } : "skip"
  );

  if (device === undefined || portUsageMap === undefined) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading device...</div>
      </div>
    );
  }

  if (device === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Device not found.</p>
          <Button asChild>
            <Link href={`/project/${projectId}`}>Back to Project</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" asChild>
                <Link href={`/project/${projectId}`}>
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <div className="flex items-center gap-3">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: device.color }}
                />
                <h1 className="text-lg font-semibold">{device.name}</h1>
                <Badge variant="outline">{device.shortName}</Badge>
              </div>
            </div>
            <ThemeSwitcher />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-6 space-y-8">
        {/* Inputs Section */}
        <section>
          <h2 className="text-lg font-medium mb-4">
            Inputs ({device.inputPorts.length})
          </h2>
          <IODevicePortList
            ports={device.inputPorts}
            portUsageMap={portUsageMap}
            deviceColor={device.color}
          />
        </section>

        {/* Outputs Section */}
        <section>
          <h2 className="text-lg font-medium mb-4">
            Outputs ({device.outputPorts.length})
          </h2>
          <IODevicePortList
            ports={device.outputPorts}
            portUsageMap={portUsageMap}
            deviceColor={device.color}
          />
        </section>
      </main>
    </div>
  );
}
