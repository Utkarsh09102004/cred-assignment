/**
 * AI Agent Module
 *
 * Main entry point for the AI agent functionality.
 * Exports the configured agent with all tools and settings.
 */

import { anthropic } from '@ai-sdk/anthropic';
import { stepCountIs } from 'ai';
import { tools } from './tools';
import { MODEL_ID, SYSTEM_PROMPT, MAX_STEPS, PROVIDER_OPTIONS } from './config';

/**
 * Get the configured AI model instance
 *
 * @returns {Object} Configured Anthropic model instance
 */
export function getModel() {
  return anthropic(MODEL_ID);
}

/**
 * Get the agent configuration
 *
 * This returns all the configuration needed for the AI SDK's
 * generateText or streamText functions.
 *
 * @returns {Object} Agent configuration object
 */
export function getAgentConfig() {
  return {
    model: getModel(),
    system: SYSTEM_PROMPT,
    tools,
    // Allow multiple tool/result rounds before stopping
    stopWhen: stepCountIs(MAX_STEPS),
    maxSteps: MAX_STEPS,
    providerOptions: PROVIDER_OPTIONS,
  };
}

/**
 * Export individual components for flexibility
 */
export { tools } from './tools';
export { MODEL_ID, SYSTEM_PROMPT, MAX_STEPS } from './config';
