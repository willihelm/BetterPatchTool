// Temporäre Typen bis Convex die generierten Dateien erstellt
// Diese werden von `bunx convex dev` überschrieben

export interface Project {
  _id: string;
  _creationTime: number;
  title: string;
  date?: string;
  venue?: string;
  ownerId: string;
  collaborators: string[];
  isArchived: boolean;
}

export interface Mixer {
  _id: string;
  _creationTime: number;
  projectId: string;
  name: string;
  type?: string;
  stereoMode: "linked_mono" | "true_stereo";
  channelCount: number;
  designation: string;
  order?: number;
}

export interface IODevice {
  _id: string;
  _creationTime: number;
  projectId: string;
  name: string;
  shortName: string;
  color: string;
  inputCount: number;
  outputCount: number;
  headphoneOutputCount?: number;
  aesInputCount?: number;
  aesOutputCount?: number;
  position?: { x: number; y: number };
  deviceType?: "stagebox" | "generic";
  portsPerRow?: number;
}

export interface Group {
  _id: string;
  _creationTime: number;
  projectId: string;
  name: string;
  color?: string;
  order: number;
}

export interface IOPort {
  _id: string;
  _creationTime: number;
  ioDeviceId: string;
  type: "input" | "output";
  portNumber: number;
  label: string;
  subType?: "regular" | "headphone_left" | "headphone_right" | "aes_left" | "aes_right";
  headphoneNumber?: number;
  aesNumber?: number;
  ioDeviceName?: string;
  ioDeviceColor?: string;
}

export interface InputChannel {
  _id: string;
  _creationTime: number;
  projectId: string;
  order: number;
  mixerId?: string;
  channelNumber: number;
  ioPortId?: string;
  ioPortIdRight?: string;
  isStereo?: boolean;
  source: string;
  sourceRight?: string;
  uhf?: string;
  micInputDev?: string;
  patched: boolean;
  location?: string;
  cable?: string;
  stand?: string;
  notes?: string;
  groupId?: string;
}

export interface OutputChannel {
  _id: string;
  _creationTime: number;
  projectId: string;
  order: number;
  mixerId?: string;
  busType?: "group" | "aux" | "fx" | "matrix" | "master" | "cue";
  busName: string;
  ioPortId?: string;
  ioPortIdRight?: string;
  isStereo?: boolean;
  destination: string;
  destinationRight?: string;
  ampProcessor?: string;
  location?: string;
  cable?: string;
  notes?: string;
}

export interface InventoryIODevice {
  _id: string;
  _creationTime: number;
  userId: string;
  name: string;
  shortName: string;
  color: string;
  inputCount: number;
  outputCount: number;
  headphoneOutputCount?: number;
  aesInputCount?: number;
  aesOutputCount?: number;
  deviceType?: "stagebox" | "generic";
  portsPerRow?: number;
  order?: number;
}

export interface InventoryMixer {
  _id: string;
  _creationTime: number;
  userId: string;
  name: string;
  type?: string;
  stereoMode: "linked_mono" | "true_stereo";
  channelCount: number;
  busConfig?: {
    groups?: number;
    auxes?: number;
    fx?: number;
    matrices?: number;
    masters?: number;
    cue?: number;
  };
  order?: number;
}

export interface ProjectSnapshot {
  _id: string;
  _creationTime: number;
  projectId: string;
  createdBy: string;
  createdAt: number;
  name: string;
  note?: string;
  dataVersion: number;
}

export interface ProjectSnapshotData {
  _id: string;
  _creationTime: number;
  snapshotId: string;
  blob: string;
  compression?: "none";
}

export interface ProjectSnapshotPayload {
  project: {
    title: string;
    date?: string;
    venue?: string;
  };
  mixers: Mixer[];
  ioDevices: IODevice[];
  ioPorts: IOPort[];
  groups: Group[];
  inputChannels: InputChannel[];
  outputChannels: OutputChannel[];
}
