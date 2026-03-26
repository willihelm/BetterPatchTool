"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PatchList } from "@/components/project/patch-list";
import { StageboxOverview } from "@/components/project/stagebox-overview";
import { PortDataProvider } from "@/components/project/port-data-context";
import { ActiveMixerProvider } from "@/components/project/active-mixer-context";
import { ProjectAccessProvider } from "@/components/project/project-access-context";
import { ProjectPresenceStrip } from "@/components/project/project-presence-strip";
import { UndoRedoProvider } from "@/hooks/use-undo-redo";
import type { Project } from "@/types/convex";

export default function SharedProjectPage() {
  const params = useParams();
  const token = params.token as string;
  const resolved = useQuery(api.collaboration.resolveShareLink, { token }) as
    | { project: Project; shareLink: { _id: string; label: string; createdAt: number } }
    | null
    | undefined;
  const [activeTab, setActiveTab] = useState("patch-list");

  if (resolved === undefined) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading shared project...</div>;
  }
  if (resolved === null) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">This share link is invalid or revoked.</div>;
  }

  const projectId = resolved.project._id as Id<"projects">;

  return (
    <ProjectAccessProvider value={{ accessRole: "share_viewer", readOnly: true, accessToken: token }}>
      <PortDataProvider projectId={projectId} accessToken={token}>
        <ActiveMixerProvider projectId={projectId} accessToken={token}>
          <UndoRedoProvider>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <div className="min-h-screen bg-background flex flex-col">
                <header className="border-b bg-background px-4 py-4">
                  <h1 className="text-xl font-semibold">{resolved.project.title}</h1>
                  <p className="text-sm text-muted-foreground">
                    Public read-only share link
                  </p>
                  <div className="mt-2">
                    <ProjectPresenceStrip projectId={projectId} activeArea={activeTab} />
                  </div>
                  <TabsList className="mt-4">
                    <TabsTrigger value="patch-list">Patch List</TabsTrigger>
                    <TabsTrigger value="stageboxes">Stageboxes</TabsTrigger>
                  </TabsList>
                </header>

                <main className="container mx-auto flex-1 px-4 py-4">
                  <TabsContent value="patch-list" className="mt-0">
                    <PatchList projectId={projectId} accessToken={token} readOnly />
                  </TabsContent>
                  <TabsContent value="stageboxes" className="mt-0">
                    <StageboxOverview projectId={projectId} accessToken={token} />
                  </TabsContent>
                </main>
              </div>
            </Tabs>
          </UndoRedoProvider>
        </ActiveMixerProvider>
      </PortDataProvider>
    </ProjectAccessProvider>
  );
}
