// TechLaser Device Types & Protocol Definitions

export type DeviceModel = 'TL.0009' | 'TL.0250' | 'TL.0320' | 'TL.0400';

export type Direction =
  | 'up' | 'down' | 'left' | 'right'
  | 'up-left' | 'up-right' | 'down-left' | 'down-right'
  | 'stop';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export type CommandStatus = 'pending' | 'success' | 'error' | 'timeout';

export type SpeedMode = 'linear' | 's-curve' | 'adaptive';

export type ErrorRecoveryMode = 'none' | 'retry' | 'homing' | 'safe-position';

export type SyncMode = 'independent' | 'synchronized' | 'master-slave';

export interface DeviceConnectionConfig {
  tiltIp: string;
  tiltPort: number;
  panIp: string;
  panPort: number;
}

export interface BaseExtendedSettings {
  speedMode: SpeedMode;
  acceleration: number;      // °/s²
  deceleration: number;      // °/s²
  deadZone: number;          // degrees
  azMin: number;
  azMax: number;
  elMin: number;
  elMax: number;
  autoParkTimeout: number;   // seconds, 0 = off
  backlashComp: number;      // degrees
}

export interface MidExtendedSettings extends BaseExtendedSettings {
  tempWarning: number;       // °C
  tempShutdown: number;      // °C
  errorRecovery: ErrorRecoveryMode;
  positionReportInterval: number; // ms
}

export interface AdvancedExtendedSettings extends MidExtendedSettings {
  velocityFeedback: boolean;
  inertialDamping: number;   // 0.00-1.00
  motorCurrentLimit: number; // 10-100%
}

export interface DualAxisExtendedSettings extends AdvancedExtendedSettings {
  // Separate tilt/pan speeds for TL.0400
  tiltSpeedMode: SpeedMode;
  panSpeedMode: SpeedMode;
  tiltAcceleration: number;
  panAcceleration: number;
  tiltDeceleration: number;
  panDeceleration: number;
  syncMode: SyncMode;
  syncRatio: number;         // Pan/Tilt speed ratio
}

export type ExtendedSettings = BaseExtendedSettings | MidExtendedSettings | AdvancedExtendedSettings | DualAxisExtendedSettings;

export const DEFAULT_EXTENDED_SETTINGS: Record<DeviceModel, ExtendedSettings> = {
  'TL.0009': {
    speedMode: 'linear',
    acceleration: 20,
    deceleration: 20,
    deadZone: 0.05,
    azMin: -180, azMax: 180,
    elMin: -10, elMax: 90,
    autoParkTimeout: 0,
    backlashComp: 0.1,
  },
  'TL.0250': {
    speedMode: 's-curve',
    acceleration: 50,
    deceleration: 50,
    deadZone: 0.03,
    azMin: -180, azMax: 180,
    elMin: -5, elMax: 90,
    autoParkTimeout: 300,
    backlashComp: 0.2,
    tempWarning: 60,
    tempShutdown: 75,
    errorRecovery: 'retry',
    positionReportInterval: 200,
  },
  'TL.0320': {
    speedMode: 's-curve',
    acceleration: 100,
    deceleration: 100,
    deadZone: 0.02,
    azMin: -180, azMax: 180,
    elMin: -5, elMax: 185,
    autoParkTimeout: 600,
    backlashComp: 0.15,
    tempWarning: 60,
    tempShutdown: 75,
    errorRecovery: 'homing',
    positionReportInterval: 100,
    velocityFeedback: true,
    inertialDamping: 0.3,
    motorCurrentLimit: 80,
  },
  'TL.0400': {
    speedMode: 's-curve',
    acceleration: 150,
    deceleration: 150,
    deadZone: 0.02,
    azMin: -180, azMax: 180,
    elMin: -5, elMax: 90,
    autoParkTimeout: 600,
    backlashComp: 0.1,
    tempWarning: 55,
    tempShutdown: 70,
    errorRecovery: 'safe-position',
    positionReportInterval: 100,
    velocityFeedback: true,
    inertialDamping: 0.4,
    motorCurrentLimit: 85,
    tiltSpeedMode: 's-curve',
    panSpeedMode: 's-curve',
    tiltAcceleration: 150,
    panAcceleration: 120,
    tiltDeceleration: 150,
    panDeceleration: 120,
    syncMode: 'independent',
    syncRatio: 1.0,
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
  cycleCount: number;
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

  // Extended Settings (per protocol)
  SET_ACCELERATION: 'SET_ACC',
  SET_DECELERATION: 'SET_DEC',
  SET_DEADZONE: 'SET_DZ',
  SET_LIMITS: 'SET_LIM',
  SET_AUTOPARK: 'SET_APT',
  SET_BACKLASH: 'SET_BC',
  SET_SPEED_MODE: 'SET_SMODE',
  SET_TEMP_WARN: 'SET_TW',
  SET_TEMP_SHUT: 'SET_TS',
  SET_ERROR_RECOVERY: 'SET_EREC',
  SET_POS_REPORT: 'SET_PRI',
  SET_VEL_FEEDBACK: 'SET_VF',
  SET_DAMPING: 'SET_DAMP',
  SET_MOTOR_CURRENT: 'SET_MCUR',
  SET_SYNC_MODE: 'SET_SYNC',
  GET_EXTENDED: 'GET_EXT',

  // TL.0400 dual-axis specific
  SET_TILT_ACC: 'SET_ACC_T',
  SET_PAN_ACC: 'SET_ACC_P',
  SET_TILT_DEC: 'SET_DEC_T',
  SET_PAN_DEC: 'SET_DEC_P',
  SET_TILT_LIMITS: 'SET_LIM_T',
  SET_PAN_LIMITS: 'SET_LIM_P',
  SET_TILT_SPEED_MODE: 'SET_SMODE_T',
  SET_PAN_SPEED_MODE: 'SET_SMODE_P',
} as const;

export const DEFAULT_DEVICE_CONFIGS: Record<DeviceModel, { name: string; config: DeviceConnectionConfig }> = {
  'TL.0009': {
    name: 'TL.0009',
    config: { tiltIp: '192.168.1.115', tiltPort: 9760, panIp: '192.168.1.115', panPort: 9760 },
  },
  'TL.0250': {
    name: 'TL.0250',
    config: { tiltIp: '192.168.1.115', tiltPort: 9760, panIp: '192.168.1.115', panPort: 9760 },
  },
  'TL.0320': {
    name: 'TL.0320',
    config: { tiltIp: '192.168.1.115', tiltPort: 9760, panIp: '192.168.1.115', panPort: 9760 },
  },
  'TL.0400': {
    name: 'TL.0400 (Dual Axis)',
    config: { tiltIp: '192.168.1.115', tiltPort: 9760, panIp: '192.168.1.116', panPort: 9760 },
  },
};

export function buildCommand(cmd: string, value?: string | number): string {
  if (value !== undefined) {
    return `${cmd} ${value}\r\n`;
  }
  return `${cmd}\r\n`;
}

export function parsePositionResponse(data: string): { azimuth: number; elevation: number } | null {
  const match = data.match(/AZ[:\s]*([-\d.]+)\s*EL[:\s]*([-\d.]+)/i);
  if (match) {
    return { azimuth: parseFloat(match[1]), elevation: parseFloat(match[2]) };
  }
  return null;
}