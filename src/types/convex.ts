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
}

export interface Stagebox {
  _id: string;
  _creationTime: number;
  projectId: string;
  name: string;
  shortName: string;
  color: string;
  inputCount: number;
  outputCount: number;
  position?: { x: number; y: number };
}

export interface StageboxPort {
  _id: string;
  _creationTime: number;
  stageboxId: string;
  type: "input" | "output";
  portNumber: number;
  label: string;
  stageboxName?: string;
  stageboxColor?: string;
}

export interface InputChannel {
  _id: string;
  _creationTime: number;
  projectId: string;
  order: number;
  mixerId?: string;
  channelNumber: number;
  stageboxPortId?: string;
  stageboxPortIdRight?: string;
  source: string;
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
  busName: string;
  stageboxPortId?: string;
  destination: string;
  ampProcessor?: string;
  location?: string;
  cable?: string;
  notes?: string;
}
