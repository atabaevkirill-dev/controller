import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getOrCreateState } from '@/lib/simulation-state';

type Direction =
  | 'up' | 'down' | 'left' | 'right'
  | 'up-left' | 'up-right' | 'down-left' | 'down-right'
  | 'stop';

function simulateCommand(state: ReturnType<typeof getOrCreateState>, command: string, value?: string): string {
  switch (command) {
    case 'MU':
      state.moving = 'up';
      state.elevation = Math.min(90, state.elevation + state.speed * 0.5);
      return 'OK';
    case 'MD':
      state.moving = 'down';
      state.elevation = Math.max(-90, state.elevation - state.speed * 0.5);
      return 'OK';
    case 'ML':
      state.moving = 'left';
      state.azimuth = Math.max(-180, state.azimuth - state.speed * 0.5);
      return 'OK';
    case 'MR':
      state.moving = 'right';
      state.azimuth = Math.min(180, state.azimuth + state.speed * 0.5);
      return 'OK';
    case 'MUL':
      state.moving = 'up-left';
      state.azimuth = Math.max(-180, state.azimuth - state.speed * 0.35);
      state.elevation = Math.min(90, state.elevation + state.speed * 0.35);
      return 'OK';
    case 'MUR':
      state.moving = 'up-right';
      state.azimuth = Math.min(180, state.azimuth + state.speed * 0.35);
      state.elevation = Math.min(90, state.elevation + state.speed * 0.35);
      return 'OK';
    case 'MDL':
      state.moving = 'down-left';
      state.azimuth = Math.max(-180, state.azimuth - state.speed * 0.35);
      state.elevation = Math.max(-90, state.elevation - state.speed * 0.35);
      return 'OK';
    case 'MDR':
      state.moving = 'down-right';
      state.azimuth = Math.min(180, state.azimuth + state.speed * 0.35);
      state.elevation = Math.max(-90, state.elevation - state.speed * 0.35);
      return 'OK';
    case 'STP':
      state.moving = null;
      return 'OK';
    case 'SPD': {
      const spd = parseInt(value || '5', 10);
      if (!isNaN(spd) && spd >= 1 && spd <= 10) {
        state.speed = spd;
        return 'OK';
      }
      return 'ERR INVALID_SPEED';
    }
    case 'POS':
      return `AZ:${state.azimuth.toFixed(1)} EL:${state.elevation.toFixed(1)}`;
    case 'GOTO': {
      if (value) {
        const sep = value.includes(',') ? ',' : ' ';
        const parts = value.split(sep);
        const az = parseFloat(parts[0]);
        const el = parseFloat(parts[1]);
        if (!isNaN(az) && !isNaN(el)) {
          state.azimuth = Math.max(-180, Math.min(180, az));
          state.elevation = Math.max(-90, Math.min(90, el));
          state.moving = null;
          return 'OK';
        }
      }
      return 'ERR INVALID_POSITION';
    }
    case 'HOM':
      state.azimuth = 0;
      state.elevation = 0;
      state.moving = null;
      return 'OK';
    case 'PNG':
      return 'PONG';
    case 'STA':
      return `OK AZ:${state.azimuth.toFixed(1)} EL:${state.elevation.toFixed(1)} SPD:${state.speed} ST:${state.moving || 'IDLE'}`;
    case 'RST':
      state.azimuth = 0;
      state.elevation = 0;
      state.speed = 5;
      state.moving = null;
      return 'OK REBOOTING';
    case 'CONNECT':
      state.connected = true;
      return 'OK CONNECTED';
    case 'DISCONNECT':
      state.connected = false;
      state.moving = null;
      return 'OK DISCONNECTED';
    case 'SPRS': {
      const slot = parseInt(value || '1', 10);
      if (!isNaN(slot) && slot >= 1 && slot <= 16) {
        return `OK PRESET_SAVED:${slot}`;
      }
      return 'ERR INVALID_SLOT';
    }
    case 'RPRS': {
      const slot = parseInt(value || '1', 10);
      if (!isNaN(slot) && slot >= 1 && slot <= 16) {
        return `OK PRESET_RECALLED:${slot}`;
      }
      return 'ERR INVALID_SLOT';
    }
    case 'SSWG': {
      if (value) {
        const parts = value.split(',');
        if (parts.length >= 4) {
          state.azimuth = parseFloat(parts[0]);
          state.elevation = parseFloat(parts[2]);
          state.moving = 'right';
          return 'OK SWING_STARTED';
        }
      }
      return 'ERR INVALID_SWING_PARAMS';
    }
    case 'ESWG':
      state.moving = null;
      return 'OK SWING_STOPPED';
    default:
      return `ERR UNKNOWN_COMMAND:${command}`;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { device, command, value, direction } = body;

    if (!device || !command) {
      return NextResponse.json(
        { success: false, error: 'device and command are required' },
        { status: 400 }
      );
    }

    const startTime = Date.now();

    // Simulate a small delay (30-80ms)
    await new Promise((resolve) => setTimeout(resolve, 30 + Math.random() * 50));

    const state = getOrCreateState(device);
    const response = simulateCommand(state, command, value);
    const success = !response.startsWith('ERR');
    const duration = Date.now() - startTime;

    // Log the command to the database
    try {
      await db.commandLog.create({
        data: {
          deviceId: device,
          command,
          direction: direction || null,
          payload: value || null,
          response,
          status: success ? 'success' : 'error',
          duration,
        },
      });
    } catch {
      // Ignore log errors - non-critical
    }

    return NextResponse.json({
      success,
      data: response,
      error: success ? undefined : response,
      duration,
    });
  } catch (error: any) {
    console.error('[API /command POST]', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to execute command' },
      { status: 500 }
    );
  }
}