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

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    const versions = await prisma.treeVersion.findMany({
      where: { conversationId },
      orderBy: { version: 'asc' },
      take: 20,
    });

    return NextResponse.json({
      success: true,
      tree: conversation?.treeState ? JSON.parse(conversation.treeState) : null,
      versions: versions.map(v => ({
        id: v.id,
        version: v.version,
        validatedAt: v.validatedAt,
        treeState: v.treeState ? JSON.parse(v.treeState) : null,
        validationOutput: v.validationOutput ? JSON.parse(v.validationOutput) : null,
        isValid: v.isValid,
      })),
    });
  } catch (error) {
    console.error('Fetch conversation tree error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
