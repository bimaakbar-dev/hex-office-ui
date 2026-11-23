export type TileType =
  | 'workstation'
  | 'meeting'
  | 'server'
  | 'lounge'
  | 'garden'
  | 'walkway';

export interface HexCoord {
  q: number;
  r: number;
}

export interface HexTile {
  id: string;
  q: number;
  r: number;
  type: TileType;
  label?: string;
  assignedAgentId?: string;
  rotationStep?: number;
}

export type AgentActivityState =
  | 'working'
  | 'walking'
  | 'coffee'
  | 'meeting'
  | 'thinking'
  | 'idle';

export interface AgentProfile {
  id: string;
  name: string;
  role: string;
  specialty: string;
  accentHex: string;
  jacketColor: number;
  hairColor: number;
  accessory: 'headset' | 'glasses' | 'beret' | 'visor';
  homeCoord: HexCoord;
}

export interface AgentRuntimeState {
  id: string;
  coord: HexCoord;
  worldX: number;
  worldZ: number;
  activity: AgentActivityState;
  energy: number;
  focus: number;
  tasksCompleted: number;
  thoughtBubble: string;
  currentTask: string;
}

export interface ScreenProjection {
  id: string;
  x: number;
  y: number;
  visible: boolean;
}

export interface AgentMessage {
  id: string;
  agentId: string;
  agentName: string;
  sender: 'user' | 'agent' | 'error';
  text: string;
  deliverables?: string[];
  metadataBlock?: string;
  collaboratorName?: string;
  retryPrompt?: string;
  retryAgentId?: string;
  timestamp: string;
}

export type CameraPreset = 'isometric' | 'top' | 'focus';

export type WorkspaceMode = 'observe' | 'layout';
