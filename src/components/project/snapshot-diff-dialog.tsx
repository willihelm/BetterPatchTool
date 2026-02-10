"use client";

import { Fragment, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  diffFields,
  diffItemsById,
  diffRows,
  type DiffStatus,
  type ItemDiff,
} from "@/lib/snapshot-diff";
import type {
  Group,
  IODevice,
  IOPort,
  InputChannel,
  Mixer,
  OutputChannel,
  Project,
  ProjectSnapshotPayload,
} from "@/types/convex";

type FieldSpec<T> = {
  key: keyof T;
  label: string;
  format?: (value: unknown) => string;
};

type SideBySideRow = {
  type: "header" | "line";
  left: string;
  right: string;
};

type SideBySideDiff<T> = {
  status: DiffStatus;
  label: string;
  changedFields?: string[];
  before?: T;
  after?: T;
};

type DiffCounts = {
  added: number;
  removed: number;
  modified: number;
};

interface SnapshotDiffDialogProps {
  projectId: Id<"projects">;
  snapshotId: Id<"projectSnapshots"> | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function isMeaningful(value: unknown) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") {
    return Object.keys(value as Record<string, unknown>).length > 0;
  }
  return true;
}

function formatFallback(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value.trim() === "" ? "—" : value;
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return Number.isNaN(value) ? "—" : String(value);
  if (Array.isArray(value)) {
    return value.length > 0 ? value.map((entry) => formatFallback(entry)).join(", ") : "—";
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function buildSideBySideRows<T extends Record<string, any>>(
  diffs: SideBySideDiff<T>[],
  fields: FieldSpec<T>[],
  options?: { sortByLabel?: boolean }
): SideBySideRow[] {
  const rows: SideBySideRow[] = [];
  const sortedDiffs = options?.sortByLabel
    ? [...diffs].sort((a, b) => a.label.localeCompare(b.label))
    : diffs;

  const formatValue = (value: unknown, formatter?: (value: unknown) => string) =>
    formatter ? formatter(value) : formatFallback(value);

  for (const diff of sortedDiffs) {
    const startIndex = rows.length;
    rows.push({
      type: "header",
      left: `${diff.label} • ${diff.status}`,
      right: "",
    });

    if (diff.status === "added" || diff.status === "removed") {
      const source = diff.status === "added" ? diff.after : diff.before;
      if (source) {
        for (const field of fields) {
          const rawValue = source[field.key];
          if (!isMeaningful(rawValue)) continue;
          const text = `${field.label}: ${formatValue(rawValue, field.format)}`;
          rows.push({
            type: "line",
            left: diff.status === "removed" ? `- ${text}` : "",
            right: diff.status === "added" ? `+ ${text}` : "",
          });
        }
      }
    } else {
      const changedFields =
        diff.changedFields ??
        (diff.before && diff.after ? diffFields(diff.before, diff.after) : []);
      const changed = new Set(changedFields);
      for (const field of fields) {
        if (!changed.has(String(field.key))) continue;
        const beforeValue = diff.before ? diff.before[field.key] : undefined;
        const afterValue = diff.after ? diff.after[field.key] : undefined;
        const beforeText = formatValue(beforeValue, field.format);
        const afterText = formatValue(afterValue, field.format);
        if (beforeText === afterText) continue;
        rows.push({
          type: "line",
          left: `- ${field.label}: ${beforeText}`,
          right: `+ ${field.label}: ${afterText}`,
        });
      }
    }

    if (rows.length === startIndex + 1) {
      rows.pop();
    }
  }

  return rows;
}

function SideBySideDiffBlock({ rows }: { rows: SideBySideRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-6 text-center">
        No changes found.
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <div className="grid grid-cols-2 gap-x-6 gap-y-1">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
          Savepoint
        </div>
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
          Current
        </div>
        {rows.map((row, index) =>
          row.type === "header" ? (
            <div
              key={`header-${index}`}
              className="col-span-2 pt-3 text-sm font-semibold text-foreground"
            >
              {row.left}
            </div>
          ) : (
            <Fragment key={`line-${index}`}>
              <div
                className={
                  row.left
                    ? "font-mono text-xs whitespace-pre-wrap text-rose-700 dark:text-rose-300"
                    : "text-xs whitespace-pre-wrap text-muted-foreground"
                }
              >
                {row.left}
              </div>
              <div
                className={
                  row.right
                    ? "font-mono text-xs whitespace-pre-wrap text-emerald-700 dark:text-emerald-300"
                    : "text-xs whitespace-pre-wrap text-muted-foreground"
                }
              >
                {row.right}
              </div>
            </Fragment>
          )
        )}
      </div>
    </div>
  );
}

function countDiffs(diffs: Array<{ status: DiffStatus }>): DiffCounts {
  return diffs.reduce(
    (acc, diff) => {
      if (diff.status === "added") acc.added += 1;
      if (diff.status === "removed") acc.removed += 1;
      if (diff.status === "modified") acc.modified += 1;
      return acc;
    },
    { added: 0, removed: 0, modified: 0 }
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
    open && snapshotId ? { snapshotId } : "skip"
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
  const project = useQuery(api.projects.get, { projectId }) as
    | Project
    | null
    | undefined;
  const ioDevices = useQuery(api.ioDevices.listWithPorts, { projectId }) as
    | (IODevice & {
        inputPorts: IOPort[];
        outputPorts: IOPort[];
        headphonePorts: IOPort[];
        aesInputPorts: IOPort[];
        aesOutputPorts: IOPort[];
      })[]
    | undefined;

  const diffData = useMemo(() => {
    if (
      !snapshotResult ||
      !inputChannels ||
      !outputChannels ||
      !mixers ||
      !ioDevices ||
      !groups ||
      !project
    ) {
      return null;
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

    const mixerLabelById = new Map<string, string>();
    const addMixerLabel = (mixer: Mixer) => {
      mixerLabelById.set(mixer._id, mixer.name || mixer.designation || "Mixer");
    };
    (snapshotPayload.mixers ?? []).forEach(addMixerLabel);
    mixers.forEach(addMixerLabel);

    const groupLabelById = new Map<string, string>();
    const addGroupLabel = (group: Group) => {
      const fallback = group.order ? `Group ${group.order}` : "Group";
      groupLabelById.set(group._id, group.name || fallback);
    };
    (snapshotPayload.groups ?? []).forEach(addGroupLabel);
    groups.forEach(addGroupLabel);

    const ioDeviceLabelById = new Map<string, string>();
    const addDeviceLabel = (device: IODevice) => {
      ioDeviceLabelById.set(device._id, device.shortName || device.name || device._id);
    };
    (snapshotPayload.ioDevices ?? []).forEach(addDeviceLabel);
    currentIoDevices.forEach(addDeviceLabel);

    const portLabelById = new Map<string, string>();
    const addPortLabel = (port: IOPort) => {
      const deviceLabel = ioDeviceLabelById.get(port.ioDeviceId);
      const baseLabel = port.label || `Port ${port.portNumber}`;
      const combined = deviceLabel ? `${deviceLabel} ${baseLabel}` : baseLabel;
      portLabelById.set(port._id, combined.trim());
    };
    (snapshotPayload.ioPorts ?? []).forEach(addPortLabel);
    currentPorts.forEach(addPortLabel);

    const formatLookup = (value: unknown, map: Map<string, string>) => {
      if (value === null || value === undefined || value === "") return "—";
      const key = String(value);
      return map.get(key) ?? key;
    };

    const formatBoolean = (value: unknown) => {
      if (value === null || value === undefined) return "—";
      if (typeof value === "boolean") return value ? "true" : "false";
      return formatFallback(value);
    };

    const formatPosition = (value: unknown) => {
      if (!value || typeof value !== "object") return formatFallback(value);
      const { x, y } = value as { x?: number; y?: number };
      if (typeof x === "number" && typeof y === "number") {
        return `x: ${x}, y: ${y}`;
      }
      return formatFallback(value);
    };

    const projectFields: FieldSpec<ProjectSnapshotPayload["project"]>[] = [
      { key: "title", label: "Title" },
      { key: "date", label: "Date" },
      { key: "venue", label: "Venue" },
    ];

    const inputFields: FieldSpec<InputChannel>[] = [
      { key: "channelNumber", label: "Channel" },
      { key: "source", label: "Source" },
      { key: "sourceRight", label: "Source R" },
      { key: "mixerId", label: "Mixer", format: (value) => formatLookup(value, mixerLabelById) },
      { key: "ioPortId", label: "Port", format: (value) => formatLookup(value, portLabelById) },
      { key: "ioPortIdRight", label: "Port R", format: (value) => formatLookup(value, portLabelById) },
      { key: "isStereo", label: "Stereo", format: formatBoolean },
      { key: "uhf", label: "UHF" },
      { key: "micInputDev", label: "Mic Input" },
      { key: "patched", label: "Patched", format: formatBoolean },
      { key: "location", label: "Location" },
      { key: "cable", label: "Cable" },
      { key: "stand", label: "Stand" },
      { key: "notes", label: "Notes" },
      { key: "groupId", label: "Group", format: (value) => formatLookup(value, groupLabelById) },
    ];

    const outputFields: FieldSpec<OutputChannel>[] = [
      { key: "busName", label: "Bus" },
      { key: "destination", label: "Destination" },
      { key: "destinationRight", label: "Destination R" },
      { key: "mixerId", label: "Mixer", format: (value) => formatLookup(value, mixerLabelById) },
      { key: "ioPortId", label: "Port", format: (value) => formatLookup(value, portLabelById) },
      { key: "ioPortIdRight", label: "Port R", format: (value) => formatLookup(value, portLabelById) },
      { key: "isStereo", label: "Stereo", format: formatBoolean },
      { key: "ampProcessor", label: "Amp/Processor" },
      { key: "location", label: "Location" },
      { key: "cable", label: "Cable" },
      { key: "notes", label: "Notes" },
    ];

    const mixerFields: FieldSpec<Mixer>[] = [
      { key: "name", label: "Name" },
      { key: "type", label: "Type" },
      { key: "stereoMode", label: "Stereo Mode" },
      { key: "channelCount", label: "Channel Count" },
      { key: "designation", label: "Designation" },
    ];

    const ioDeviceFields: FieldSpec<IODevice>[] = [
      { key: "name", label: "Name" },
      { key: "shortName", label: "Short Name" },
      { key: "color", label: "Color" },
      { key: "inputCount", label: "Inputs" },
      { key: "outputCount", label: "Outputs" },
      { key: "headphoneOutputCount", label: "Headphone Outs" },
      { key: "aesInputCount", label: "AES Inputs" },
      { key: "aesOutputCount", label: "AES Outputs" },
      { key: "deviceType", label: "Device Type" },
      { key: "portsPerRow", label: "Ports/Row" },
      { key: "position", label: "Position", format: formatPosition },
    ];

    const ioPortFields: FieldSpec<IOPort>[] = [
      { key: "ioDeviceId", label: "Device", format: (value) => formatLookup(value, ioDeviceLabelById) },
      { key: "label", label: "Label" },
      { key: "type", label: "Type" },
      { key: "portNumber", label: "Port Number" },
      { key: "subType", label: "Subtype" },
      { key: "headphoneNumber", label: "Headphone #" },
      { key: "aesNumber", label: "AES #" },
    ];

    const groupFields: FieldSpec<Group>[] = [
      { key: "name", label: "Name" },
      { key: "color", label: "Color" },
      { key: "order", label: "Order" },
    ];

    const mixerDiffs = diffItemsById(snapshotPayload.mixers ?? [], mixers, {
      label: (mixer) => mixer.name || mixer.designation || "Mixer",
    });
    const ioDeviceDiffs = diffItemsById(snapshotPayload.ioDevices ?? [], currentIoDevices, {
      label: (device) => device.name || device.shortName || "Device",
    });
    const ioPortDiffs = diffItemsById(snapshotPayload.ioPorts ?? [], currentPorts, {
      label: (port) =>
        portLabelById.get(port._id) || port.label || `Port ${port.portNumber}`,
    });
    const groupDiffs = diffItemsById(snapshotPayload.groups ?? [], groups, {
      label: (group) => group.name || (group.order ? `Group ${group.order}` : "Group"),
    });

    const currentProjectSnapshot = {
      title: project.title,
      date: project.date,
      venue: project.venue,
    };

    const projectChanged = diffFields(
      snapshotPayload.project,
      currentProjectSnapshot
    );

    const projectDiffs: ItemDiff<ProjectSnapshotPayload["project"]>[] =
      projectChanged.length > 0
        ? [
            {
              id: "project",
              status: "modified",
              label:
                currentProjectSnapshot.title ||
                snapshotPayload.project.title ||
                "Project",
              changedFields: projectChanged,
              before: snapshotPayload.project,
              after: currentProjectSnapshot,
            },
          ]
        : [];

    return {
      inputDiffs,
      outputDiffs,
      configDetails: {
        project: projectDiffs,
        mixers: mixerDiffs,
        ioDevices: ioDeviceDiffs,
        ioPorts: ioPortDiffs,
        groups: groupDiffs,
      },
      configSummary: {
        project: countDiffs(projectDiffs),
        mixers: countDiffs(mixerDiffs),
        ioDevices: countDiffs(ioDeviceDiffs),
        ioPorts: countDiffs(ioPortDiffs),
        groups: countDiffs(groupDiffs),
      },
      fieldSpecs: {
        project: projectFields,
        inputs: inputFields,
        outputs: outputFields,
        mixers: mixerFields,
        ioDevices: ioDeviceFields,
        ioPorts: ioPortFields,
        groups: groupFields,
      },
    };
  }, [snapshotResult, inputChannels, outputChannels, mixers, ioDevices, groups, project]);

  const configSummaryRows: Array<{ label: string; diff: DiffCounts }> = diffData
    ? [
        { label: "Project", diff: diffData.configSummary.project },
        { label: "Mixers", diff: diffData.configSummary.mixers },
        { label: "IO Devices", diff: diffData.configSummary.ioDevices },
        { label: "IO Ports", diff: diffData.configSummary.ioPorts },
        { label: "Groups", diff: diffData.configSummary.groups },
      ]
    : [];

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

        {!snapshotResult || !diffData ? (
          <div className="py-8 text-center text-muted-foreground">Loading diff...</div>
        ) : (
          <Tabs defaultValue="inputs" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="inputs">Inputs</TabsTrigger>
              <TabsTrigger value="outputs">Outputs</TabsTrigger>
              <TabsTrigger value="config">Configuration</TabsTrigger>
            </TabsList>

            <TabsContent value="inputs" className="space-y-4">
              <SideBySideDiffBlock
                rows={buildSideBySideRows(
                  diffData.inputDiffs,
                  diffData.fieldSpecs.inputs
                )}
              />
            </TabsContent>

            <TabsContent value="outputs" className="space-y-4">
              <SideBySideDiffBlock
                rows={buildSideBySideRows(
                  diffData.outputDiffs,
                  diffData.fieldSpecs.outputs
                )}
              />
            </TabsContent>

            <TabsContent value="config" className="space-y-4">
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
                    {configSummaryRows.map(({ label, diff }) => (
                      <TableRow key={label}>
                        <TableCell>{label}</TableCell>
                        <TableCell>{diff.added}</TableCell>
                        <TableCell>{diff.removed}</TableCell>
                        <TableCell>{diff.modified}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Separator />
                <Tabs defaultValue="project" className="w-full">
                  <TabsList className="mb-4 flex flex-wrap">
                    <TabsTrigger value="project">Project</TabsTrigger>
                    <TabsTrigger value="mixers">Mixers</TabsTrigger>
                    <TabsTrigger value="ioDevices">IO Devices</TabsTrigger>
                    <TabsTrigger value="ioPorts">IO Ports</TabsTrigger>
                    <TabsTrigger value="groups">Groups</TabsTrigger>
                  </TabsList>

                  <TabsContent value="project">
                    <SideBySideDiffBlock
                      rows={buildSideBySideRows(
                        diffData.configDetails.project,
                        diffData.fieldSpecs.project,
                        { sortByLabel: true }
                      )}
                    />
                  </TabsContent>
                  <TabsContent value="mixers">
                    <SideBySideDiffBlock
                      rows={buildSideBySideRows(
                        diffData.configDetails.mixers,
                        diffData.fieldSpecs.mixers,
                        { sortByLabel: true }
                      )}
                    />
                  </TabsContent>
                  <TabsContent value="ioDevices">
                    <SideBySideDiffBlock
                      rows={buildSideBySideRows(
                        diffData.configDetails.ioDevices,
                        diffData.fieldSpecs.ioDevices,
                        { sortByLabel: true }
                      )}
                    />
                  </TabsContent>
                  <TabsContent value="ioPorts">
                    <SideBySideDiffBlock
                      rows={buildSideBySideRows(
                        diffData.configDetails.ioPorts,
                        diffData.fieldSpecs.ioPorts,
                        { sortByLabel: true }
                      )}
                    />
                  </TabsContent>
                  <TabsContent value="groups">
                    <SideBySideDiffBlock
                      rows={buildSideBySideRows(
                        diffData.configDetails.groups,
                        diffData.fieldSpecs.groups,
                        { sortByLabel: true }
                      )}
                    />
                  </TabsContent>
                </Tabs>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
