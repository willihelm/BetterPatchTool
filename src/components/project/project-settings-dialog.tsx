"use client";

import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Project } from "@/types/convex";

interface ProjectSettingsDialogProps {
  project: Project;
  projectId: Id<"projects">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProjectSettingsDialog({
  project,
  projectId,
  open,
  onOpenChange,
}: ProjectSettingsDialogProps) {
  const updateProject = useMutation(api.projects.update);
  const [title, setTitle] = useState(project.title);
  const [date, setDate] = useState(project.date ?? "");
  const [venue, setVenue] = useState(project.venue ?? "");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(project.title);
    setDate(project.date ?? "");
    setVenue(project.venue ?? "");
  }, [open, project.title, project.date, project.venue]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    setIsSaving(true);
    try {
      await updateProject({
        projectId,
        title: trimmedTitle,
        date: date || "",
        venue: venue.trim(),
      });
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating project:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Project Settings</DialogTitle>
            <DialogDescription>
              Update the project name, date, and venue.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="project-title">Project Name</Label>
              <Input
                id="project-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Project name"
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="project-date">Date</Label>
              <Input
                id="project-date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="project-venue">Venue / Location</Label>
              <Input
                id="project-venue"
                value={venue}
                onChange={(event) => setVenue(event.target.value)}
                placeholder="Venue or location"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving || !title.trim()}>
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
