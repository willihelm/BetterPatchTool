"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BusConfigFields } from "@/components/shared/bus-config-fields";
import type { BusConfig } from "@/lib/bus-utils";

export function NewProjectContent() {
  const router = useRouter();
  const createProject = useMutation(api.projects.create);

  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [venue, setVenue] = useState("");
  const [channelCount, setChannelCount] = useState("48");
  const [busConfig, setBusConfig] = useState<BusConfig>({ auxes: 24 } as BusConfig);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) return;

    setIsLoading(true);
    try {
      const projectId = await createProject({
        title: title.trim(),
        date: date || undefined,
        venue: venue.trim() || undefined,
        channelCount: parseInt(channelCount) || 48,
        busConfig,
      });
      router.push(`/project/${projectId}`);
    } catch (error) {
      console.error("Error creating project:", error);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/dashboard" className="shrink-0">
            <Image
              src="/brand/betterpatchtool-logo-a-light.svg"
              alt="BetterPatchTool"
              width={140}
              height={32}
              priority
              className="dark:hidden"
            />
            <Image
              src="/brand/betterpatchtool-logo-a-dark.svg"
              alt="BetterPatchTool"
              width={140}
              height={32}
              priority
              className="hidden dark:block"
            />
          </Link>
          <div className="border-l pl-4">
            <h1 className="text-2xl font-bold">Create New Project</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Project Details</CardTitle>
            <CardDescription>
              Enter the basic information for your new project.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">Project Title *</Label>
                <Input
                  id="title"
                  placeholder="e.g. Rock am Ring 2025 - Main Stage"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="venue">Venue / Location</Label>
                <Input
                  id="venue"
                  placeholder="e.g. Nürburgring, Open-Air Stage"
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="channelCount">Input Channels</Label>
                <Input
                  id="channelCount"
                  type="number"
                  min="1"
                  max="256"
                  value={channelCount}
                  onChange={(e) => setChannelCount(e.target.value)}
                  placeholder="48"
                />
              </div>
              <BusConfigFields value={busConfig} onChange={setBusConfig} />
              <p className="text-sm text-muted-foreground -mt-4">
                Channel and bus counts can be changed later.
              </p>

              <div className="flex gap-4 pt-4">
                <Button type="submit" disabled={isLoading || !title.trim()}>
                  {isLoading ? "Creating..." : "Create Project"}
                </Button>
                <Button type="button" variant="outline" asChild>
                  <Link href="/dashboard">Cancel</Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
