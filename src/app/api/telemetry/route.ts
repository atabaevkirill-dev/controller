import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateState, jitter } from '@/lib/simulation-state';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const device = searchParams.get('device') || 'TL.0009';

    const state = getOrCreateState(device);

    const uptime = state.uptime + Math.floor((Date.now() % 100000) / 1000);
    const temperature = 35 + Math.random() * 10 + (state.moving ? 2 : 0);
    const voltage = 11.5 + Math.random() * 1.5;

    const telemetry = {
      azimuth: jitter(state.azimuth, 0.05),
      elevation: jitter(state.elevation, 0.05),
      speed: state.speed,
      status: state.moving
        ? state.moving === 'stop'
          ? 'Idle'
          : `Moving ${state.moving}`
        : 'Idle',
      temperature: parseFloat(temperature.toFixed(1)),
      voltage: parseFloat(voltage.toFixed(2)),
      uptime,
    };

    return NextResponse.json(telemetry);
  } catch (error: any) {
    console.error('[API /telemetry GET]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch telemetry' },
      { status: 500 }
    );
  }
}