// Shared in-memory simulation state for device commands and telemetry

export interface SimulatedDeviceState {
  azimuth: number;
  elevation: number;
  speed: number;
  moving: string | null;
  connected: boolean;
  uptime: number;
}

// In-memory state persisted across requests in the same server process
export const deviceStates = new Map<string, SimulatedDeviceState>();

export function getOrCreateState(device: string): SimulatedDeviceState {
  if (!deviceStates.has(device)) {
    deviceStates.set(device, {
      azimuth: 0,
      elevation: 0,
      speed: 5,
      moving: null,
      connected: true,
      uptime: 0,
    });
  }
  return deviceStates.get(device)!;
}

// Increment uptime on every access (simulate 1s tick)
export function tickUptime(device: string) {
  const state = getOrCreateState(device);
  state.uptime += 1;
  return state;
}

// Add small random jitter (±0.1)
export function jitter(value: number, range: number = 0.1): number {
  return Math.round((value + (Math.random() * 2 - 1) * range) * 100) / 100;
}