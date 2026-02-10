"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
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
import { Plus, MoreVertical, Calendar, MapPin, Copy, Archive, Settings2, Mic2 } from "lucide-react";
import { ThemeSwitcher } from "@/components/ui/theme-switcher";
import { formatDistanceToNow } from "@/lib/date-utils";
import type { Project } from "@/types/convex";

// Temporary demo user ID until Clerk is set up
const DEMO_USER_ID = "demo-user-123";

export default function DashboardPage() {
  const projects = useQuery(api.projects.list, { ownerId: DEMO_USER_ID }) as Project[] | undefined;
  const archiveProject = useMutation(api.projects.archive);
  const duplicateProject = useMutation(api.projects.duplicate);

  const handleArchive = async (projectId: string) => {
    await archiveProject({ projectId: projectId as any });
  };

  const handleDuplicate = async (projectId: string, title: string) => {
    await duplicateProject({
      projectId: projectId as any,
      newTitle: `${title} (Copy)`,
      ownerId: DEMO_USER_ID,
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-primary/20 rounded-full flex items-center justify-center border border-primary/50 shadow-[0_0_10px_rgba(0,222,255,0.2)]">
              <Mic2 className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight uppercase">BetterPatchTool</h1>
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                <p className="text-[10px] text-muted-foreground font-mono tracking-widest uppercase">System Online</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ThemeSwitcher />
            <Button asChild variant="neon" size="sm" className="shadow-[0_0_10px_rgba(0,222,255,0.2)]">
              <Link href="/projects/new">
                <Plus className="mr-2 h-4 w-4" />
                NEW PROJECT
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <section>
          <div className="flex items-center justify-between mb-6 border-b border-border/50 pb-2">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <span className="w-1 h-4 bg-primary inline-block rounded-full shadow-[0_0_5px_var(--primary)]"></span>
              My Projects
            </h2>
            <div className="text-xs font-mono text-muted-foreground">
              {projects?.length || 0} ACTIVE SESSIONS
            </div>
          </div>

          {projects === undefined ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse h-[180px] border-dashed border-2 bg-transparent">
                  <CardHeader>
                    <div className="h-4 bg-muted/50 rounded w-1/2 mb-2" />
                    <div className="h-3 bg-muted/30 rounded w-3/4" />
                  </CardHeader>
                </Card>
              ))}
            </div>
          ) : projects.length === 0 ? (
              <Card className="border-dashed border-2 bg-transparent hover:bg-muted/10 transition-colors cursor-pointer group">
                <CardContent className="py-16 text-center flex flex-col items-center justify-center">
                  <div className="h-12 w-12 rounded-full bg-muted/20 flex items-center justify-center mb-4 group-hover:bg-primary/20 group-hover:text-primary transition-colors">
                    <Plus className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-medium mb-1">Empty Rack</h3>
                  <p className="text-sm text-muted-foreground mb-6 max-w-[250px]">
                    Start by creating a new patch project for your event.
                </p>
                  <Button asChild variant="outline">
                    <Link href="/projects/new">
                    Create First Project
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {projects.map((project) => (
                <Card key={project._id} className="group hover:border-primary/50 transition-all hover:shadow-[0_0_15px_rgba(0,222,255,0.1)] relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-primary/0 group-hover:bg-primary transition-all duration-300" />
                  <CardHeader className="pb-3 pl-7">
                    <div className="flex items-start justify-between">
                      <Link href={`/project/${project._id}`} className="flex-1 min-w-0">
                        <CardTitle className="text-lg font-bold truncate pr-2 group-hover:text-primary transition-colors">
                          {project.title}
                        </CardTitle>
                      </Link>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity -mr-2"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem
                            onClick={() => handleDuplicate(project._id, project.title)}
                            className="text-xs"
                          >
                            <Copy className="mr-2 h-3.5 w-3.5" />
                            DUPLICATE
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleArchive(project._id)}
                            className="text-destructive text-xs"
                          >
                            <Archive className="mr-2 h-3.5 w-3.5" />
                            ARCHIVE
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <CardDescription className="flex flex-col gap-1.5 mt-3 font-mono text-xs">
                      {project.date && (
                        <span className="flex items-center gap-2">
                          <Calendar className="h-3 w-3 text-primary/70" />
                          {project.date}
                        </span>
                      )}
                      {project.venue && (
                        <span className="flex items-center gap-2">
                          <MapPin className="h-3 w-3 text-primary/70" />
                          {project.venue}
                        </span>
                      )}
                      {!project.date && !project.venue && (
                        <span className="flex items-center gap-2 text-muted-foreground/50">
                          <Settings2 className="h-3 w-3" />
                          Not configured
                        </span>
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-2 pl-7 flex items-center justify-between border-t border-border/30 mt-2 bg-muted/20">
                    <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
                      ID: {project._id.slice(-6)}
                    </p>
                    <p className="text-[10px] text-muted-foreground font-mono">
                      {formatDistanceToNow(project._creationTime)}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
