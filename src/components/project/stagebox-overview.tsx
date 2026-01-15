"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Box, ArrowRight, ArrowLeft } from "lucide-react";
import type { Stagebox } from "@/types/convex";

interface StageboxOverviewProps {
  projectId: Id<"projects">;
}

const PRESET_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
];

export function StageboxOverview({ projectId }: StageboxOverviewProps) {
  const stageboxes = useQuery(api.stageboxes.list, { projectId }) as Stagebox[] | undefined;
  const createStagebox = useMutation(api.stageboxes.create);
  const removeStagebox = useMutation(api.stageboxes.remove);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newStagebox, setNewStagebox] = useState({
    name: "",
    shortName: "",
    color: PRESET_COLORS[0],
    inputCount: 32,
    outputCount: 16,
  });

  const handleCreate = async () => {
    if (!newStagebox.name || !newStagebox.shortName) return;

    await createStagebox({
      projectId,
      name: newStagebox.name,
      shortName: newStagebox.shortName,
      color: newStagebox.color,
      inputCount: newStagebox.inputCount,
      outputCount: newStagebox.outputCount,
    });

    setNewStagebox({
      name: "",
      shortName: "",
      color: PRESET_COLORS[(PRESET_COLORS.indexOf(newStagebox.color) + 1) % PRESET_COLORS.length],
      inputCount: 32,
      outputCount: 16,
    });
    setIsDialogOpen(false);
  };

  if (stageboxes === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-pulse text-muted-foreground">Loading stageboxes...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">
          Stageboxes ({stageboxes.length})
        </h3>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Stagebox
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Stagebox</DialogTitle>
              <DialogDescription>
                Add a new stagebox to the project.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="sb-name">Name</Label>
                <Input
                  id="sb-name"
                  placeholder="e.g. Stage Left"
                  value={newStagebox.name}
                  onChange={(e) =>
                    setNewStagebox({ ...newStagebox, name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sb-short">Short Name (for port prefix)</Label>
                <Input
                  id="sb-short"
                  placeholder="e.g. SL"
                  value={newStagebox.shortName}
                  onChange={(e) =>
                    setNewStagebox({ ...newStagebox, shortName: e.target.value.toUpperCase() })
                  }
                  maxLength={4}
                />
                <p className="text-xs text-muted-foreground">
                  Ports will be named as {newStagebox.shortName || "XX"}-I1, {newStagebox.shortName || "XX"}-O1, etc.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex gap-2 flex-wrap">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        newStagebox.color === color
                          ? "border-foreground scale-110"
                          : "border-transparent"
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() => setNewStagebox({ ...newStagebox, color })}
                    />
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sb-inputs">Number of Inputs</Label>
                  <Input
                    id="sb-inputs"
                    type="number"
                    min={1}
                    max={96}
                    value={newStagebox.inputCount}
                    onChange={(e) =>
                      setNewStagebox({
                        ...newStagebox,
                        inputCount: parseInt(e.target.value) || 1,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sb-outputs">Number of Outputs</Label>
                  <Input
                    id="sb-outputs"
                    type="number"
                    min={1}
                    max={96}
                    value={newStagebox.outputCount}
                    onChange={(e) =>
                      setNewStagebox({
                        ...newStagebox,
                        outputCount: parseInt(e.target.value) || 1,
                      })
                    }
                  />
                </div>
              </div>
              <Button
                onClick={handleCreate}
                className="w-full"
                disabled={!newStagebox.name || !newStagebox.shortName}
              >
                Create Stagebox
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {stageboxes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Box className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground mb-4">
              No stageboxes configured yet.
            </p>
            <Button onClick={() => setIsDialogOpen(true)} variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              Add First Stagebox
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {stageboxes.map((stagebox) => (
            <Card key={stagebox._id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: stagebox.color }}
                    />
                    <CardTitle className="text-base">{stagebox.name}</CardTitle>
                  </div>
                  <Badge variant="outline">{stagebox.shortName}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
                  <div className="flex items-center gap-1">
                    <ArrowRight className="h-4 w-4" />
                    <span>{stagebox.inputCount} Inputs</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <ArrowLeft className="h-4 w-4" />
                    <span>{stagebox.outputCount} Outputs</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full"
                    onClick={() => removeStagebox({ stageboxId: stagebox._id })}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
