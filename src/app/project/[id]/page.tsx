"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, Users, MoreVertical, Sun, Moon, Monitor, History } from "lucide-react";
import { useTheme } from "next-themes";
import { PatchList } from "@/components/project/patch-list";
import { IOOverview } from "@/components/project/io-overview";
import { MixerSettingsDialog } from "@/components/project/mixer-settings-dialog";
import { PatchMatrix } from "@/components/project/patch-matrix";
import { StageboxOverview } from "@/components/project/stagebox-overview";
import { PortDataProvider } from "@/components/project/port-data-context";
import { ActiveMixerProvider, useActiveMixer } from "@/components/project/active-mixer-context";
import { MixerSelector } from "@/components/project/mixer-selector";
import { PDFExportDialog } from "@/components/project/pdf-export-dialog";
import { SnapshotPanel } from "@/components/project/snapshot-panel";
import { UndoRedoProvider, UndoRedoButtons } from "@/hooks/use-undo-redo";
import { ProjectAccessProvider } from "@/components/project/project-access-context";
import { CollaborationDialog } from "@/components/project/collaboration-dialog";
import { ProjectActivitySheet } from "@/components/project/project-activity-sheet";
import type { Project, Mixer } from "@/types/convex";

export default function ProjectPage() {
  const params = useParams();
  const projectId = params.id as Id<"projects">;
  const project = useQuery(api.projects.get, { projectId }) as Project | null | undefined;
  const claimPendingInvites = useMutation(api.collaboration.claimPendingInvites);

  useEffect(() => {
    void claimPendingInvites({});
  }, [claimPendingInvites]);

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

  const accessRole = project.accessRole ?? "owner";
  const readOnly = accessRole === "viewer" || accessRole === "share_viewer";

  return (
    <ProjectAccessProvider value={{ accessRole, readOnly }}>
      <PortDataProvider projectId={projectId}>
        <ActiveMixerProvider projectId={projectId}>
          <UndoRedoProvider>
            <ProjectPageContent project={project} projectId={projectId} readOnly={readOnly} />
          </UndoRedoProvider>
        </ActiveMixerProvider>
      </PortDataProvider>
    </ProjectAccessProvider>
  );
}

