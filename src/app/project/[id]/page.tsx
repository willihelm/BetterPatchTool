"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, Users, Settings2, Share2, Save } from "lucide-react";
import { ThemeSwitcher } from "@/components/ui/theme-switcher";
import { PatchList } from "@/components/project/patch-list";
import { IOOverview } from "@/components/project/io-overview";
import { MixerSettingsDialog } from "@/components/project/mixer-settings-dialog";
import { PatchMatrix } from "@/components/project/patch-matrix";
import { StageboxOverview } from "@/components/project/stagebox-overview";
import { PortDataProvider } from "@/components/project/port-data-context";
import { PDFExportDialog } from "@/components/project/pdf-export-dialog";
import { SnapshotPanel } from "@/components/project/snapshot-panel";
import type { Project, Mixer } from "@/types/convex";

export default function ProjectPage() {
  const params = useParams();
  const projectId = params.id as Id<"projects">;
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);

  const project = useQuery(api.projects.get, { projectId }) as Project | null | undefined;
  const mixers = useQuery(api.mixers.list, { projectId }) as Mixer[] | undefined;
  const inputChannels = useQuery(api.inputChannels.list, { projectId });
  const outputChannels = useQuery(api.outputChannels.list, { projectId });

  if (project === undefined) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          <div className="animate-pulse text-muted-foreground font-mono text-xs uppercase tracking-widest">Loading project data...</div>
        </div>
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
    <PortDataProvider projectId={projectId}>
      <div className="min-h-screen bg-background flex flex-col font-sans">
        {/* Header - Technical Panel Look */}
        <header className="border-b border-border/50 bg-card/80 backdrop-blur-md sticky top-0 z-50">
          <div className="container mx-auto px-4 py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild className="h-8 w-8 hover:bg-primary/10 hover:text-primary">
                  <Link href="/dashboard">
                    <ArrowLeft className="h-4 w-4" />
                  </Link>
                </Button>
                <div className="flex flex-col">
                  <h1 className="text-lg font-bold uppercase tracking-tight leading-none text-foreground">{project.title}</h1>
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground mt-1 font-mono">
                    {project.date && <span>{project.date}</span>}
                    {project.venue && (
                      <>
                        <span className="text-primary/50">///</span>
                        <span>{project.venue}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {currentMixer && (
                  <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-muted/30 rounded border border-border/50 mr-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_5px_#22c55e]" />
                    <span className="text-xs font-mono font-bold">{currentMixer.name}</span>
                    <span className="text-[10px] text-muted-foreground ml-1">({currentMixer.channelCount}CH)</span>
                  </div>
                )}

                <div className="h-6 w-px bg-border/50 mx-1" />

                <SnapshotPanel
                  projectId={projectId}
                  ownerId={project.ownerId}
                  onRestored={(name) =>
                    setRestoreMessage(`Restored "${name}".`)
                  }
                />

                <Button variant="ghost" size="icon" title="Collaborators" className="h-8 w-8">
                  <Users className="h-4 w-4" />
                </Button>

                <Button variant="ghost" size="icon" onClick={() => setExportDialogOpen(true)} title="Export" className="h-8 w-8">
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

                <div className="ml-1">
                  <ThemeSwitcher />
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 container mx-auto px-4 py-4 flex flex-col h-[calc(100vh-60px)]">
          {restoreMessage && (
            <div className="mb-4 rounded border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-xs font-mono text-emerald-400 flex items-center">
              <span className="w-2 h-2 bg-emerald-500 rounded-full mr-2 animate-pulse" />
              {restoreMessage}
            </div>
          )}

          <Tabs defaultValue="patch-list" className="flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <TabsList className="w-auto border-b-0 gap-8 h-10 px-0">
                <TabsTrigger value="patch-list" className="px-0 pb-2 text-xs font-bold">PATCH LIST</TabsTrigger>
                <TabsTrigger value="matrix" className="px-0 pb-2 text-xs font-bold">MATRIX GRID</TabsTrigger>
                <TabsTrigger value="stageboxes" className="px-0 pb-2 text-xs font-bold">STAGEBOXES</TabsTrigger>
                <TabsTrigger value="io-devices" className="px-0 pb-2 text-xs font-bold">I/O DEVICES</TabsTrigger>
              </TabsList>
            </div>

            <div className="w-full h-px bg-border/50 mb-4" />

            <TabsContent value="patch-list" className="mt-0 flex-1 outline-none data-[state=inactive]:hidden">
              <div className="h-full border border-border/40 rounded-sm bg-card/30 backdrop-blur-sm overflow-hidden">
                <PatchList projectId={projectId} />
              </div>
            </TabsContent>

            <TabsContent value="matrix" className="mt-0 flex-1 outline-none data-[state=inactive]:hidden">
              <div className="h-full border border-border/40 rounded-sm bg-card/30 backdrop-blur-sm p-4 overflow-hidden">
                <PatchMatrix projectId={projectId} />
              </div>
            </TabsContent>

            <TabsContent value="stageboxes" className="mt-0 flex-1 outline-none data-[state=inactive]:hidden">
              <div className="h-full border border-border/40 rounded-sm bg-card/30 backdrop-blur-sm p-4 overflow-auto">
                <StageboxOverview projectId={projectId} />
              </div>
            </TabsContent>

            <TabsContent value="io-devices" className="mt-0 flex-1 outline-none data-[state=inactive]:hidden">
              <div className="h-full border border-border/40 rounded-sm bg-card/30 backdrop-blur-sm p-4 overflow-auto">
                <IOOverview projectId={projectId} />
              </div>
            </TabsContent>
          </Tabs>
        </main>

        {/* PDF Export Dialog */}
        <PDFExportDialog
          open={exportDialogOpen}
          onOpenChange={setExportDialogOpen}
          project={project}
          inputChannels={inputChannels ?? []}
          outputChannels={outputChannels ?? []}
          mixers={mixers ?? []}
          projectId={projectId}
        />
      </div>
    </PortDataProvider>
  );
}
