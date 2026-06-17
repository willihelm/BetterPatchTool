"use client";

import * as React from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, MoreVertical, Calendar, MapPin, Copy, Archive, Settings } from "lucide-react";
import { formatDistanceToNow } from "@/lib/date-utils";
import type { Project } from "@/types/convex";
import { AppHeader } from "@/components/shared/app-header";
import { ProjectSettingsDialog } from "@/components/project/project-settings-dialog";

export function DashboardContent() {
  const projects = useQuery(api.projects.list, {}) as Project[] | undefined;
  const archiveProject = useMutation(api.projects.archive);
  const duplicateProject = useMutation(api.projects.duplicate);
  const claimPendingInvites = useMutation(api.collaboration.claimPendingInvites);
  const [projectSettingsOpen, setProjectSettingsOpen] = React.useState(false);
  const [editingProject, setEditingProject] = React.useState<Project | null>(null);

  React.useEffect(() => {
    void claimPendingInvites({});
  }, [claimPendingInvites]);

  const ownedProjects = projects?.filter((project) => project.isOwned) ?? [];
  const sharedProjects = projects?.filter((project) => !project.isOwned) ?? [];

  const handleArchive = async (projectId: string) => {
    await archiveProject({ projectId: projectId as Id<"projects"> });
  };

  const handleDuplicate = async (projectId: string, title: string) => {
    await duplicateProject({
      projectId: projectId as Id<"projects">,
      newTitle: `${title} (Copy)`,
    });
  };

  const handleOpenSettings = (project: Project) => {
    setEditingProject(project);
    setProjectSettingsOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        actions={
          <Button asChild>
            <Link href="/projects/new">
              <Plus className="mr-2 h-4 w-4" />
              New Project
            </Link>
          </Button>
        }
      />

      <main className="container mx-auto px-4 py-8">
        <section>
          <h2 className="text-xl font-semibold mb-4">Projects</h2>

          {projects === undefined ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-5 bg-muted rounded w-3/4" />
                    <div className="h-4 bg-muted rounded w-1/2 mt-2" />
                  </CardHeader>
                </Card>
              ))}
            </div>
          ) : projects.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground mb-4">
                  No projects yet.
                </p>
                <Button asChild>
                  <Link href="/projects/new">
                    <Plus className="mr-2 h-4 w-4" />
                    Create First Project
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-8">
              <section>
                <h3 className="mb-4 text-lg font-medium">Owned</h3>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {ownedProjects.map((project) => (
                    <ProjectCard
                      key={project._id}
                      project={project}
                      onArchive={handleArchive}
                      onDuplicate={handleDuplicate}
                      onOpenSettings={handleOpenSettings}
                    />
                  ))}
                </div>
              </section>

              {sharedProjects.length > 0 && (
                <section>
                  <h3 className="mb-4 text-lg font-medium">Shared With Me</h3>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {sharedProjects.map((project) => (
                      <ProjectCard
                        key={project._id}
                        project={project}
                        onArchive={handleArchive}
                        onDuplicate={handleDuplicate}
                        onOpenSettings={handleOpenSettings}
                        shared
                      />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </section>

        {editingProject && (
          <ProjectSettingsDialog
            project={editingProject}
            projectId={editingProject._id}
            open={projectSettingsOpen}
            onOpenChange={setProjectSettingsOpen}
          />
        )}
      </main>
    </div>
  );
}

function ProjectCard({
  project,
  onArchive,
  onDuplicate,
  onOpenSettings,
  shared = false,
}: {
  project: Project;
  onArchive: (projectId: string) => void;
  onDuplicate: (projectId: string, title: string) => void;
  onOpenSettings: (project: Project) => void;
  shared?: boolean;
}) {
  return (
    <Card className="group hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <Link href={`/project/${project._id}`} className="flex-1">
            <CardTitle className="text-lg hover:underline">{project.title}</CardTitle>
          </Link>
          {!shared && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onOpenSettings(project)}>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDuplicate(project._id, project.title)}>
                  <Copy className="mr-2 h-4 w-4" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onArchive(project._id)} className="text-destructive">
                  <Archive className="mr-2 h-4 w-4" />
                  Archive
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        <CardDescription className="flex flex-col gap-1 mt-2">
          {project.date && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {project.date}
            </span>
          )}
          {project.venue && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {project.venue}
            </span>
          )}
          {shared && <span className="text-xs uppercase tracking-wide">Role: {project.accessRole}</span>}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-xs text-muted-foreground">Created {formatDistanceToNow(project._creationTime)}</p>
      </CardContent>
    </Card>
  );
}
