"use client";

import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, Users } from "lucide-react";
import { ThemeSwitcher } from "@/components/ui/theme-switcher";
import { InputChannelTable } from "@/components/project/input-channel-table";
import { OutputChannelTable } from "@/components/project/output-channel-table";
import { IOOverview } from "@/components/project/io-overview";
import { MixerSettingsDialog } from "@/components/project/mixer-settings-dialog";
import { PatchMatrix } from "@/components/project/patch-matrix";
import type { Project, Mixer } from "@/types/convex";

export default function ProjectPage() {
  const params = useParams();
  const projectId = params.id as Id<"projects">;

  const project = useQuery(api.projects.get, { projectId }) as Project | null | undefined;
  const mixers = useQuery(api.mixers.list, { projectId }) as Mixer[] | undefined;
  const inputChannels = useQuery(api.inputChannels.list, { projectId });
  const outputChannels = useQuery(api.outputChannels.list, { projectId });

  if (project === undefined) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading project...</div>
      </div>
    );
  }

  if (project === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Project not found.</p>
          <Button asChild>
            <Link href="/dashboard">Back to Dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  const currentMixer = mixers?.[0];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" asChild>
                <Link href="/dashboard">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <div>
                <h1 className="text-lg font-semibold">{project.title}</h1>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {project.date && <span>{project.date}</span>}
                  {project.venue && (
                    <>
                      {project.date && <span>·</span>}
                      <span>{project.venue}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {currentMixer && (
                <Badge variant="outline" className="hidden sm:flex">
                  {currentMixer.name} ({currentMixer.channelCount}ch)
                </Badge>
              )}
              <ThemeSwitcher />
              <Button variant="ghost" size="icon">
                <Users className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon">
                <Download className="h-4 w-4" />
              </Button>
              {currentMixer && (
                <MixerSettingsDialog
                  projectId={projectId}
                  mixer={currentMixer}
                  currentInputChannelCount={inputChannels?.length ?? 0}
                  currentOutputChannelCount={outputChannels?.length ?? 0}
                />
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-4">
        <Tabs defaultValue="inputs" className="h-full">
          <TabsList className="mb-4">
            <TabsTrigger value="inputs">Input Patch List</TabsTrigger>
            <TabsTrigger value="outputs">Output Patch List</TabsTrigger>
            <TabsTrigger value="matrix">Patch Matrix</TabsTrigger>
            <TabsTrigger value="io-devices">IO Devices</TabsTrigger>
          </TabsList>

          <TabsContent value="inputs" className="mt-0">
            <InputChannelTable projectId={projectId} />
          </TabsContent>

          <TabsContent value="outputs" className="mt-0">
            <OutputChannelTable projectId={projectId} />
          </TabsContent>

          <TabsContent value="matrix" className="mt-0">
            <PatchMatrix projectId={projectId} />
          </TabsContent>

          <TabsContent value="io-devices" className="mt-0">
            <IOOverview projectId={projectId} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
