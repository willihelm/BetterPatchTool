"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDistanceToNow } from "@/lib/date-utils";
import {
  diffConfigById,
  diffRows,
  type DiffStatus,
  type RowDiff,
} from "@/lib/snapshot-diff";
import type {
  Group,
  IODevice,
  IOPort,
  InputChannel,
  Mixer,
  OutputChannel,
  ProjectSnapshotPayload,
} from "@/types/convex";

type DiffFilter = "all" | "changed" | DiffStatus;

interface SnapshotDiffDialogProps {
  projectId: Id<"projects">;
  snapshotId: Id<"projectSnapshots"> | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function StatusBadge({ status }: { status: DiffStatus }) {
  const styles =
    status === "added"
      ? "bg-emerald-100 text-emerald-800"
      : status === "removed"
      ? "bg-rose-100 text-rose-800"
      : "bg-amber-100 text-amber-800";
  return (
    <Badge className={styles} variant="secondary">
      {status}
    </Badge>
  );
}

function FilterBar({
  value,
  onChange,
}: {
  value: DiffFilter;
  onChange: (value: DiffFilter) => void;
}) {
  const options: { label: string; value: DiffFilter }[] = [
    { label: "All", value: "all" },
    { label: "Changed", value: "changed" },
    { label: "Added", value: "added" },
    { label: "Removed", value: "removed" },
    { label: "Modified", value: "modified" },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <Button
          key={option.value}
          variant={value === option.value ? "default" : "outline"}
          size="sm"
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}

function filterDiffs(diffs: RowDiff[], filter: DiffFilter) {
  if (filter === "all") return diffs;
  if (filter === "changed") {
    return diffs.filter((diff) => diff.status !== "modified" || diff.changedFields?.length);
  }
  return diffs.filter((diff) => diff.status === filter);
}

function InputOutputTable({
  diffs,
  filter,
}: {
  diffs: RowDiff[];
  filter: DiffFilter;
}) {
  const filtered = filterDiffs(diffs, filter);

  if (filtered.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-6 text-center">
        No changes found.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-20">Order</TableHead>
          <TableHead className="w-28">Status</TableHead>
          <TableHead>Label</TableHead>
          <TableHead>Changed Fields</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filtered.map((diff) => (
          <TableRow key={`${diff.order}-${diff.status}`}>
            <TableCell>{diff.order}</TableCell>
            <TableCell>
              <StatusBadge status={diff.status} />
            </TableCell>
            <TableCell>{diff.label}</TableCell>
            <TableCell className="text-muted-foreground">
              {diff.changedFields?.length
                ? diff.changedFields.join(", ")
                : diff.status === "modified"
                ? "Modified"
                : "-"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function SnapshotDiffDialog({
  projectId,
  snapshotId,
  open,
  onOpenChange,
}: SnapshotDiffDialogProps) {
  const snapshotResult = useQuery(
    api.snapshots.get,
    snapshotId ? { snapshotId } : undefined
  ) as
    | {
        snapshot: {
          _id: string;
          name: string;
          createdAt: number;
        };
        payload: ProjectSnapshotPayload;
      }
    | null
    | undefined;

  const inputChannels = useQuery(api.inputChannels.list, { projectId }) as
    | InputChannel[]
    | undefined;
  const outputChannels = useQuery(api.outputChannels.list, { projectId }) as
    | OutputChannel[]
    | undefined;
  const mixers = useQuery(api.mixers.list, { projectId }) as
    | Mixer[]
    | undefined;
  const groups = useQuery(api.groups.list, { projectId }) as Group[] | undefined;
  const ioDevices = useQuery(api.ioDevices.listWithPorts, { projectId }) as
    | (IODevice & {
        inputPorts: IOPort[];
        outputPorts: IOPort[];
        headphonePorts: IOPort[];
        aesInputPorts: IOPort[];
        aesOutputPorts: IOPort[];
      })[]
    | undefined;

  const [inputFilter, setInputFilter] = useState<DiffFilter>("all");
  const [outputFilter, setOutputFilter] = useState<DiffFilter>("all");

  const { inputDiffs, outputDiffs, configDiffs } = useMemo(() => {
    if (!snapshotResult || !inputChannels || !outputChannels || !mixers || !ioDevices || !groups) {
      return {
        inputDiffs: [] as RowDiff[],
        outputDiffs: [] as RowDiff[],
        configDiffs: null as null | {
          mixers: ReturnType<typeof diffConfigById>;
          ioDevices: ReturnType<typeof diffConfigById>;
          ioPorts: ReturnType<typeof diffConfigById>;
          groups: ReturnType<typeof diffConfigById>;
        },
      };
    }

    const snapshotPayload = snapshotResult.payload;
    const snapshotInputs = snapshotPayload.inputChannels ?? [];
    const snapshotOutputs = snapshotPayload.outputChannels ?? [];

    const currentInputs = [...inputChannels].sort((a, b) => a.order - b.order);
    const currentOutputs = [...outputChannels].sort((a, b) => a.order - b.order);

    const inputDiffs = diffRows(snapshotInputs, currentInputs, {
      label: (row) =>
        `Ch ${row.channelNumber ?? row.order}: ${row.source || "(empty)"}`,
    });

    const outputDiffs = diffRows(snapshotOutputs, currentOutputs, {
      label: (row) =>
        `Bus ${row.busName || row.order}: ${row.destination || "(empty)"}`,
    });

    const currentPorts = ioDevices.flatMap((device) => [
      ...device.inputPorts,
      ...device.outputPorts,
      ...device.headphonePorts,
      ...device.aesInputPorts,
      ...device.aesOutputPorts,
    ]);

    const currentIoDevices = ioDevices.map(
      ({ inputPorts, outputPorts, headphonePorts, aesInputPorts, aesOutputPorts, ...device }) =>
        device
    );

    const configDiffs = {
      mixers: diffConfigById(snapshotPayload.mixers ?? [], mixers),
      ioDevices: diffConfigById(snapshotPayload.ioDevices ?? [], currentIoDevices),
      ioPorts: diffConfigById(snapshotPayload.ioPorts ?? [], currentPorts),
      groups: diffConfigById(snapshotPayload.groups ?? [], groups),
    };

    return { inputDiffs, outputDiffs, configDiffs };
  }, [snapshotResult, inputChannels, outputChannels, mixers, ioDevices, groups]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>
            {snapshotResult?.snapshot
              ? `Diff since "${snapshotResult.snapshot.name}"`
              : "Diff View"}
          </DialogTitle>
          {snapshotResult?.snapshot && (
            <div className="text-sm text-muted-foreground">
              Created {formatDistanceToNow(snapshotResult.snapshot.createdAt)}
            </div>
          )}
        </DialogHeader>

        {!snapshotResult ? (
          <div className="py-8 text-center text-muted-foreground">Loading diff...</div>
        ) : (
          <Tabs defaultValue="inputs" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="inputs">Inputs</TabsTrigger>
              <TabsTrigger value="outputs">Outputs</TabsTrigger>
              <TabsTrigger value="config">Configuration</TabsTrigger>
            </TabsList>

            <TabsContent value="inputs" className="space-y-4">
              <FilterBar value={inputFilter} onChange={setInputFilter} />
              <InputOutputTable diffs={inputDiffs} filter={inputFilter} />
            </TabsContent>

            <TabsContent value="outputs" className="space-y-4">
              <FilterBar value={outputFilter} onChange={setOutputFilter} />
              <InputOutputTable diffs={outputDiffs} filter={outputFilter} />
            </TabsContent>

            <TabsContent value="config" className="space-y-4">
              {!configDiffs ? (
                <div className="py-8 text-center text-muted-foreground">
                  Loading configuration diff...
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-sm text-muted-foreground">
                    Added, removed, and modified counts per configuration section.
                  </div>
                  <Separator />
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Section</TableHead>
                        <TableHead>Added</TableHead>
                        <TableHead>Removed</TableHead>
                        <TableHead>Modified</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[
                        ["Mixers", configDiffs.mixers],
                        ["IO Devices", configDiffs.ioDevices],
                        ["IO Ports", configDiffs.ioPorts],
                        ["Groups", configDiffs.groups],
                      ].map(([label, diff]) => (
                        <TableRow key={label as string}>
                          <TableCell>{label}</TableCell>
                          <TableCell>{diff.added}</TableCell>
                          <TableCell>{diff.removed}</TableCell>
                          <TableCell>{diff.modified}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
