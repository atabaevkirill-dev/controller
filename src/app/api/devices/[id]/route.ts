import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { DEFAULT_DEVICE_CONFIGS } from '@/lib/device-types';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const device = await db.deviceConfig.findUnique({
      where: { model: id },
      include: { presets: { orderBy: { slot: 'asc' } } },
    });

    if (!device) {
      return NextResponse.json(
        { success: false, error: `Device '${id}' not found` },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: device });
  } catch (error: any) {
    console.error(`[API /devices/${id} GET]`, error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch device' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { displayName, tiltIp, tiltPort, panIp, panPort, isActive } = body;

    const device = await db.deviceConfig.update({
      where: { model: id },
      data: {
        ...(displayName !== undefined && { displayName }),
        ...(tiltIp !== undefined && { tiltIp }),
        ...(tiltPort !== undefined && { tiltPort }),
        ...(panIp !== undefined && { panIp }),
        ...(panPort !== undefined && { panPort }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json({ success: true, data: device });
  } catch (error: any) {
    console.error(`[API /devices/${id} PUT]`, error);
    if (error.code === 'P2025') {
      return NextResponse.json(
        { success: false, error: `Device '${id}' not found` },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update device' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const defaults = DEFAULT_DEVICE_CONFIGS[id as keyof typeof DEFAULT_DEVICE_CONFIGS];

    if (!defaults) {
      return NextResponse.json(
        { success: false, error: `Unknown device model '${id}'` },
        { status: 400 }
      );
    }

    // Reset to defaults instead of deleting
    const device = await db.deviceConfig.upsert({
      where: { model: id },
      create: {
        model: id,
        displayName: defaults.name,
        tiltIp: defaults.config.tiltIp,
        tiltPort: defaults.config.tiltPort,
        panIp: defaults.config.panIp,
        panPort: defaults.config.panPort,
        isActive: false,
      },
      update: {
        displayName: defaults.name,
        tiltIp: defaults.config.tiltIp,
        tiltPort: defaults.config.tiltPort,
        panIp: defaults.config.panIp,
        panPort: defaults.config.panPort,
        isActive: false,
      },
    });

    // Also delete all presets for this device
    await db.preset.deleteMany({ where: { deviceId: device.id } });

    return NextResponse.json({ success: true, data: device, message: `Device '${id}' reset to defaults` });
  } catch (error: any) {
    console.error(`[API /devices/${id} DELETE]`, error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to reset device' },
      { status: 500 }
    );
  }
}