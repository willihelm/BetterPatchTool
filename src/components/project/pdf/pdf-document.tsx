import { Document, Page, View, Text } from "@react-pdf/renderer";
import { styles } from "./pdf-styles";
import { PDFHeader } from "./pdf-header";
import { PDFInputTable } from "./pdf-input-table";
import { PDFOutputTable } from "./pdf-output-table";
import { PDFSingleStagebox, filterStageboxDevices } from "./pdf-stagebox-page";
import type { Project, Mixer, InputChannel, OutputChannel, IODevice, IOPort } from "@/types/convex";
import type { PDFExportOptions } from "@/types/pdf-export";

interface PortInfo {
  label: string;
  deviceColor: string;
  deviceName: string;
}

interface PortUsageEntry {
  channelType: "input" | "output";
  channelId: string;
  channelName: string;
  channelNumber: number;
}

type PortUsage = PortUsageEntry[];

interface DeviceWithPorts extends IODevice {
  inputPorts: IOPort[];
  outputPorts: IOPort[];
  headphonePorts?: IOPort[];
  aesInputPorts?: IOPort[];
  aesOutputPorts?: IOPort[];
}

interface PDFDocumentProps {
  project: Project;
  mixer?: Mixer;
  inputChannels: InputChannel[];
  outputChannels: OutputChannel[];
  devicesWithPorts: DeviceWithPorts[];
  portInfoMap: Record<string, PortInfo>;
  portUsageMap: Record<string, PortUsage | PortUsageEntry>;
  options: PDFExportOptions;
}

function PageFooter({ projectTitle }: { projectTitle: string }) {
  return (
    <View style={styles.footer} fixed>
      <Text>{projectTitle}</Text>
      <Text
        style={styles.pageNumber}
        render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
      />
    </View>
  );
}

export function PDFDocument({
  project,
  mixer,
  inputChannels,
  outputChannels,
  devicesWithPorts,
  portInfoMap,
  portUsageMap,
  options,
}: PDFDocumentProps) {
  // Filter channels based on selected devices
  const filterChannelsByDevice = <T extends InputChannel | OutputChannel>(
    channels: T[],
    type: "input" | "output"
  ): T[] => {
    if (options.selectedDeviceIds.length === 0) {
      return channels; // No filter = include all
    }

    // Get all port IDs belonging to selected devices
    const selectedPortIds = new Set<string>();
    devicesWithPorts
      .filter((d) => options.selectedDeviceIds.includes(d._id))
      .forEach((device) => {
        device.inputPorts.forEach((p) => selectedPortIds.add(p._id));
        device.outputPorts.forEach((p) => selectedPortIds.add(p._id));
        device.headphonePorts?.forEach((p) => selectedPortIds.add(p._id));
        device.aesInputPorts?.forEach((p) => selectedPortIds.add(p._id));
        device.aesOutputPorts?.forEach((p) => selectedPortIds.add(p._id));
      });

    return channels.filter((channel) => {
      // Always include channels without port assignment
      if (!channel.ioPortId) return true;
      // Include if port belongs to selected device
      return selectedPortIds.has(channel.ioPortId);
    });
  };

  // Filter devices based on selection
  const filterDevices = (devices: DeviceWithPorts[]): DeviceWithPorts[] => {
    if (options.selectedDeviceIds.length === 0) {
      return devices;
    }
    return devices.filter((d) => options.selectedDeviceIds.includes(d._id));
  };

  const filteredInputChannels = filterChannelsByDevice(inputChannels, "input");
  const filteredOutputChannels = filterChannelsByDevice(outputChannels, "output");
  const filteredDevices = filterDevices(devicesWithPorts);

  const pageSize = options.pageSize;
  const orientation = options.orientation;

  return (
    <Document
      title={`${project.title} - Patch Sheet`}
      author="BetterPatchTool"
      subject="Patch Sheet"
    >
      {/* Input Channels Page(s) */}
      {options.includeInputs && filteredInputChannels.length > 0 && (
        <Page size={pageSize} orientation={orientation} style={styles.page}>
          <PDFHeader project={project} mixer={mixer} />
          <Text style={styles.sectionTitle}>Input Channels</Text>
          <PDFInputTable
            channels={filteredInputChannels}
            portInfoMap={portInfoMap}
            options={options}
          />
          <PageFooter projectTitle={project.title} />
        </Page>
      )}

      {/* Output Channels Page(s) */}
      {options.includeOutputs && filteredOutputChannels.length > 0 && (
        <Page size={pageSize} orientation={orientation} style={styles.page}>
          <PDFHeader project={project} mixer={mixer} />
          <Text style={styles.sectionTitle}>Output Channels</Text>
          <PDFOutputTable
            channels={filteredOutputChannels}
            portInfoMap={portInfoMap}
            options={options}
          />
          <PageFooter projectTitle={project.title} />
        </Page>
      )}

      {/* Stagebox Overview Pages - one page per device */}
      {options.includeStageboxOverview &&
        filterStageboxDevices(filteredDevices).map((device) => (
          <Page key={device._id} size={pageSize} orientation={orientation} style={styles.page}>
            <PDFHeader project={project} mixer={mixer} />
            <PDFSingleStagebox
              device={device}
              portUsageMap={portUsageMap}
            />
            <PageFooter projectTitle={project.title} />
          </Page>
        ))}
    </Document>
  );
}
