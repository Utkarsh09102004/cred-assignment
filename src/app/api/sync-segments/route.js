import { NextResponse } from 'next/server';
import { syncSegments } from '@/lib/segment-sync-service';

export async function POST(request) {
  try {
    const result = await syncSegments();

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Sync error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
