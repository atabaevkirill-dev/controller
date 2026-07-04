import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, azimuth, elevation, speed, slot } = body;

    const preset = await db.preset.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(azimuth !== undefined && { azimuth }),
        ...(elevation !== undefined && { elevation }),
        ...(speed !== undefined && { speed }),
        ...(slot !== undefined && { slot }),
      },
    });

    return NextResponse.json({ success: true, data: preset });
  } catch (error: any) {
    console.error(`[API /presets/${id} PUT]`, error);
    if (error.code === 'P2025') {
      return NextResponse.json(
        { success: false, error: 'Preset not found' },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update preset' },
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

    await db.preset.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Preset deleted' });
  } catch (error: any) {
    console.error(`[API /presets/${id} DELETE]`, error);
    if (error.code === 'P2025') {
      return NextResponse.json(
        { success: false, error: 'Preset not found' },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete preset' },
      { status: 500 }
    );
  }
}