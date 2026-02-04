import { StyleSheet } from "@react-pdf/renderer";

export const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: "Helvetica",
    fontSize: 9,
  },
  header: {
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 10,
    color: "#666",
    marginBottom: 2,
  },
  headerMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#e5e5e5",
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    marginBottom: 10,
    marginTop: 10,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
    minPresenceAhead: 50,
  },
  table: {
    width: "100%",
    marginBottom: 10,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f5f5f5",
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
    minHeight: 20,
    alignItems: "center",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#eee",
    minHeight: 18,
    alignItems: "center",
  },
  tableRowAlternate: {
    backgroundColor: "#fafafa",
  },
  tableCell: {
    paddingHorizontal: 4,
    paddingVertical: 3,
    fontSize: 8,
  },
  tableCellHeader: {
    paddingHorizontal: 4,
    paddingVertical: 4,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
  },
  // Column widths for input table
  colChannelNumber: { width: "6%" },
  colPort: { width: "12%" },
  colSource: { width: "14%" },
  colUhf: { width: "10%" },
  colMicInputDev: { width: "12%" },
  colLocation: { width: "10%" },
  colCable: { width: "10%" },
  colStand: { width: "8%" },
  colNotes: { width: "14%" },
  colPatched: { width: "6%" },
  // Column widths for output table
  colRowNumber: { width: "6%" },
  colBusName: { width: "14%" },
  colDestination: { width: "16%" },
  colAmpProcessor: { width: "14%" },
  // Port cell with color indicator
  portCell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  portColorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  // Stagebox styles
  stageboxContainer: {
    marginBottom: 16,
  },
  stageboxHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  stageboxColorBar: {
    width: 4,
    height: 16,
    borderRadius: 2,
  },
  stageboxName: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
  },
  stageboxGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: 4,
    rowGap: 4,
    marginBottom: 6,
  },
  stageboxPort: {
    width: 50,
    height: 36,
    borderWidth: 1,
    borderRadius: 3,
    padding: 3,
    justifyContent: "flex-start",
    alignItems: "center",
  },
  stageboxPortUsed: {
    backgroundColor: "#e8f5e9",
    borderColor: "#4caf50",
  },
  stageboxPortUnused: {
    backgroundColor: "#fff",
    borderColor: "#ddd",
  },
  stageboxPortLabel: {
    fontSize: 6,
    color: "#666",
    marginBottom: 2,
  },
  stageboxPortChannel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 30,
    right: 30,
    fontSize: 7,
    color: "#999",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  pageNumber: {
    textAlign: "right",
  },
});

// Helper function to lighten a hex color for backgrounds
export function lightenColor(hex: string, percent: number): string {
  // Remove # if present
  hex = hex.replace(/^#/, "");

  // Parse hex values
  let r = parseInt(hex.substring(0, 2), 16);
  let g = parseInt(hex.substring(2, 4), 16);
  let b = parseInt(hex.substring(4, 6), 16);

  // Lighten
  r = Math.min(255, Math.floor(r + (255 - r) * percent));
  g = Math.min(255, Math.floor(g + (255 - g) * percent));
  b = Math.min(255, Math.floor(b + (255 - b) * percent));

  // Convert back to hex
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}
