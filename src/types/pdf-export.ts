export interface PDFExportOptions {
  // Content sections
  includeInputs: boolean;
  includeOutputs: boolean;
  includeStageboxOverview: boolean;

  // IO Device filter (device IDs to include, empty = all)
  selectedDeviceIds: string[];

  // Page settings
  pageSize: "A4" | "LETTER";
  orientation: "portrait" | "landscape";

  // Column visibility
  inputColumns: {
    channelNumber: boolean;
    port: boolean;
    source: boolean;
    uhf: boolean;
    micInputDev: boolean;
    location: boolean;
    cable: boolean;
    stand: boolean;
    notes: boolean;
    patched: boolean;
  };
  outputColumns: {
    rowNumber: boolean;
    port: boolean;
    busName: boolean;
    destination: boolean;
    ampProcessor: boolean;
    location: boolean;
    cable: boolean;
    notes: boolean;
  };
}

export const defaultPDFExportOptions: PDFExportOptions = {
  includeInputs: true,
  includeOutputs: true,
  includeStageboxOverview: true,
  selectedDeviceIds: [], // empty = all
  pageSize: "A4",
  orientation: "landscape",
  inputColumns: {
    channelNumber: true,
    port: true,
    source: true,
    uhf: false,
    micInputDev: false,
    location: false,
    cable: false,
    stand: false,
    notes: false,
    patched: false,
  },
  outputColumns: {
    rowNumber: true,
    port: true,
    busName: true,
    destination: true,
    ampProcessor: false,
    location: false,
    cable: false,
    notes: false,
  },
};
