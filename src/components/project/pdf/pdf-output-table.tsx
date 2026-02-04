import { View, Text } from "@react-pdf/renderer";
import { styles } from "./pdf-styles";
import type { OutputChannel } from "@/types/convex";
import type { PDFExportOptions } from "@/types/pdf-export";

interface PortInfo {
  label: string;
  deviceColor: string;
  deviceName: string;
}

interface PDFOutputTableProps {
  channels: OutputChannel[];
  portInfoMap: Record<string, PortInfo>;
  options: PDFExportOptions;
}

export function PDFOutputTable({
  channels,
  portInfoMap,
  options,
}: PDFOutputTableProps) {
  const cols = options.outputColumns;

  // Calculate dynamic column widths based on visible columns
  const visibleCols = [
    cols.rowNumber && { key: "rowNumber", base: 6 },
    cols.port && { key: "port", base: 12 },
    cols.busName && { key: "busName", base: 14 },
    cols.destination && { key: "destination", base: 16 },
    cols.ampProcessor && { key: "ampProcessor", base: 14 },
    cols.location && { key: "location", base: 12 },
    cols.cable && { key: "cable", base: 12 },
    cols.notes && { key: "notes", base: 14 },
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
      {cols.rowNumber && (
        <Text style={[styles.tableCellHeader, { width: colWidths.rowNumber }]}>
          #
        </Text>
      )}
      {cols.port && (
        <Text style={[styles.tableCellHeader, { width: colWidths.port }]}>
          Port
        </Text>
      )}
      {cols.busName && (
        <Text style={[styles.tableCellHeader, { width: colWidths.busName }]}>
          Bus
        </Text>
      )}
      {cols.destination && (
        <Text style={[styles.tableCellHeader, { width: colWidths.destination }]}>
          Destination
        </Text>
      )}
      {cols.ampProcessor && (
        <Text style={[styles.tableCellHeader, { width: colWidths.ampProcessor }]}>
          Amp/Processor
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
      {cols.notes && (
        <Text style={[styles.tableCellHeader, { width: colWidths.notes }]}>
          Notes
        </Text>
      )}
    </View>
  );

  // Render a single row
  const renderRow = (channel: OutputChannel, index: number) => (
    <View
      key={channel._id}
      style={[
        styles.tableRow,
        index % 2 === 1 ? styles.tableRowAlternate : {},
      ]}
      wrap={false}
    >
      {cols.rowNumber && (
        <Text style={[styles.tableCell, { width: colWidths.rowNumber }]}>
          {index + 1}
        </Text>
      )}
      {cols.port && (
        <View style={{ width: colWidths.port }}>
          {renderPortCell(channel.ioPortId, channel.ioPortIdRight)}
        </View>
      )}
      {cols.busName && (
        <Text style={[styles.tableCell, { width: colWidths.busName }]}>
          {channel.busName || "-"}
        </Text>
      )}
      {cols.destination && (
        <Text style={[styles.tableCell, { width: colWidths.destination }]}>
          {channel.isStereo && channel.destinationRight
            ? `${channel.destination} / ${channel.destinationRight}`
            : channel.destination || "-"}
        </Text>
      )}
      {cols.ampProcessor && (
        <Text style={[styles.tableCell, { width: colWidths.ampProcessor }]}>
          {channel.ampProcessor || "-"}
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
      {cols.notes && (
        <Text style={[styles.tableCell, { width: colWidths.notes }]}>
          {channel.notes || "-"}
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
