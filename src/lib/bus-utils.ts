export type BusType = "group" | "aux" | "fx" | "matrix" | "master" | "cue";

export interface BusConfig {
  groups?: number;
  auxes?: number;
  fx?: number;
  matrices?: number;
  masters?: number;
  cue?: number;
}

// Maps BusConfig keys to BusType values and labels
const BUS_CONFIG_ENTRIES: Array<{ configKey: keyof BusConfig; busType: BusType; label: string }> = [
  { configKey: "groups", busType: "group", label: "Grp" },
  { configKey: "auxes", busType: "aux", label: "Aux" },
  { configKey: "fx", busType: "fx", label: "FX" },
  { configKey: "matrices", busType: "matrix", label: "Mtx" },
  { configKey: "masters", busType: "master", label: "Master" },
  { configKey: "cue", busType: "cue", label: "Cue" },
];

export function generateBusChannels(
  busConfig: BusConfig
): Array<{ busType: BusType; busName: string }> {
  const channels: Array<{ busType: BusType; busName: string }> = [];

  for (const { configKey, busType, label } of BUS_CONFIG_ENTRIES) {
    const count = busConfig[configKey] ?? 0;
    if (count <= 0) continue;

    for (let i = 1; i <= count; i++) {
      const busName = count === 1 && (busType === "master" || busType === "cue")
        ? label
        : `${label} ${i}`;
      channels.push({ busType, busName });
    }
  }

  return channels;
}

export function busConfigTotal(config: BusConfig): number {
  return BUS_CONFIG_ENTRIES.reduce((sum, { configKey }) => sum + (config[configKey] ?? 0), 0);
}

export function formatBusConfig(config: BusConfig): string {
  const parts: string[] = [];
  for (const { configKey, label } of BUS_CONFIG_ENTRIES) {
    const count = config[configKey];
    if (count && count > 0) {
      parts.push(`${count} ${label}`);
    }
  }
  return parts.join(", ") || "0 buses";
}
