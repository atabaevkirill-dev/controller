import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { DEFAULT_DEVICE_CONFIGS, type DeviceModel } from '@/lib/device-types';

export async function GET() {
  try {
    let devices = await db.deviceConfig.findMany({
      orderBy: { model: 'asc' },
      include: { presets: true },
    });

    // Seed with defaults if no devices exist
    if (devices.length === 0) {
      for (const [model, config] of Object.entries(DEFAULT_DEVICE_CONFIGS)) {
        await db.deviceConfig.create({
          data: {
            model,
            displayName: config.name,
            tiltIp: config.config.tiltIp,
            tiltPort: config.config.tiltPort,
            panIp: config.config.panIp,
            panPort: config.config.panPort,
            isActive: false,
          },
        });
      }
      devices = await db.deviceConfig.findMany({
        orderBy: { model: 'asc' },
        include: { presets: true },
      });
    }

    return NextResponse.json({ success: true, data: devices });
  } catch (error: any) {
    console.error('[API /devices GET]', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch devices' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { model, displayName, tiltIp, tiltPort, panIp, panPort, isActive } = body;

    if (!model || !displayName) {
      return NextResponse.json(
        { success: false, error: 'model and displayName are required' },
        { status: 400 }
      );
    }

    // Upsert: create or update
    const device = await db.deviceConfig.upsert({
      where: { model },
      create: {
        model,
        displayName,
        tiltIp: tiltIp || '192.168.1.115',
        tiltPort: tiltPort || 9762,
        panIp: panIp || '192.168.1.115',
        panPort: panPort || 9762,
        isActive: isActive || false,
      },
      update: {
        displayName,
        tiltIp: tiltIp ?? undefined,
        tiltPort: tiltPort ?? undefined,
        panIp: panIp ?? undefined,
        panPort: panPort ?? undefined,
        isActive: isActive ?? undefined,
      },
    });

    return NextResponse.json({ success: true, data: device });
  } catch (error: any) {
    console.error('[API /devices POST]', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create/update device' },
      { status: 500 }
    );
  }
}