// Admin-managed equipment presets for common professional audio gear.
// These are hardcoded and not user-editable.
//
// channelCount = total mono input processing channels
// busConfig = per-type bus breakdown (groups, auxes, fx sends, matrices, masters, cue)

import type { BusConfig } from "./bus-utils";

export interface MixerPreset {
  id: string;
  manufacturer: string;
  model: string;
  channelCount: number;
  busConfig: BusConfig;
  stereoMode: "linked_mono" | "true_stereo";
}

export interface IODevicePreset {
  id: string;
  manufacturer: string;
  model: string;
  shortName: string;
  inputCount: number;
  outputCount: number;
  headphoneOutputCount?: number;
  aesInputCount?: number;
  aesOutputCount?: number;
  deviceType: "stagebox" | "generic";
  portsPerRow?: number;
}

export const MIXER_PRESETS: MixerPreset[] = [
  // Yamaha
  { id: "yamaha-rivage-pm10", manufacturer: "Yamaha", model: "RIVAGE PM10", channelCount: 144, busConfig: { groups: 24, auxes: 48, matrices: 24, masters: 2, cue: 4 }, stereoMode: "linked_mono" },
  { id: "yamaha-rivage-pm7", manufacturer: "Yamaha", model: "RIVAGE PM7", channelCount: 120, busConfig: { groups: 24, auxes: 48, matrices: 24, masters: 2, cue: 4 }, stereoMode: "linked_mono" },
  { id: "yamaha-rivage-pm5", manufacturer: "Yamaha", model: "RIVAGE PM5", channelCount: 120, busConfig: { groups: 12, auxes: 24, matrices: 12, masters: 2, cue: 2 }, stereoMode: "linked_mono" },
  { id: "yamaha-rivage-pm3", manufacturer: "Yamaha", model: "RIVAGE PM3", channelCount: 120, busConfig: { groups: 12, auxes: 24, matrices: 12, masters: 2, cue: 2 }, stereoMode: "linked_mono" },
  { id: "yamaha-dm7", manufacturer: "Yamaha", model: "DM7", channelCount: 120, busConfig: { groups: 12, auxes: 24, matrices: 12, masters: 2, cue: 2 }, stereoMode: "linked_mono" },
  { id: "yamaha-cl5", manufacturer: "Yamaha", model: "CL5", channelCount: 72, busConfig: { groups: 8, auxes: 24, matrices: 8, masters: 1, cue: 1 }, stereoMode: "linked_mono" },
  { id: "yamaha-cl3", manufacturer: "Yamaha", model: "CL3", channelCount: 64, busConfig: { groups: 8, auxes: 24, matrices: 8, masters: 1, cue: 1 }, stereoMode: "linked_mono" },
  { id: "yamaha-cl1", manufacturer: "Yamaha", model: "CL1", channelCount: 48, busConfig: { groups: 8, auxes: 24, matrices: 8, masters: 1, cue: 1 }, stereoMode: "linked_mono" },
  { id: "yamaha-ql5", manufacturer: "Yamaha", model: "QL5", channelCount: 64, busConfig: { groups: 8, auxes: 16, matrices: 8, masters: 1, cue: 1 }, stereoMode: "linked_mono" },
  { id: "yamaha-ql1", manufacturer: "Yamaha", model: "QL1", channelCount: 32, busConfig: { groups: 8, auxes: 16, matrices: 8, masters: 1, cue: 1 }, stereoMode: "linked_mono" },
  { id: "yamaha-tf5", manufacturer: "Yamaha", model: "TF5", channelCount: 48, busConfig: { groups: 4, auxes: 20, matrices: 4, masters: 1, cue: 1 }, stereoMode: "linked_mono" },
  { id: "yamaha-tf3", manufacturer: "Yamaha", model: "TF3", channelCount: 40, busConfig: { groups: 4, auxes: 20, matrices: 4, masters: 1, cue: 1 }, stereoMode: "linked_mono" },
  { id: "yamaha-tf1", manufacturer: "Yamaha", model: "TF1", channelCount: 32, busConfig: { groups: 4, auxes: 20, matrices: 4, masters: 1, cue: 1 }, stereoMode: "linked_mono" },
  { id: "yamaha-dm3", manufacturer: "Yamaha", model: "DM3", channelCount: 16, busConfig: { auxes: 6, masters: 1 }, stereoMode: "linked_mono" },

  // Allen & Heath
  { id: "ah-dlive-s7000", manufacturer: "Allen & Heath", model: "dLive S7000", channelCount: 128, busConfig: { groups: 16, auxes: 32, fx: 8, matrices: 16, masters: 1, cue: 2 }, stereoMode: "linked_mono" },
  { id: "ah-dlive-s5000", manufacturer: "Allen & Heath", model: "dLive S5000", channelCount: 128, busConfig: { groups: 16, auxes: 32, fx: 8, matrices: 16, masters: 1, cue: 2 }, stereoMode: "linked_mono" },
  { id: "ah-dlive-s3000", manufacturer: "Allen & Heath", model: "dLive S3000", channelCount: 128, busConfig: { groups: 16, auxes: 32, fx: 8, matrices: 16, masters: 1, cue: 2 }, stereoMode: "linked_mono" },
  { id: "ah-avantis", manufacturer: "Allen & Heath", model: "Avantis", channelCount: 64, busConfig: { groups: 16, auxes: 16, fx: 8, matrices: 6, masters: 1, cue: 1 }, stereoMode: "linked_mono" },
  { id: "ah-avantis-solo", manufacturer: "Allen & Heath", model: "Avantis Solo", channelCount: 64, busConfig: { groups: 16, auxes: 16, fx: 8, matrices: 6, masters: 1, cue: 1 }, stereoMode: "linked_mono" },
  { id: "ah-sq7", manufacturer: "Allen & Heath", model: "SQ-7", channelCount: 48, busConfig: { groups: 12, auxes: 12, fx: 4, matrices: 3, masters: 1 }, stereoMode: "linked_mono" },
  { id: "ah-sq6", manufacturer: "Allen & Heath", model: "SQ-6", channelCount: 48, busConfig: { groups: 12, auxes: 12, fx: 4, matrices: 3, masters: 1 }, stereoMode: "linked_mono" },
  { id: "ah-sq5", manufacturer: "Allen & Heath", model: "SQ-5", channelCount: 48, busConfig: { groups: 12, auxes: 12, fx: 4, matrices: 3, masters: 1 }, stereoMode: "linked_mono" },
  { id: "ah-cq18t", manufacturer: "Allen & Heath", model: "CQ-18T", channelCount: 18, busConfig: { auxes: 6, fx: 2, masters: 1 }, stereoMode: "linked_mono" },
  { id: "ah-cq12t", manufacturer: "Allen & Heath", model: "CQ-12T", channelCount: 12, busConfig: { auxes: 6, fx: 2, masters: 1 }, stereoMode: "linked_mono" },
  { id: "ah-cq20b", manufacturer: "Allen & Heath", model: "CQ-20B", channelCount: 20, busConfig: { auxes: 6, fx: 2, masters: 1 }, stereoMode: "linked_mono" },

  // Behringer
  { id: "behringer-x32", manufacturer: "Behringer", model: "X32", channelCount: 32, busConfig: { groups: 6, auxes: 16, matrices: 6, masters: 1, cue: 1 }, stereoMode: "linked_mono" },
  { id: "behringer-x32-compact", manufacturer: "Behringer", model: "X32 Compact", channelCount: 32, busConfig: { groups: 6, auxes: 16, matrices: 6, masters: 1, cue: 1 }, stereoMode: "linked_mono" },
  { id: "behringer-x32-rack", manufacturer: "Behringer", model: "X32 Rack", channelCount: 32, busConfig: { groups: 6, auxes: 16, matrices: 6, masters: 1, cue: 1 }, stereoMode: "linked_mono" },
  { id: "behringer-x32-producer", manufacturer: "Behringer", model: "X32 Producer", channelCount: 32, busConfig: { groups: 6, auxes: 16, matrices: 6, masters: 1, cue: 1 }, stereoMode: "linked_mono" },
  { id: "behringer-wing", manufacturer: "Behringer", model: "WING", channelCount: 48, busConfig: { groups: 4, auxes: 16, fx: 4, matrices: 4, masters: 1 }, stereoMode: "true_stereo" },
  { id: "behringer-wing-compact", manufacturer: "Behringer", model: "WING Compact", channelCount: 48, busConfig: { groups: 4, auxes: 16, fx: 4, matrices: 4, masters: 1 }, stereoMode: "true_stereo" },

  // Midas
  { id: "midas-m32", manufacturer: "Midas", model: "M32", channelCount: 32, busConfig: { groups: 6, auxes: 16, matrices: 6, masters: 1, cue: 1 }, stereoMode: "linked_mono" },
  { id: "midas-m32r", manufacturer: "Midas", model: "M32R", channelCount: 32, busConfig: { groups: 6, auxes: 16, matrices: 6, masters: 1, cue: 1 }, stereoMode: "linked_mono" },
  { id: "midas-m32r-live", manufacturer: "Midas", model: "M32R LIVE", channelCount: 32, busConfig: { groups: 6, auxes: 16, matrices: 6, masters: 1, cue: 1 }, stereoMode: "linked_mono" },
  { id: "midas-pro1", manufacturer: "Midas", model: "Pro1", channelCount: 48, busConfig: { groups: 3, auxes: 24, matrices: 3, masters: 1 }, stereoMode: "linked_mono" },
  { id: "midas-pro2", manufacturer: "Midas", model: "Pro2", channelCount: 64, busConfig: { groups: 3, auxes: 24, matrices: 3, masters: 1 }, stereoMode: "linked_mono" },
  { id: "midas-pro6", manufacturer: "Midas", model: "Pro6", channelCount: 64, busConfig: { groups: 3, auxes: 27, matrices: 5, masters: 1 }, stereoMode: "linked_mono" },
  { id: "midas-pro9", manufacturer: "Midas", model: "Pro9", channelCount: 88, busConfig: { groups: 3, auxes: 27, matrices: 5, masters: 1 }, stereoMode: "linked_mono" },
  { id: "midas-prox", manufacturer: "Midas", model: "ProX", channelCount: 168, busConfig: { groups: 32, auxes: 48, matrices: 16, masters: 2 }, stereoMode: "linked_mono" },
  { id: "midas-hd96-24", manufacturer: "Midas", model: "Heritage D HD96-24", channelCount: 144, busConfig: { groups: 48, auxes: 48, matrices: 24, masters: 2 }, stereoMode: "linked_mono" },

  // DiGiCo
  { id: "digico-quantum7", manufacturer: "DiGiCo", model: "Quantum 7", channelCount: 256, busConfig: { groups: 32, auxes: 64, matrices: 32, masters: 2 }, stereoMode: "linked_mono" },
  { id: "digico-q5", manufacturer: "DiGiCo", model: "Quantum 5", channelCount: 256, busConfig: { groups: 32, auxes: 64, matrices: 32, masters: 2 }, stereoMode: "linked_mono" },
  { id: "digico-q338", manufacturer: "DiGiCo", model: "Quantum 338", channelCount: 128, busConfig: { groups: 16, auxes: 32, matrices: 16, masters: 2 }, stereoMode: "linked_mono" },
  { id: "digico-q225", manufacturer: "DiGiCo", model: "Quantum 225", channelCount: 72, busConfig: { groups: 8, auxes: 24, matrices: 8, masters: 1 }, stereoMode: "linked_mono" },
  { id: "digico-s21", manufacturer: "DiGiCo", model: "S21", channelCount: 48, busConfig: { groups: 8, auxes: 16, matrices: 4, masters: 1 }, stereoMode: "linked_mono" },
  { id: "digico-s31", manufacturer: "DiGiCo", model: "S31", channelCount: 48, busConfig: { groups: 8, auxes: 16, matrices: 4, masters: 1 }, stereoMode: "linked_mono" },
  { id: "digico-sd12", manufacturer: "DiGiCo", model: "SD12", channelCount: 72, busConfig: { groups: 8, auxes: 24, matrices: 8, masters: 1 }, stereoMode: "linked_mono" },

  // SSL
  { id: "ssl-l100", manufacturer: "SSL", model: "L100 Plus", channelCount: 128, busConfig: { groups: 8, auxes: 24, matrices: 8, masters: 1 }, stereoMode: "linked_mono" },
  { id: "ssl-l200-plus", manufacturer: "SSL", model: "L200 Plus", channelCount: 144, busConfig: { groups: 12, auxes: 36, matrices: 12, masters: 1 }, stereoMode: "linked_mono" },
  { id: "ssl-l350-plus", manufacturer: "SSL", model: "L350 Plus", channelCount: 216, busConfig: { groups: 24, auxes: 48, matrices: 24, masters: 1 }, stereoMode: "linked_mono" },
  { id: "ssl-l550-plus", manufacturer: "SSL", model: "L550 Plus", channelCount: 288, busConfig: { groups: 24, auxes: 48, matrices: 24, masters: 1 }, stereoMode: "linked_mono" },
  { id: "ssl-l650", manufacturer: "SSL", model: "L650", channelCount: 312, busConfig: { groups: 24, auxes: 48, matrices: 24, masters: 1 }, stereoMode: "linked_mono" },

  // Waves
  { id: "waves-lv1-16", manufacturer: "Waves", model: "eMotion LV1 16", channelCount: 16, busConfig: { groups: 4, auxes: 8, fx: 4, masters: 3, cue: 1 }, stereoMode: "true_stereo" },
  { id: "waves-lv1-32", manufacturer: "Waves", model: "eMotion LV1 32", channelCount: 32, busConfig: { groups: 8, auxes: 16, fx: 8, matrices: 4, masters: 3, cue: 1 }, stereoMode: "true_stereo" },
  { id: "waves-lv1-64", manufacturer: "Waves", model: "eMotion LV1 64", channelCount: 64, busConfig: { groups: 8, auxes: 16, fx: 8, matrices: 4, masters: 3, cue: 1 }, stereoMode: "true_stereo" },
  { id: "waves-lv1-80", manufacturer: "Waves", model: "eMotion LV1 80", channelCount: 80, busConfig: { groups: 8, auxes: 24, fx: 8, matrices: 4, masters: 3, cue: 1 }, stereoMode: "true_stereo" },
  { id: "waves-lv1-classic-64", manufacturer: "Waves", model: "eMotion LV1 Classic 64", channelCount: 64, busConfig: { groups: 8, auxes: 24, fx: 8, matrices: 4, masters: 3, cue: 1 }, stereoMode: "true_stereo" },
  { id: "waves-lv1-classic-80", manufacturer: "Waves", model: "eMotion LV1 Classic 80", channelCount: 80, busConfig: { groups: 8, auxes: 32, fx: 8, matrices: 4, masters: 3, cue: 1 }, stereoMode: "true_stereo" },

  // PreSonus
  { id: "presonus-studiolive-16", manufacturer: "PreSonus", model: "StudioLive 16", channelCount: 16, busConfig: { auxes: 10, masters: 1 }, stereoMode: "linked_mono" },
  { id: "presonus-studiolive-24", manufacturer: "PreSonus", model: "StudioLive 24", channelCount: 24, busConfig: { groups: 4, auxes: 16, masters: 1 }, stereoMode: "linked_mono" },
  { id: "presonus-studiolive-32", manufacturer: "PreSonus", model: "StudioLive 32", channelCount: 32, busConfig: { groups: 4, auxes: 16, masters: 1 }, stereoMode: "linked_mono" },
  { id: "presonus-studiolive-32s", manufacturer: "PreSonus", model: "StudioLive 32S", channelCount: 32, busConfig: { groups: 4, auxes: 16, masters: 1 }, stereoMode: "linked_mono" },
  { id: "presonus-studiolive-32sc", manufacturer: "PreSonus", model: "StudioLive 32SC", channelCount: 32, busConfig: { groups: 4, auxes: 10, masters: 1 }, stereoMode: "linked_mono" },
  { id: "presonus-studiolive-32sx", manufacturer: "PreSonus", model: "StudioLive 32SX", channelCount: 32, busConfig: { groups: 4, auxes: 16, masters: 1 }, stereoMode: "linked_mono" },
];

