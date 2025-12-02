import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req, context) {
  try {
    const params = (context && 'params' in context) ? await context.params : undefined;
    const conversationId = params?.id;
    if (!conversationId) {
      return NextResponse.json(
        { success: false, error: 'conversationId is required' },
        { status: 400 }
      );
    }

    const rows = await prisma.chatMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });

    const messages = rows
      .map(r => {
        try {
          return JSON.parse(r.content);
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    return NextResponse.json({ success: true, messages });
  } catch (error) {
    console.error('Fetch conversation messages error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
