// TechLaser Device Types

export type DeviceModel = 'TL.0009' | 'TL.0250' | 'TL.0320' | 'TL.0400';

export type Direction = 
  | 'up' | 'down' | 'left' | 'right'
  | 'up-left' | 'up-right' | 'down-left' | 'down-right'
  | 'stop';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export type CommandStatus = 'pending' | 'success' | 'error' | 'timeout';

export interface DeviceConnectionConfig {
  tiltIp: string;
  tiltPort: number;
  panIp: string;
  panPort: number;
}

export const DEFAULT_DEVICE_CONFIGS: Record<DeviceModel, { name: string; config: DeviceConnectionConfig }> = {
  'TL.0009': {
    name: 'TL.0009',
    config: { tiltIp: '192.168.1.115', tiltPort: 9762, panIp: '192.168.1.115', panPort: 9762 },
  },
  'TL.0250': {
    name: 'TL.0250',
    config: { tiltIp: '192.168.1.115', tiltPort: 9762, panIp: '192.168.1.115', panPort: 9762 },
  },
  'TL.0320': {
    name: 'TL.0320',
    config: { tiltIp: '192.168.1.115', tiltPort: 9762, panIp: '192.168.1.115', panPort: 9762 },
  },
  'TL.0400': {
    name: 'TL.0400 (Dual Axis)',
    config: { tiltIp: '192.168.1.115', tiltPort: 9760, panIp: '192.168.1.116', panPort: 9760 },
  },
};

export const DEVICE_MODELS: DeviceModel[] = ['TL.0009', 'TL.0250', 'TL.0320', 'TL.0400'];

export interface TelemetryData {
  azimuth: number;
  elevation: number;
  speed: number;
  status: string;
  temperature?: number;
  voltage?: number;
  uptime?: number;
}

export interface PresetData {
  id?: string;
  name: string;
  slot: number;
  azimuth: number;
  elevation: number;
  speed: number;
}

export interface CommandLogEntry {
  id: string;
  deviceId: string;
  command: string;
  direction?: string;
  payload?: string;
  response?: string;
  status: CommandStatus;
  duration?: number;
  createdAt: string;
}

export interface SwingConfig {
  enabled: boolean;
  startAz: number;
  endAz: number;
  startEl: number;
  endEl: number;
  speed: number;
  cycleCount: number; // 0 = infinite
}

// TCP Protocol commands
export const PROTOCOL_COMMANDS = {
  // Movement
  MOVE_UP: 'MU',
  MOVE_DOWN: 'MD',
  MOVE_LEFT: 'ML',
  MOVE_RIGHT: 'MR',
  MOVE_UP_LEFT: 'MUL',
  MOVE_UP_RIGHT: 'MUR',
  MOVE_DOWN_LEFT: 'MDL',
  MOVE_DOWN_RIGHT: 'MDR',
  STOP: 'STP',

  // Speed (1-10)
  SET_SPEED: 'SPD',

  // Position
  GET_POSITION: 'POS',
  GOTO_POSITION: 'GOTO',
  HOME: 'HOM',

  // System
  PING: 'PNG',
  RESET: 'RST',
  GET_STATUS: 'STA',

  // Presets
  SAVE_PRESET: 'SPRS',
  RECALL_PRESET: 'RPRS',

  // Swing
  START_SWING: 'SSWG',
  STOP_SWING: 'ESWG',
} as const;

export function buildCommand(cmd: string, value?: string | number): string {
  if (value !== undefined) {
    return `${cmd} ${value}\r\n`;
  }
  return `${cmd}\r\n`;
}

export function parsePositionResponse(data: string): { azimuth: number; elevation: number } | null {
  // Expected format: "POS AZ:180.5 EL:45.2"
  const match = data.match(/AZ[:\s]*([-\d.]+)\s*EL[:\s]*([-\d.]+)/i);
  if (match) {
    return { azimuth: parseFloat(match[1]), elevation: parseFloat(match[2]) };
  }
  return null;
}