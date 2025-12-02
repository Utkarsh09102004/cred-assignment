import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateConversationTitle } from '@/lib/title-generator';

export const runtime = 'nodejs';

/**
 * Generate or fetch a conversation title separately from conversation creation.
 *
 * Accepts optional { promptText, force } in the body. If no promptText is supplied,
 * it falls back to the latest user message content to propose a title.
 */
export async function POST(req, context) {
  try {
    const params = (context && 'params' in context) ? await context.params : undefined;
    const conversationId = params?.id;

    if (!conversationId) {
      return NextResponse.json(
        { success: false, error: 'conversationId is required' },
        { status: 400 }
      );
    }

    let body = {};
    try {
      body = await req.json();
    } catch (e) {
      body = {};
    }

    const force = !!body?.force;
    let promptText = body?.promptText || '';

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      return NextResponse.json(
        { success: false, error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // If title already exists and force is not set, return it without regeneration
    if (conversation.title && !force) {
      return NextResponse.json({ success: true, title: conversation.title });
    }

    if (!promptText) {
      // Try to use the latest user message content as a seed for the title
      const lastUserMessage = await prisma.chatMessage.findFirst({
        where: { conversationId, role: 'user' },
        orderBy: { createdAt: 'desc' },
      });

      if (lastUserMessage) {
        try {
          const parsed = JSON.parse(lastUserMessage.content);
          promptText =
            parsed?.parts?.[0]?.text ||
            parsed?.content ||
            parsed?.text ||
            promptText;
        } catch {
          // ignore parse errors; fallback to empty promptText
        }
      }
    }

    const title = (await generateConversationTitle(promptText || '')) || null;

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { title },
    });

    return NextResponse.json({ success: true, title });
  } catch (error) {
    console.error('Generate title error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
