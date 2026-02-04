import { View, Text } from "@react-pdf/renderer";
import { styles, lightenColor } from "./pdf-styles";
import type { IODevice, IOPort } from "@/types/convex";

interface PortUsageEntry {
  channelType: "input" | "output";
  channelId: string;
  channelName: string;
  channelNumber: number;
  stereoSide?: "L" | "R";
}

type PortUsage = PortUsageEntry[];

interface DeviceWithPorts extends IODevice {
  inputPorts: IOPort[];
  outputPorts: IOPort[];
  headphonePorts?: IOPort[];
  aesInputPorts?: IOPort[];
  aesOutputPorts?: IOPort[];
}

interface PDFStageboxPageProps {
  devices: DeviceWithPorts[];
  portUsageMap: Record<string, PortUsage | PortUsageEntry>;
}

// Normalize port usage - handles both old single-object format and new array format
function normalizeUsage(usage: PortUsage | PortUsageEntry | undefined): PortUsageEntry[] {
  if (!usage) return [];
  if (!Array.isArray(usage)) return [usage];
  return usage;
}

// Get display lines for port usage - returns array of lines to stack vertically
function getDisplayLines(usage: PortUsage | PortUsageEntry | undefined): string[] {
  const normalized = normalizeUsage(usage);
  if (normalized.length === 0) {
    return [];
  }

  // Filter to only channels with real names (not "Ch X" or "Output X" fallbacks)
  const withRealNames = normalized.filter(u =>
    !u.channelName.match(/^Ch \d+$/) && !u.channelName.match(/^Output \d+$/)
  );

  // Get stereo side from first entry (they should all have the same side for a given port)
  const stereoSuffix = normalized[0].stereoSide ? ` ${normalized[0].stereoSide}` : "";

  if (withRealNames.length === 0) {
    // No real names, show first channel's fallback name
    const first = normalized[0];
    const fallbackName = first.channelType === "input" ? `Ch ${first.channelNumber}` : `Out ${first.channelNumber}`;
    return [fallbackName + stereoSuffix];
  }

  // Get unique names
  const uniqueNames = [...new Set(withRealNames.map(u => u.channelName))];

  // Truncate names for PDF (space is limited)
  const maxNameLength = 8;
  const truncateName = (name: string, addSuffix: boolean = false) => {
    const suffix = addSuffix ? stereoSuffix : "";
    const maxLen = maxNameLength - suffix.length;
    if (name.length > maxLen) {
      return name.substring(0, maxLen - 1) + "…" + suffix;
    }
    return name + suffix;
  };

  // Return stacked lines: first name, second name (if exists), "..." (if more than 2)
  const lines: string[] = [];

  if (uniqueNames.length === 1) {
    lines.push(truncateName(uniqueNames[0], true));
  } else {
    // First name with stereo suffix
    lines.push(truncateName(uniqueNames[0], true));
    // Second name without suffix
    lines.push(truncateName(uniqueNames[1], false));
    // "..." if more than 2
    if (uniqueNames.length > 2) {
      lines.push("...");
    }
  }

  return lines;
}

function PortTypeGrid({
  device,
  ports,
  portUsageMap,
  title,
}: {
  device: DeviceWithPorts;
  ports: IOPort[];
  portUsageMap: Record<string, PortUsage | PortUsageEntry>;
  title: string;
}) {
  if (ports.length === 0) return null;

  const portsPerRow = device.portsPerRow ?? 12;
  const rows: IOPort[][] = [];
  for (let i = 0; i < ports.length; i += portsPerRow) {
    rows.push(ports.slice(i, i + portsPerRow));
  }

  return (
    <View style={{ marginBottom: 8 }} wrap={false}>
      <Text style={{ fontSize: 10, fontWeight: "bold", marginBottom: 4 }}>{title}</Text>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.stageboxGrid}>
          {row.map((port) => {
            const usage = portUsageMap[port._id];
            const normalized = normalizeUsage(usage);
            const isUsed = normalized.length > 0;
            const displayLines = getDisplayLines(usage);

            return (
              <View
                key={port._id}
                style={[
                  styles.stageboxPort,
                  isUsed
                    ? {
                        backgroundColor: lightenColor(device.color, 0.85),
                        borderColor: device.color,
                      }
                    : styles.stageboxPortUnused,
                ]}
              >
                <Text style={styles.stageboxPortLabel}>{port.label}</Text>
                {displayLines.map((line, idx) => (
                  <Text key={idx} style={styles.stageboxPortChannel}>
                    {line}
                  </Text>
                ))}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

interface PDFSingleStageboxProps {
  device: DeviceWithPorts;
  portUsageMap: Record<string, PortUsage | PortUsageEntry>;
}

export function PDFSingleStagebox({
  device,
  portUsageMap,
}: PDFSingleStageboxProps) {
  return (
    <View>
      {/* Device header with color bar */}
      <View style={styles.stageboxContainer}>
        <View style={styles.stageboxHeader}>
          <View style={[styles.stageboxColorBar, { backgroundColor: device.color }]} />
          <Text style={styles.stageboxName}>{device.name}</Text>
        </View>
      </View>

      {/* Inputs */}
      {device.inputPorts.length > 0 && (
        <PortTypeGrid
          device={device}
          ports={device.inputPorts}
          portUsageMap={portUsageMap}
          title="Inputs"
        />
      )}

      {/* Outputs */}
      {device.outputPorts.length > 0 && (
        <PortTypeGrid
          device={device}
          ports={device.outputPorts}
          portUsageMap={portUsageMap}
          title="Outputs"
        />
      )}

      {/* Headphone Outputs */}
      {device.headphonePorts && device.headphonePorts.length > 0 && (
        <PortTypeGrid
          device={device}
          ports={device.headphonePorts}
          portUsageMap={portUsageMap}
          title="Headphone Outputs"
        />
      )}

      {/* AES Inputs */}
      {device.aesInputPorts && device.aesInputPorts.length > 0 && (
        <PortTypeGrid
          device={device}
          ports={device.aesInputPorts}
          portUsageMap={portUsageMap}
          title="AES Inputs"
        />
      )}

      {/* AES Outputs */}
      {device.aesOutputPorts && device.aesOutputPorts.length > 0 && (
        <PortTypeGrid
          device={device}
          ports={device.aesOutputPorts}
          portUsageMap={portUsageMap}
          title="AES Outputs"
        />
      )}
    </View>
  );
}

// Helper to filter stagebox devices with ports
export function filterStageboxDevices(devices: DeviceWithPorts[]): DeviceWithPorts[] {
  return devices.filter(
    (d) =>
      (d.deviceType === "stagebox" || d.deviceType === undefined) &&
      (d.inputPorts.length > 0 ||
        d.outputPorts.length > 0 ||
        (d.headphonePorts && d.headphonePorts.length > 0) ||
        (d.aesInputPorts && d.aesInputPorts.length > 0) ||
        (d.aesOutputPorts && d.aesOutputPorts.length > 0))
  );
}
