import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { MODEL_ID } from '@/ai-agent/config';

export async function generateConversationTitle(promptText) {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const model = anthropic(MODEL_ID);
  try {
    const { text } = await generateText({
      model,
      system:
        'Create a short (max 6 words) title summarizing the user request. No quotes, no punctuation.',
      prompt: promptText.slice(0, 500),
      maxTokens: 30,
    });
    return text?.trim() || null;
  } catch (err) {
    console.error('Title generation failed:', err);
    return null;
  }
}
