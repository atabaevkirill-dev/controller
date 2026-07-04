import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { DEFAULT_EXTENDED_SETTINGS, DEFAULT_DEVICE_CONFIGS, type DeviceModel } from '@/lib/device-types';

// GET /api/extended-settings/[model] - Get extended settings for a device
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ model: string }> }
) {
  try {
    const { model } = await params;

    let settings = await db.extendedSettings.findUnique({
      where: { model },
    });

    // Seed with defaults if not exists
    if (!settings) {
      const defaults = DEFAULT_EXTENDED_SETTINGS[model as DeviceModel];
      if (!defaults) {
        return NextResponse.json({ success: false, error: `Unknown model: ${model}` }, { status: 400 });
      }

      settings = await db.extendedSettings.create({
        data: {
          model,
          speedMode: defaults.speedMode,
          acceleration: defaults.acceleration,
          deceleration: defaults.deceleration,
          deadZone: defaults.deadZone,
          azMin: defaults.azMin,
          azMax: defaults.azMax,
          elMin: defaults.elMin,
          elMax: defaults.elMax,
          autoParkTimeout: defaults.autoParkTimeout,
          backlashComp: defaults.backlashComp,
          // Mid+ fields
          tempWarning: 'tempWarning' in defaults ? defaults.tempWarning : null,
          tempShutdown: 'tempShutdown' in defaults ? defaults.tempShutdown : null,
          errorRecovery: 'errorRecovery' in defaults ? (defaults as any).errorRecovery : null,
          posReportInterval: 'positionReportInterval' in defaults ? (defaults as any).positionReportInterval : null,
          // Advanced fields
          velocityFeedback: 'velocityFeedback' in defaults ? (defaults as any).velocityFeedback : null,
          inertialDamping: 'inertialDamping' in defaults ? (defaults as any).inertialDamping : null,
          motorCurrentLimit: 'motorCurrentLimit' in defaults ? (defaults as any).motorCurrentLimit : null,
          // Dual axis
          tiltSpeedMode: 'tiltSpeedMode' in defaults ? (defaults as any).tiltSpeedMode : null,
          panSpeedMode: 'panSpeedMode' in defaults ? (defaults as any).panSpeedMode : null,
          tiltAcceleration: 'tiltAcceleration' in defaults ? (defaults as any).tiltAcceleration : null,
          panAcceleration: 'panAcceleration' in defaults ? (defaults as any).panAcceleration : null,
          tiltDeceleration: 'tiltDeceleration' in defaults ? (defaults as any).tiltDeceleration : null,
          panDeceleration: 'panDeceleration' in defaults ? (defaults as any).panDeceleration : null,
          syncMode: 'syncMode' in defaults ? (defaults as any).syncMode : null,
          syncRatio: 'syncRatio' in defaults ? (defaults as any).syncRatio : null,
        },
      });
    }

    return NextResponse.json({ success: true, data: settings });
  } catch (error: any) {
    console.error(`[API /extended-settings/${params} GET]`, error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT /api/extended-settings/[model] - Update extended settings
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ model: string }> }
) {
  try {
    const { model } = await params;
    const body = await request.json();

    // Only include fields that are provided
    const updateData: any = {};
    const allowedFields = [
      'speedMode', 'acceleration', 'deceleration', 'deadZone',
      'azMin', 'azMax', 'elMin', 'elMax', 'autoParkTimeout', 'backlashComp',
      'tempWarning', 'tempShutdown', 'errorRecovery', 'posReportInterval',
      'velocityFeedback', 'inertialDamping', 'motorCurrentLimit',
      'tiltSpeedMode', 'panSpeedMode', 'tiltAcceleration', 'panAcceleration',
      'tiltDeceleration', 'panDeceleration', 'syncMode', 'syncRatio',
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    const settings = await db.extendedSettings.upsert({
      where: { model },
      create: {
        model,
        ...updateData,
      },
      update: updateData,
    });

    return NextResponse.json({ success: true, data: settings });
  } catch (error: any) {
    console.error(`[API /extended-settings/${params} PUT]`, error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST /api/extended-settings/[model] - Send extended settings to device via TCP
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ model: string }> }
) {
  try {
    const { model } = await params;
    const body = await request.json();
    const { command, value } = body;

    if (!command) {
      return NextResponse.json({ success: false, error: 'command is required' }, { status: 400 });
    }

    const { getTcpManager } = await import('@/lib/tcp-manager');
    const tcp = getTcpManager();

    if (!tcp.isConnected(model as DeviceModel)) {
      return NextResponse.json({ success: false, error: 'NOT_CONNECTED' });
    }

    const response = await tcp.sendCommand(model as DeviceModel, command, value);
    const success = !response.startsWith('ERR');

    return NextResponse.json({ success, data: response, error: success ? undefined : response });
  } catch (error: any) {
    console.error(`[API /extended-settings/${params} POST]`, error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}