function ProjectPageContent({
  project,
  projectId,
  readOnly,
}: {
  project: Project;
  projectId: Id<"projects">;
  readOnly: boolean;
}) {
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);
  const [mixerSettingsOpen, setMixerSettingsOpen] = useState(false);
  const [settingsMixerId, setSettingsMixerId] = useState<Id<"mixers"> | null>(null);
  const [collaborationOpen, setCollaborationOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("patch-list");
  const { theme, setTheme } = useTheme();
  const { activeMixer, mixers } = useActiveMixer();
  const canManageCollaboration = project.accessRole === "owner" || project.accessRole === undefined;

  const handleOpenMixerSettings = (mixerId: Id<"mixers">) => {
    if (readOnly) return;
    setSettingsMixerId(mixerId);
    setMixerSettingsOpen(true);
  };

  const settingsMixer = settingsMixerId
    ? (mixers.find((m) => m._id === settingsMixerId) as Mixer | undefined)
    : activeMixer;

  return (
    <Tabs defaultValue="patch-list" value={activeTab} onValueChange={setActiveTab}>
      <div className="min-h-screen bg-background flex flex-col">
        <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto px-4 py-2.5 sm:py-3">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
                  <Link href="/dashboard" className="shrink-0">
                    <Image
                      src="/brand/betterpatchtool-logo-a-light.svg"
                      alt="BetterPatchTool"
                      width={210}
                      height={48}
                      priority
                      className="h-auto w-[150px] dark:hidden sm:w-[180px] md:w-[210px]"
                    />
                    <Image
                      src="/brand/betterpatchtool-logo-a-dark.svg"
                      alt="BetterPatchTool"
                      width={210}
                      height={48}
                      priority
                      className="hidden h-auto w-[150px] dark:block sm:w-[180px] md:w-[210px]"
                    />
                  </Link>
                  <div className="min-w-0 flex-1 border-t pt-3 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
                    <h1 className="truncate text-lg font-semibold">{project.title}</h1>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
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

                <div className="flex flex-wrap items-center justify-start gap-1 sm:gap-2 lg:max-w-[45%] lg:justify-end">
                  <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                    {!readOnly && <UndoRedoButtons />}
                    {!readOnly && (
                      <SnapshotPanel
                        projectId={projectId}
                        triggerClassName="h-10 px-3 sm:h-9"
                        onRestored={(name) => setRestoreMessage(`Projekt auf Savepoint "${name}" zurückgesetzt.`)}
                      />
                    )}
                    <MixerSelector onOpenSettings={handleOpenMixerSettings} />
                  </div>
                  <div className="ml-0 border-l pl-2 sm:ml-1 sm:pl-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-10 w-10 sm:h-9 sm:w-9">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setExportDialogOpen(true)}>
                          <Download className="mr-2 h-4 w-4" />
                          Export PDF
                        </DropdownMenuItem>
                        {canManageCollaboration && (
                          <DropdownMenuItem onClick={() => setCollaborationOpen(true)}>
                            <Users className="mr-2 h-4 w-4" />
                            Collaborators
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => setActivityOpen(true)}>
                          <History className="mr-2 h-4 w-4" />
                          Activity
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>
                            {theme === "dark" ? (
                              <Moon className="mr-2 h-4 w-4" />
                            ) : theme === "light" ? (
                              <Sun className="mr-2 h-4 w-4" />
                            ) : (
                              <Monitor className="mr-2 h-4 w-4" />
                            )}
                            Theme
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent>
                            <DropdownMenuItem onClick={() => setTheme("light")}>
                              <Sun className="mr-2 h-4 w-4" />
                              Light
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setTheme("dark")}>
                              <Moon className="mr-2 h-4 w-4" />
                              Dark
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setTheme("system")}>
                              <Monitor className="mr-2 h-4 w-4" />
                              System
                            </DropdownMenuItem>
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>

              <div className="relative">
                <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <TabsList className="h-auto min-w-max justify-start gap-1 p-1">
                    <TabsTrigger value="patch-list">Patch List</TabsTrigger>
                    <TabsTrigger value="matrix">Matrix</TabsTrigger>
                    <TabsTrigger value="stageboxes">Stageboxes</TabsTrigger>
                    {!readOnly && <TabsTrigger value="io-devices">Devices</TabsTrigger>}
                  </TabsList>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 container mx-auto px-4 py-3">
          {restoreMessage && (
            <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-900">
              {restoreMessage}
            </div>
          )}
          {readOnly && (
            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
              You have view-only access to this project.
            </div>
          )}

          <TabsContent value="patch-list" className="mt-0">
            <PatchList projectId={projectId} readOnly={readOnly} />
          </TabsContent>

          <TabsContent value="matrix" className="mt-0">
            <PatchMatrix projectId={projectId} />
          </TabsContent>

          <TabsContent value="stageboxes" className="mt-0">
            <StageboxOverview projectId={projectId} />
          </TabsContent>

          {!readOnly && (
            <TabsContent value="io-devices" className="mt-0">
              <IOOverview projectId={projectId} />
            </TabsContent>
          )}
        </main>

        <PDFExportDialog
          open={exportDialogOpen}
          onOpenChange={setExportDialogOpen}
          project={project}
          mixers={mixers}
          projectId={projectId}
        />

        {settingsMixer && !readOnly && (
          <MixerSettingsDialog
            projectId={projectId}
            mixer={settingsMixer}
            open={mixerSettingsOpen}
            onOpenChange={setMixerSettingsOpen}
          />
        )}

        {canManageCollaboration && (
          <CollaborationDialog
            projectId={projectId}
            open={collaborationOpen}
            onOpenChange={setCollaborationOpen}
          />
        )}
        <ProjectActivitySheet projectId={projectId} open={activityOpen} onOpenChange={setActivityOpen} />
      </div>
    </Tabs>
  );
}
