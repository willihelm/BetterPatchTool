import { View, Text } from "@react-pdf/renderer";
import { styles } from "./pdf-styles";
import type { InputChannel } from "@/types/convex";
import type { PDFExportOptions } from "@/types/pdf-export";

interface PortInfo {
  label: string;
  deviceColor: string;
  deviceName: string;
}

interface PDFInputTableProps {
  channels: InputChannel[];
  portInfoMap: Record<string, PortInfo>;
  options: PDFExportOptions;
}

export function PDFInputTable({
  channels,
  portInfoMap,
  options,
}: PDFInputTableProps) {
  const cols = options.inputColumns;

  // Calculate dynamic column widths based on visible columns
  const visibleCols = [
    cols.channelNumber && { key: "channelNumber", base: 6 },
    cols.port && { key: "port", base: 12 },
    cols.source && { key: "source", base: 14 },
    cols.uhf && { key: "uhf", base: 10 },
    cols.micInputDev && { key: "micInputDev", base: 12 },
    cols.location && { key: "location", base: 10 },
    cols.cable && { key: "cable", base: 10 },
    cols.stand && { key: "stand", base: 8 },
    cols.notes && { key: "notes", base: 14 },
    cols.patched && { key: "patched", base: 6 },
  ].filter(Boolean) as { key: string; base: number }[];

  const totalBase = visibleCols.reduce((sum, col) => sum + col.base, 0);
  const colWidths: Record<string, string> = {};
  visibleCols.forEach((col) => {
    colWidths[col.key] = `${(col.base / totalBase) * 100}%`;
  });

  const getPortInfo = (portId?: string) => {
    if (!portId) return null;
    return portInfoMap[portId] || null;
  };

  const renderPortCell = (portId?: string, portIdRight?: string) => {
    const leftPort = getPortInfo(portId);
    const rightPort = getPortInfo(portIdRight);

    if (!leftPort && !rightPort) {
      return <Text style={styles.tableCell}>-</Text>;
    }

    if (leftPort && rightPort) {
      // Stereo pair
      return (
        <View style={[styles.tableCell, styles.portCell]}>
          <View
            style={[styles.portColorDot, { backgroundColor: leftPort.deviceColor }]}
          />
          <Text>
            {leftPort.label} / {rightPort.label}
          </Text>
        </View>
      );
    }

    const port = leftPort || rightPort;
    return (
      <View style={[styles.tableCell, styles.portCell]}>
        <View
          style={[styles.portColorDot, { backgroundColor: port!.deviceColor }]}
        />
        <Text>{port!.label}</Text>
      </View>
    );
  };

  // Render header row
  const renderHeader = () => (
    <View style={styles.tableHeader} fixed>
      {cols.channelNumber && (
        <Text style={[styles.tableCellHeader, { width: colWidths.channelNumber }]}>
          Ch
        </Text>
      )}
      {cols.port && (
        <Text style={[styles.tableCellHeader, { width: colWidths.port }]}>
          Port
        </Text>
      )}
      {cols.source && (
        <Text style={[styles.tableCellHeader, { width: colWidths.source }]}>
          Source
        </Text>
      )}
      {cols.uhf && (
        <Text style={[styles.tableCellHeader, { width: colWidths.uhf }]}>
          UHF
        </Text>
      )}
      {cols.micInputDev && (
        <Text style={[styles.tableCellHeader, { width: colWidths.micInputDev }]}>
          Mic/Input
        </Text>
      )}
      {cols.location && (
        <Text style={[styles.tableCellHeader, { width: colWidths.location }]}>
          Location
        </Text>
      )}
      {cols.cable && (
        <Text style={[styles.tableCellHeader, { width: colWidths.cable }]}>
          Cable
        </Text>
      )}
      {cols.stand && (
        <Text style={[styles.tableCellHeader, { width: colWidths.stand }]}>
          Stand
        </Text>
      )}
      {cols.notes && (
        <Text style={[styles.tableCellHeader, { width: colWidths.notes }]}>
          Notes
        </Text>
      )}
      {cols.patched && (
        <Text style={[styles.tableCellHeader, { width: colWidths.patched }]}>
          Patched
        </Text>
      )}
    </View>
  );

  // Render a single row
  const renderRow = (channel: InputChannel, index: number) => (
    <View
      key={channel._id}
      style={[
        styles.tableRow,
        index % 2 === 1 ? styles.tableRowAlternate : {},
      ]}
      wrap={false}
    >
      {cols.channelNumber && (
        <Text style={[styles.tableCell, { width: colWidths.channelNumber }]}>
          {channel.channelNumber}
        </Text>
      )}
      {cols.port && (
        <View style={{ width: colWidths.port }}>
          {renderPortCell(channel.ioPortId, channel.ioPortIdRight)}
        </View>
      )}
      {cols.source && (
        <Text style={[styles.tableCell, { width: colWidths.source }]}>
          {channel.isStereo && channel.sourceRight
            ? `${channel.source} / ${channel.sourceRight}`
            : channel.source || "-"}
        </Text>
      )}
      {cols.uhf && (
        <Text style={[styles.tableCell, { width: colWidths.uhf }]}>
          {channel.uhf || "-"}
        </Text>
      )}
      {cols.micInputDev && (
        <Text style={[styles.tableCell, { width: colWidths.micInputDev }]}>
          {channel.micInputDev || "-"}
        </Text>
      )}
      {cols.location && (
        <Text style={[styles.tableCell, { width: colWidths.location }]}>
          {channel.location || "-"}
        </Text>
      )}
      {cols.cable && (
        <Text style={[styles.tableCell, { width: colWidths.cable }]}>
          {channel.cable || "-"}
        </Text>
      )}
      {cols.stand && (
        <Text style={[styles.tableCell, { width: colWidths.stand }]}>
          {channel.stand || "-"}
        </Text>
      )}
      {cols.notes && (
        <Text style={[styles.tableCell, { width: colWidths.notes }]}>
          {channel.notes || "-"}
        </Text>
      )}
      {cols.patched && (
        <Text style={[styles.tableCell, { width: colWidths.patched }]}>
          {channel.patched ? "Yes" : "No"}
        </Text>
      )}
    </View>
  );

  return (
    <View style={styles.table}>
      {renderHeader()}
      {channels.map((channel, index) => renderRow(channel, index))}
    </View>
  );
}