export const IO_DEVICE_PRESETS: IODevicePreset[] = [
  // === Stageboxes ===

  // Yamaha
  { id: "yamaha-rio1608-d2", manufacturer: "Yamaha", model: "Rio1608-D2", shortName: "RIO", inputCount: 16, outputCount: 8, deviceType: "stagebox", portsPerRow: 8 },
  { id: "yamaha-rio3224-d2", manufacturer: "Yamaha", model: "Rio3224-D2", shortName: "RIO", inputCount: 32, outputCount: 16, aesOutputCount: 4, deviceType: "stagebox", portsPerRow: 8 },
  { id: "yamaha-tio1608-d2", manufacturer: "Yamaha", model: "Tio1608-D2", shortName: "TIO", inputCount: 16, outputCount: 8, deviceType: "stagebox", portsPerRow: 8 },

  // Allen & Heath
  { id: "ah-dx168", manufacturer: "Allen & Heath", model: "DX168", shortName: "DX", inputCount: 16, outputCount: 8, deviceType: "stagebox", portsPerRow: 8 },
  { id: "ah-dt168", manufacturer: "Allen & Heath", model: "DT168", shortName: "DT", inputCount: 16, outputCount: 8, deviceType: "stagebox", portsPerRow: 8 },
  { id: "ah-ar2412", manufacturer: "Allen & Heath", model: "AR2412", shortName: "AR", inputCount: 24, outputCount: 12, deviceType: "stagebox", portsPerRow: 12 },
  { id: "ah-ar84", manufacturer: "Allen & Heath", model: "AR84", shortName: "AR", inputCount: 8, outputCount: 4, deviceType: "stagebox", portsPerRow: 8 },
  { id: "ah-gx4816", manufacturer: "Allen & Heath", model: "GX4816", shortName: "GX", inputCount: 48, outputCount: 16, deviceType: "stagebox", portsPerRow: 8 },
  { id: "ah-dx164-w", manufacturer: "Allen & Heath", model: "DX164-W", shortName: "DX", inputCount: 16, outputCount: 4, deviceType: "stagebox", portsPerRow: 8 },

  // Behringer
  { id: "behringer-s16", manufacturer: "Behringer", model: "S16", shortName: "S16", inputCount: 16, outputCount: 8, headphoneOutputCount: 1, deviceType: "stagebox", portsPerRow: 8 },
  { id: "behringer-s32", manufacturer: "Behringer", model: "S32", shortName: "S32", inputCount: 32, outputCount: 16, aesOutputCount: 2, deviceType: "stagebox", portsPerRow: 16 },
  { id: "behringer-sd8", manufacturer: "Behringer", model: "SD8", shortName: "SD8", inputCount: 8, outputCount: 8, deviceType: "stagebox", portsPerRow: 8 },
  { id: "behringer-sd16", manufacturer: "Behringer", model: "SD16", shortName: "SD16", inputCount: 16, outputCount: 8, deviceType: "stagebox", portsPerRow: 8 },

  // Midas
  { id: "midas-dl16", manufacturer: "Midas", model: "DL16", shortName: "DL16", inputCount: 16, outputCount: 8, headphoneOutputCount: 1, deviceType: "stagebox", portsPerRow: 8 },
  { id: "midas-dl32", manufacturer: "Midas", model: "DL32", shortName: "DL32", inputCount: 32, outputCount: 16, aesOutputCount: 2, deviceType: "stagebox", portsPerRow: 16 },
  { id: "midas-dl151", manufacturer: "Midas", model: "DL151", shortName: "DL151", inputCount: 24, outputCount: 0, deviceType: "stagebox", portsPerRow: 8 },
  { id: "midas-dl152", manufacturer: "Midas", model: "DL152", shortName: "DL152", inputCount: 0, outputCount: 24, deviceType: "stagebox", portsPerRow: 8 },
  { id: "midas-dl251", manufacturer: "Midas", model: "DL251", shortName: "DL251", inputCount: 48, outputCount: 16, deviceType: "stagebox", portsPerRow: 8 },

  // DiGiCo
  { id: "digico-sd-rack", manufacturer: "DiGiCo", model: "SD-Rack", shortName: "SDR", inputCount: 56, outputCount: 56, deviceType: "stagebox", portsPerRow: 8 },
  { id: "digico-d-rack", manufacturer: "DiGiCo", model: "D-Rack", shortName: "DR", inputCount: 32, outputCount: 16, deviceType: "stagebox", portsPerRow: 8 },
  { id: "digico-d2-rack", manufacturer: "DiGiCo", model: "D2-Rack", shortName: "D2R", inputCount: 48, outputCount: 16, deviceType: "stagebox", portsPerRow: 8 },

  // SSL
  { id: "ssl-sb-32-24", manufacturer: "SSL", model: "SB 32.24", shortName: "SB", inputCount: 32, outputCount: 16, aesInputCount: 4, aesOutputCount: 4, deviceType: "stagebox", portsPerRow: 8 },
  { id: "ssl-sb-16-12", manufacturer: "SSL", model: "SB 16.12", shortName: "SB", inputCount: 16, outputCount: 8, aesInputCount: 2, aesOutputCount: 2, deviceType: "stagebox", portsPerRow: 8 },

  // PreSonus
  { id: "presonus-nsb-8-8", manufacturer: "PreSonus", model: "NSB 8.8", shortName: "NSB", inputCount: 8, outputCount: 8, deviceType: "stagebox", portsPerRow: 8 },
  { id: "presonus-nsb-16-8", manufacturer: "PreSonus", model: "NSB 16.8", shortName: "NSB", inputCount: 16, outputCount: 8, deviceType: "stagebox", portsPerRow: 8 },
  { id: "presonus-nsb-32-16", manufacturer: "PreSonus", model: "NSB 32.16", shortName: "NSB", inputCount: 32, outputCount: 16, aesOutputCount: 2, deviceType: "stagebox", portsPerRow: 8 },

  // === Console Local I/O (control surfaces with built-in analog I/O) ===

  // Yamaha Consoles
  { id: "yamaha-cl5-io", manufacturer: "Yamaha", model: "CL5 (Local I/O)", shortName: "CL5", inputCount: 8, outputCount: 8, headphoneOutputCount: 1, aesOutputCount: 1, deviceType: "stagebox", portsPerRow: 8 },
  { id: "yamaha-cl3-io", manufacturer: "Yamaha", model: "CL3 (Local I/O)", shortName: "CL3", inputCount: 8, outputCount: 8, headphoneOutputCount: 1, aesOutputCount: 1, deviceType: "stagebox", portsPerRow: 8 },
  { id: "yamaha-cl1-io", manufacturer: "Yamaha", model: "CL1 (Local I/O)", shortName: "CL1", inputCount: 8, outputCount: 8, headphoneOutputCount: 1, aesOutputCount: 1, deviceType: "stagebox", portsPerRow: 8 },
  { id: "yamaha-ql5-io", manufacturer: "Yamaha", model: "QL5 (Local I/O)", shortName: "QL5", inputCount: 32, outputCount: 16, headphoneOutputCount: 1, aesOutputCount: 1, deviceType: "stagebox", portsPerRow: 8 },
  { id: "yamaha-ql1-io", manufacturer: "Yamaha", model: "QL1 (Local I/O)", shortName: "QL1", inputCount: 16, outputCount: 8, headphoneOutputCount: 1, aesOutputCount: 1, deviceType: "stagebox", portsPerRow: 8 },
  { id: "yamaha-tf5-io", manufacturer: "Yamaha", model: "TF5 (Local I/O)", shortName: "TF5", inputCount: 32, outputCount: 16, headphoneOutputCount: 1, deviceType: "stagebox", portsPerRow: 8 },
  { id: "yamaha-tf3-io", manufacturer: "Yamaha", model: "TF3 (Local I/O)", shortName: "TF3", inputCount: 24, outputCount: 16, headphoneOutputCount: 1, deviceType: "stagebox", portsPerRow: 8 },
  { id: "yamaha-tf1-io", manufacturer: "Yamaha", model: "TF1 (Local I/O)", shortName: "TF1", inputCount: 16, outputCount: 16, headphoneOutputCount: 1, deviceType: "stagebox", portsPerRow: 8 },
  { id: "yamaha-dm7-io", manufacturer: "Yamaha", model: "DM7 (Local I/O)", shortName: "DM7", inputCount: 32, outputCount: 16, headphoneOutputCount: 1, aesInputCount: 1, aesOutputCount: 1, deviceType: "stagebox", portsPerRow: 8 },
  { id: "yamaha-dm3-io", manufacturer: "Yamaha", model: "DM3 (Local I/O)", shortName: "DM3", inputCount: 16, outputCount: 8, headphoneOutputCount: 1, deviceType: "stagebox", portsPerRow: 8 },

  // Allen & Heath Consoles
  { id: "ah-sq7-io", manufacturer: "Allen & Heath", model: "SQ-7 (Local I/O)", shortName: "SQ7", inputCount: 32, outputCount: 16, headphoneOutputCount: 1, aesOutputCount: 1, deviceType: "stagebox", portsPerRow: 8 },
  { id: "ah-sq6-io", manufacturer: "Allen & Heath", model: "SQ-6 (Local I/O)", shortName: "SQ6", inputCount: 24, outputCount: 14, headphoneOutputCount: 1, aesOutputCount: 1, deviceType: "stagebox", portsPerRow: 8 },
  { id: "ah-sq5-io", manufacturer: "Allen & Heath", model: "SQ-5 (Local I/O)", shortName: "SQ5", inputCount: 16, outputCount: 12, headphoneOutputCount: 1, aesOutputCount: 1, deviceType: "stagebox", portsPerRow: 8 },
  { id: "ah-cq18t-io", manufacturer: "Allen & Heath", model: "CQ-18T (Local I/O)", shortName: "CQ18", inputCount: 16, outputCount: 8, headphoneOutputCount: 1, deviceType: "stagebox", portsPerRow: 8 },
  { id: "ah-cq12t-io", manufacturer: "Allen & Heath", model: "CQ-12T (Local I/O)", shortName: "CQ12", inputCount: 12, outputCount: 8, headphoneOutputCount: 1, deviceType: "stagebox", portsPerRow: 8 },
  { id: "ah-cq20b-io", manufacturer: "Allen & Heath", model: "CQ-20B (Local I/O)", shortName: "CQ20", inputCount: 20, outputCount: 8, headphoneOutputCount: 1, deviceType: "stagebox", portsPerRow: 8 },

  // Behringer Consoles
  { id: "behringer-x32-io", manufacturer: "Behringer", model: "X32 (Local I/O)", shortName: "X32", inputCount: 16, outputCount: 16, headphoneOutputCount: 1, aesOutputCount: 1, deviceType: "stagebox", portsPerRow: 8 },
  { id: "behringer-x32-compact-io", manufacturer: "Behringer", model: "X32 Compact (Local I/O)", shortName: "X32C", inputCount: 16, outputCount: 8, headphoneOutputCount: 1, aesOutputCount: 1, deviceType: "stagebox", portsPerRow: 8 },
  { id: "behringer-x32-producer-io", manufacturer: "Behringer", model: "X32 Producer (Local I/O)", shortName: "X32P", inputCount: 16, outputCount: 8, headphoneOutputCount: 1, aesOutputCount: 1, deviceType: "stagebox", portsPerRow: 8 },
  { id: "behringer-x32-rack-io", manufacturer: "Behringer", model: "X32 Rack (Local I/O)", shortName: "X32R", inputCount: 16, outputCount: 8, headphoneOutputCount: 1, aesOutputCount: 1, deviceType: "stagebox", portsPerRow: 8 },
  { id: "behringer-wing-io", manufacturer: "Behringer", model: "WING (Local I/O)", shortName: "WING", inputCount: 24, outputCount: 8, headphoneOutputCount: 1, aesOutputCount: 1, deviceType: "stagebox", portsPerRow: 8 },
  { id: "behringer-wing-compact-io", manufacturer: "Behringer", model: "WING Compact (Local I/O)", shortName: "WNGC", inputCount: 24, outputCount: 8, headphoneOutputCount: 1, aesOutputCount: 1, deviceType: "stagebox", portsPerRow: 8 },

  // Midas Consoles
  { id: "midas-m32-io", manufacturer: "Midas", model: "M32 (Local I/O)", shortName: "M32", inputCount: 32, outputCount: 16, headphoneOutputCount: 1, deviceType: "stagebox", portsPerRow: 8 },
  { id: "midas-m32r-io", manufacturer: "Midas", model: "M32R (Local I/O)", shortName: "M32R", inputCount: 16, outputCount: 8, headphoneOutputCount: 1, deviceType: "stagebox", portsPerRow: 8 },
  { id: "midas-m32r-live-io", manufacturer: "Midas", model: "M32R LIVE (Local I/O)", shortName: "M32L", inputCount: 16, outputCount: 8, headphoneOutputCount: 1, deviceType: "stagebox", portsPerRow: 8 },

  // DiGiCo Consoles
  { id: "digico-s21-io", manufacturer: "DiGiCo", model: "S21 (Local I/O)", shortName: "S21", inputCount: 24, outputCount: 12, headphoneOutputCount: 1, aesInputCount: 1, aesOutputCount: 1, deviceType: "stagebox", portsPerRow: 8 },
  { id: "digico-s31-io", manufacturer: "DiGiCo", model: "S31 (Local I/O)", shortName: "S31", inputCount: 24, outputCount: 12, headphoneOutputCount: 1, aesInputCount: 1, aesOutputCount: 1, deviceType: "stagebox", portsPerRow: 8 },
  { id: "digico-sd12-io", manufacturer: "DiGiCo", model: "SD12 (Local I/O)", shortName: "SD12", inputCount: 8, outputCount: 8, headphoneOutputCount: 1, aesInputCount: 4, aesOutputCount: 4, deviceType: "stagebox", portsPerRow: 8 },

  // PreSonus Consoles
  { id: "presonus-studiolive-16-io", manufacturer: "PreSonus", model: "StudioLive 16 (Local I/O)", shortName: "SL16", inputCount: 16, outputCount: 8, headphoneOutputCount: 1, deviceType: "stagebox", portsPerRow: 8 },
  { id: "presonus-studiolive-24-io", manufacturer: "PreSonus", model: "StudioLive 24 (Local I/O)", shortName: "SL24", inputCount: 24, outputCount: 10, headphoneOutputCount: 1, deviceType: "stagebox", portsPerRow: 8 },
  { id: "presonus-studiolive-32-io", manufacturer: "PreSonus", model: "StudioLive 32 (Local I/O)", shortName: "SL32", inputCount: 32, outputCount: 16, headphoneOutputCount: 1, aesOutputCount: 1, deviceType: "stagebox", portsPerRow: 8 },
  { id: "presonus-studiolive-32s-io", manufacturer: "PreSonus", model: "StudioLive 32S (Local I/O)", shortName: "32S", inputCount: 32, outputCount: 16, headphoneOutputCount: 1, aesOutputCount: 1, deviceType: "stagebox", portsPerRow: 8 },
  { id: "presonus-studiolive-32sc-io", manufacturer: "PreSonus", model: "StudioLive 32SC (Local I/O)", shortName: "32SC", inputCount: 16, outputCount: 10, headphoneOutputCount: 1, deviceType: "stagebox", portsPerRow: 8 },
  { id: "presonus-studiolive-32sx-io", manufacturer: "PreSonus", model: "StudioLive 32SX (Local I/O)", shortName: "32SX", inputCount: 32, outputCount: 16, headphoneOutputCount: 1, deviceType: "stagebox", portsPerRow: 8 },
];

export const MIXER_MANUFACTURERS = [...new Set(MIXER_PRESETS.map((p) => p.manufacturer))];
export const IO_DEVICE_MANUFACTURERS = [...new Set(IO_DEVICE_PRESETS.map((p) => p.manufacturer))];
