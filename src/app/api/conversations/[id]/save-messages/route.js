import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

/**
 * Save the complete message history for a conversation
 * This is called by the frontend after messages are updated
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

    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { success: false, error: 'messages array is required' },
        { status: 400 }
      );
    }

    // Verify conversation exists
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      return NextResponse.json(
        { success: false, error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Replace all messages with the current state
    await prisma.$transaction(async (tx) => {
      // Delete existing messages
      await tx.chatMessage.deleteMany({
        where: { conversationId },
      });

      // Create new messages
      if (messages.length > 0) {
        await tx.chatMessage.createMany({
          data: messages.map((m, index) => ({
            conversationId,
            role: m.role,
            content: JSON.stringify(m),
          })),
        });
      }

      // Update conversation's updatedAt
      await tx.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Save messages error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}