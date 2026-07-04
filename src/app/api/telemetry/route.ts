import { NextRequest, NextResponse } from 'next/server';
import { getTcpManager } from '@/lib/tcp-manager';
import type { DeviceModel } from '@/lib/device-types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const device = (searchParams.get('device') || 'TL.0009') as DeviceModel;

    const tcp = getTcpManager();

    if (!tcp.isConnected(device)) {
      return NextResponse.json({
        azimuth: 0,
        elevation: 0,
        speed: 0,
        status: 'Disconnected',
        connected: false,
      });
    }

    // Query real position from device
    const posResponse = await tcp.sendCommand(device, 'POS');
    let azimuth = 0;
    let elevation = 0;

    if (!posResponse.startsWith('ERR')) {
      const match = posResponse.match(/AZ[:\s]*([-\d.]+)\s*EL[:\s]*([-\d.]+)/i);
      if (match) {
        azimuth = parseFloat(match[1]);
        elevation = parseFloat(match[2]);
      }
    }

    // Query status
    const statusResponse = await tcp.sendCommand(device, 'STA');
    let status = 'Unknown';
    let speed = 0;
    if (!statusResponse.startsWith('ERR')) {
      const spdMatch = statusResponse.match(/SPD[:\s]*(\d+)/i);
      const stMatch = statusResponse.match(/ST[:\s]*(\w+)/i);
      if (spdMatch) speed = parseInt(spdMatch[1], 10);
      if (stMatch) status = stMatch[1] === 'IDLE' ? 'Idle' : `Moving ${stMatch[1]}`;
    }

    const tcpStatus = tcp.getStatus(device);

    return NextResponse.json({
      azimuth,
      elevation,
      speed,
      status,
      connected: true,
      lastActivity: tcpStatus.lastActivity,
    });
  } catch (error: any) {
    console.error('[API /telemetry GET]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch telemetry' },
      { status: 500 }
    );
  }
}