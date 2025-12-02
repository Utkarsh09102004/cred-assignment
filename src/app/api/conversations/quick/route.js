import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

/**
 * Fast conversation creation endpoint.
 * Returns only an id to unblock the first message; title can be generated later.
 */
export async function POST(req) {
  try {
    let body = {};
    try {
      body = await req.json();
    } catch (e) {
      body = {};
    }

    const promptText = body?.promptText || '';

    const id =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);

    await prisma.conversation.create({
      data: {
        id,
        // title intentionally omitted here; generate via /api/conversations/[id]/title
      },
    });

    return NextResponse.json({ conversationId: id, title: null, promptText });
  } catch (error) {
    console.error('Quick create conversation error:', error);
    return NextResponse.json(
      { error: 'Failed to create conversation quickly' },
      { status: 500 }
    );
  }
}
