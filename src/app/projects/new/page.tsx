"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import Link from "next/link";
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
import { ArrowLeft } from "lucide-react";

// Temporary demo user ID until Clerk is set up
const DEMO_USER_ID = "demo-user-123";

export default function NewProjectPage() {
  const router = useRouter();
  const createProject = useMutation(api.projects.create);

  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [venue, setVenue] = useState("");
  const [channelCount, setChannelCount] = useState("48");
  const [outputChannelCount, setOutputChannelCount] = useState("24");
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
        ownerId: DEMO_USER_ID,
        channelCount: parseInt(channelCount) || 48,
        outputChannelCount: parseInt(outputChannelCount) || 24,
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
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" asChild className="mb-2">
            <Link href="/dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">Create New Project</h1>
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

              <div className="grid grid-cols-2 gap-4">
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
                <div className="space-y-2">
                  <Label htmlFor="outputChannelCount">Output Channels</Label>
                  <Input
                    id="outputChannelCount"
                    type="number"
                    min="1"
                    max="256"
                    value={outputChannelCount}
                    onChange={(e) => setOutputChannelCount(e.target.value)}
                    placeholder="24"
                  />
                </div>
              </div>
              <p className="text-sm text-muted-foreground -mt-4">
                Number of channels to create (can be changed later)
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
