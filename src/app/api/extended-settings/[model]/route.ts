import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { DEFAULT_EXTENDED_SETTINGS, DEFAULT_DEVICE_CONFIGS, type DeviceModel } from '@/lib/device-types';

// GET /api/extended-settings/[model] - Get extended settings for a device
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ model: string }> }
) {
  const { model } = await params;
  
  try {
    // First ensure device exists (create if not)
    const defaults = DEFAULT_DEVICE_CONFIGS[model as keyof typeof DEFAULT_DEVICE_CONFIGS];
    if (!defaults) {
      return NextResponse.json({ success: false, error: `Unknown model: ${model}` }, { status: 400 });
    }

    await db.deviceConfig.upsert({
      where: { model },
      create: {
        model,
        displayName: defaults.name,
        tiltIp: defaults.config.tiltIp,
        tiltPort: defaults.config.tiltPort,
        panIp: defaults.config.panIp,
        panPort: defaults.config.panPort,
        isActive: false,
      },
      update: {},
    });

    let settings = await db.extendedSettings.findUnique({
      where: { model },
    });

    // Seed with defaults if not exists
    if (!settings) {
      const extDefaults = DEFAULT_EXTENDED_SETTINGS[model as DeviceModel];
      if (!extDefaults) {
        return NextResponse.json({ success: false, error: `Unknown model: ${model}` }, { status: 400 });
      }

      settings = await db.extendedSettings.create({
        data: {
          model,
          speedMode: extDefaults.speedMode,
          acceleration: extDefaults.acceleration,
          deceleration: extDefaults.deceleration,
          deadZone: extDefaults.deadZone,
          azMin: extDefaults.azMin,
          azMax: extDefaults.azMax,
          elMin: extDefaults.elMin,
          elMax: extDefaults.elMax,
          autoParkTimeout: extDefaults.autoParkTimeout,
          backlashComp: extDefaults.backlashComp,
          // Mid+ fields
          tempWarning: 'tempWarning' in extDefaults ? extDefaults.tempWarning : null,
          tempShutdown: 'tempShutdown' in extDefaults ? extDefaults.tempShutdown : null,
          errorRecovery: 'errorRecovery' in extDefaults ? (extDefaults as any).errorRecovery : null,
          posReportInterval: 'positionReportInterval' in extDefaults ? (extDefaults as any).positionReportInterval : null,
          // Advanced fields
          velocityFeedback: 'velocityFeedback' in extDefaults ? (extDefaults as any).velocityFeedback : null,
          inertialDamping: 'inertialDamping' in extDefaults ? (extDefaults as any).inertialDamping : null,
          motorCurrentLimit: 'motorCurrentLimit' in extDefaults ? (extDefaults as any).motorCurrentLimit : null,
          // Dual axis
          tiltSpeedMode: 'tiltSpeedMode' in extDefaults ? (extDefaults as any).tiltSpeedMode : null,
          panSpeedMode: 'panSpeedMode' in extDefaults ? (extDefaults as any).panSpeedMode : null,
          tiltAcceleration: 'tiltAcceleration' in extDefaults ? (extDefaults as any).tiltAcceleration : null,
          panAcceleration: 'panAcceleration' in extDefaults ? (extDefaults as any).panAcceleration : null,
          tiltDeceleration: 'tiltDeceleration' in extDefaults ? (extDefaults as any).tiltDeceleration : null,
          panDeceleration: 'panDeceleration' in extDefaults ? (extDefaults as any).panDeceleration : null,
          syncMode: 'syncMode' in extDefaults ? (extDefaults as any).syncMode : null,
          syncRatio: 'syncRatio' in extDefaults ? (extDefaults as any).syncRatio : null,
        },
      });
    }

    return NextResponse.json({ success: true, data: settings });
  } catch (error: any) {
    console.error(`[API /extended-settings/${model} GET]`, error);
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
    console.error(`[API /extended-settings/${model} PUT]`, error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST /api/extended-settings/[model] - Send extended settings to device via TCP
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ model: string }> }
) {
  const { model } = await params;
  
  try {
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
    console.error(`[API /extended-settings/${model} POST]`, error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}