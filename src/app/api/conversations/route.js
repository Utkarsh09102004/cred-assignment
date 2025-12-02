import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateConversationTitle } from '@/lib/title-generator';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const conversations = await prisma.conversation.findMany({
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        updatedAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ success: true, conversations });
  } catch (error) {
    console.error('List conversations error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list conversations' },
      { status: 500 }
    );
  }
}

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

    const title = (await generateConversationTitle(promptText)) || null;

    await prisma.conversation.create({
      data: { id, title },
    });

    return NextResponse.json({ conversationId: id, title });
  } catch (error) {
    console.error('Create conversation error:', error);
    return NextResponse.json(
      { error: 'Failed to create conversation' },
      { status: 500 }
    );
  }
}
