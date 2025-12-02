import { NextResponse } from 'next/server';
import { getAllSegments, getSyncStatus } from '@/lib/segment-sync-service';

export async function GET(request) {
  try {
    const segments = await getAllSegments();
    const status = await getSyncStatus();

    return NextResponse.json({
      success: true,
      segments,
      status,
    });
  } catch (error) {
    console.error('Get segments error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
