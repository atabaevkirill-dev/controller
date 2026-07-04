import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTcpManager } from '@/lib/tcp-manager';
import { DEFAULT_DEVICE_CONFIGS, type DeviceModel, type DeviceConnectionConfig } from '@/lib/device-types';

const tcp = getTcpManager();

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
    const model = device as DeviceModel;

    // Handle connect/disconnect specially
    if (command === 'CONNECT') {
      let config: DeviceConnectionConfig | undefined;
      if (value) {
        try {
          config = typeof value === 'string' ? JSON.parse(value) : value;
        } catch {}
      }

      // If no config provided, try to load from DB
      if (!config) {
        const dbDevice = await db.deviceConfig.findUnique({ where: { model } });
        if (dbDevice) {
          config = { tiltIp: dbDevice.tiltIp, tiltPort: dbDevice.tiltPort, panIp: dbDevice.panIp, panPort: dbDevice.panPort };
        }
      }

      try {
        await tcp.connect(model, config);
        // Update DB active status
        await db.deviceConfig.upsert({
          where: { model },
          create: {
            model,
            displayName: DEFAULT_DEVICE_CONFIGS[model]?.name || model,
            tiltIp: config?.tiltIp || DEFAULT_DEVICE_CONFIGS[model].config.tiltIp,
            tiltPort: config?.tiltPort || DEFAULT_DEVICE_CONFIGS[model].config.tiltPort,
            panIp: config?.panIp || DEFAULT_DEVICE_CONFIGS[model].config.panIp,
            panPort: config?.panPort || DEFAULT_DEVICE_CONFIGS[model].config.panPort,
            isActive: true,
          },
          update: { isActive: true },
        });

        return NextResponse.json({ success: true, data: 'OK CONNECTED', duration: Date.now() - startTime });
      } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message, duration: Date.now() - startTime });
      }
    }

    if (command === 'DISCONNECT') {
      tcp.disconnect(model);
      await db.deviceConfig.upsert({
        where: { model },
        create: { model, displayName: DEFAULT_DEVICE_CONFIGS[model]?.name || model, tiltIp: '192.168.1.115', tiltPort: 9760, panIp: '192.168.1.115', panPort: 9760, isActive: false },
        update: { isActive: false },
      });
      return NextResponse.json({ success: true, data: 'OK DISCONNECTED', duration: Date.now() - startTime });
    }

    // Regular commands - require TCP connection
    if (!tcp.isConnected(model)) {
      return NextResponse.json({
        success: false,
        error: 'NOT_CONNECTED',
        duration: Date.now() - startTime,
      });
    }

    const response = await tcp.sendCommand(model, command, value);
    const success = !response.startsWith('ERR');
    const duration = Date.now() - startTime;

    // Log the command to the database
    try {
      await db.commandLog.create({
        data: {
          deviceId: model,
          command,
          direction: direction || null,
          payload: value || null,
          response,
          status: response === 'ERR TIMEOUT' ? 'timeout' : (success ? 'success' : 'error'),
          duration,
        },
      });
    } catch {
      // Non-critical
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