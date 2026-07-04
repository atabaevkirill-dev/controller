import { create } from 'zustand';
import type { DeviceModel, ConnectionStatus, TelemetryData, Direction, PresetData, CommandLogEntry, SwingConfig } from '@/lib/device-types';

interface DeviceState {
  // Active device
  activeDevice: DeviceModel;
  setActiveDevice: (model: DeviceModel) => void;

  // Connection
  connectionStatus: ConnectionStatus;
  setConnectionStatus: (status: ConnectionStatus) => void;

  // Movement
  currentDirection: Direction | null;
  setCurrentDirection: (dir: Direction | null) => void;

  // Speed
  speed: number;
  setSpeed: (speed: number) => void;

  // Telemetry
  telemetry: TelemetryData;
  setTelemetry: (data: Partial<TelemetryData>) => void;

  // Presets
  presets: PresetData[];
  setPresets: (presets: PresetData[]) => void;

  // Swing
  swing: SwingConfig;
  setSwing: (config: Partial<SwingConfig>) => void;

  // Command log
  commandLog: CommandLogEntry[];
  addCommandLog: (entry: CommandLogEntry) => void;
  clearCommandLog: () => void;

  // Joystick
  joystickConnected: boolean;
  setJoystickConnected: (connected: boolean) => void;
  joystickName: string;
  setJoystickName: (name: string) => void;

  // Mobile mode
  isMobileView: boolean;
  setIsMobileView: (mobile: boolean) => void;

  // Position control
  targetAzimuth: string;
  targetElevation: string;
  setTargetAzimuth: (val: string) => void;
  setTargetElevation: (val: string) => void;

  // Moving state
  isMoving: boolean;
  setIsMoving: (moving: boolean) => void;
}

export const useDeviceStore = create<DeviceState>((set) => ({
  activeDevice: 'TL.0009',
  setActiveDevice: (model) => set({ activeDevice: model, connectionStatus: 'disconnected', currentDirection: null, telemetry: { azimuth: 0, elevation: 0, speed: 5, status: 'Idle' } }),

  connectionStatus: 'disconnected',
  setConnectionStatus: (status) => set({ connectionStatus: status }),

  currentDirection: null,
  setCurrentDirection: (dir) => set({ currentDirection: dir, isMoving: dir !== 'stop' && dir !== null }),

  speed: 5,
  setSpeed: (speed) => set({ speed: Math.max(1, Math.min(10, speed)) }),

  telemetry: { azimuth: 0, elevation: 0, speed: 5, status: 'Idle' },
  setTelemetry: (data) => set((state) => ({ telemetry: { ...state.telemetry, ...data } })),

  presets: [],
  setPresets: (presets) => set({ presets }),

  swing: { enabled: false, startAz: -45, endAz: 45, startEl: 0, endEl: 0, speed: 3, cycleCount: 0 },
  setSwing: (config) => set((state) => ({ swing: { ...state.swing, ...config } })),

  commandLog: [],
  addCommandLog: (entry) => set((state) => ({ commandLog: [entry, ...state.commandLog].slice(0, 200) })),
  clearCommandLog: () => set({ commandLog: [] }),

  joystickConnected: false,
  setJoystickConnected: (connected) => set({ joystickConnected: connected }),
  joystickName: '',
  setJoystickName: (name) => set({ joystickName: name }),

  isMobileView: false,
  setIsMobileView: (mobile) => set({ isMobileView: mobile }),

  targetAzimuth: '0',
  targetElevation: '0',
  setTargetAzimuth: (val) => set({ targetAzimuth: val }),
  setTargetElevation: (val) => set({ targetElevation: val }),

  isMoving: false,
  setIsMoving: (moving) => set({ isMoving: moving }),
}));