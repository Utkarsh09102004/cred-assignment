import { convertToCoreMessages, streamText } from 'ai';
import { getAgentConfig } from '@/ai-agent';
import { prisma } from '@/lib/prisma';
import { generateConversationTitle } from '@/lib/title-generator';

// Force Node runtime so Prisma works reliably
export const runtime = 'nodejs';

/**
 * Chat API Route Handler
 *
 * This route handles chat requests from the frontend and streams responses
 * back using the AI SDK. It uses the configured AI agent with access to
 * segments and attributes tools.
 *
 * @param {Request} req - The incoming request object
 * @returns {Response} Streaming response with AI-generated text
 */
export async function POST(req) {
  try {
    // Parse the incoming request body
    const body = await req.json();
    const { messages, conversationId, id } = body;
    // Handle both conversationId and id (from useChat hook)
    const resolvedConversationId = conversationId || id;

    if (!resolvedConversationId) {
      return new Response(
        JSON.stringify({ error: 'conversationId is required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate that messages exist
    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: 'Messages array is required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Verify conversation exists (don't create new ones here)
    const existingConversation = await prisma.conversation.findUnique({
      where: { id: resolvedConversationId },
    });

    if (!existingConversation) {
      return new Response(
        JSON.stringify({ error: 'Conversation not found. Please create a conversation first.' }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Generate title if missing and this is a user message
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === 'user' && !existingConversation.title) {
      try {
        const title = await generateConversationTitle(
          lastMessage.parts?.[0]?.text || lastMessage.content || lastMessage.text || ''
        );
        if (title) {
          await prisma.conversation.update({
            where: { id: resolvedConversationId },
            data: { title },
          });
        }
      } catch (err) {
        console.error('Title generation failed:', err);
        // Continue without failing
      }
    }

    // Get the agent configuration (model, tools, system prompt, etc.)
    const agentConfig = getAgentConfig();
    const toolsWithConversation =
      agentConfig.tools?.update_tree
        ? {
            ...agentConfig.tools,
            update_tree: {
              ...agentConfig.tools.update_tree,
              // Auto-fill conversationId so the model doesn't need to supply it
              execute: async input =>
                agentConfig.tools.update_tree.execute({
                  conversationId: resolvedConversationId,
                  ...input,
                }),
            },
          }
        : agentConfig.tools;

    // Stream the AI response
    const result = streamText({
      ...agentConfig,
      tools: toolsWithConversation,
      messages: convertToCoreMessages(messages),
    });

    // Return the streaming response for useChat hook
    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error('Chat API Error:', error);

    return new Response(
      JSON.stringify({
        error: 'Failed to process chat request',
        details: error.message,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * Route segment config
 * Set a longer timeout for AI operations
 */
export const maxDuration = 30;
