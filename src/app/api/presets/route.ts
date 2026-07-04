import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('deviceId');

    if (!deviceId) {
      return NextResponse.json(
        { success: false, error: 'deviceId query parameter is required' },
        { status: 400 }
      );
    }

    // Find device by model name
    const device = await db.deviceConfig.findUnique({
      where: { model: deviceId },
    });

    if (!device) {
      return NextResponse.json({ success: true, data: [] });
    }

    const presets = await db.preset.findMany({
      where: { deviceId: device.id },
      orderBy: { slot: 'asc' },
    });

    return NextResponse.json({ success: true, data: presets });
  } catch (error: any) {
    console.error('[API /presets GET]', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch presets' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { deviceId, name, slot, azimuth, elevation, speed } = body;

    if (!deviceId || !name || slot === undefined) {
      return NextResponse.json(
        { success: false, error: 'deviceId, name, and slot are required' },
        { status: 400 }
      );
    }

    // Find device by model name
    const device = await db.deviceConfig.findUnique({
      where: { model: deviceId },
    });

    if (!device) {
      return NextResponse.json(
        { success: false, error: `Device '${deviceId}' not found. Seed devices first.` },
        { status: 404 }
      );
    }

    if (slot < 1 || slot > 16) {
      return NextResponse.json(
        { success: false, error: 'Slot must be between 1 and 16' },
        { status: 400 }
      );
    }

    // Upsert preset (unique on deviceId + slot)
    const preset = await db.preset.upsert({
      where: {
        deviceId_slot: {
          deviceId: device.id,
          slot,
        },
      },
      create: {
        name,
        slot,
        azimuth: azimuth || 0,
        elevation: elevation || 0,
        speed: speed || 5,
        deviceId: device.id,
      },
      update: {
        name,
        azimuth: azimuth ?? undefined,
        elevation: elevation ?? undefined,
        speed: speed ?? undefined,
      },
    });

    return NextResponse.json({ success: true, data: preset });
  } catch (error: any) {
    console.error('[API /presets POST]', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create preset' },
      { status: 500 }
    );
  }
}