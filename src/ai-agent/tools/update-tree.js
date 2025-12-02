import { tool } from 'ai';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';

const VALIDATOR_URL = 'https://dt-agent-support.divyanshgolyan.workers.dev/v1/validate';

/**
 * Validate and persist a decision tree via the external Validator API.
 *
 * Flow:
 * 1) Fetch segments cache timestamp from SyncMetadata
 * 2) POST tree + timestamp to Validator
 * 3) If ok: save tree to Conversation + TreeVersion history
 * 4) If not ok: return structured errors for the LLM to self-correct
 */
export const updateTreeTool = tool({
  description:
    'Validate a proposed decision tree and persist it with version history after the Validator API confirms ok: true.',
  inputSchema: z.object({
    conversationId: z
      .string()
      .optional()
      .describe('Conversation id to associate this tree version with. Will be created if missing.'),
    tree: z
      .object({})
      .passthrough()
      .describe('Decision tree JSON to validate and, if valid, persist as the latest version.'),
  }),
  execute: async ({ conversationId, tree }) => {
    if (!tree) {
      throw new Error('Tree payload is required');
    }

    const bearerToken = process.env.BEARER_TOKEN || process.env.VALIDATOR_BEARER_TOKEN;
    if (!bearerToken) {
      throw new Error('Missing validator bearer token (set BEARER_TOKEN or VALIDATOR_BEARER_TOKEN).');
    }

    // 1) Get cache timestamp from sync metadata
    const metadata = await prisma.syncMetadata.findUnique({
      where: { id: 'singleton' },
    });

    if (!metadata?.lastSyncAt) {
      throw new Error('Segments cache timestamp not found. Run an initial sync before validating trees.');
    }

    const segmentsCacheTimestamp = metadata.lastSyncAt.toISOString();

    // 2) Call external Validator API
    const response = await fetch(VALIDATOR_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bearerToken}`,
      },
      body: JSON.stringify({
        tree,
        segments_cache_timestamp: segmentsCacheTimestamp,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        `Validator request failed (${response.status} ${response.statusText}): ${data?.message || 'unknown error'}`
      );
    }

    // 3) Pushback: do not save when ok is false
    if (!data?.ok) {
      return {
        ok: false,
        errors: data.errors || [],
        warnings: data.warnings || [],
        message: 'Validator rejected the tree. Please fix the reported issues and try again.',
      };
    }

    // 4) Persist conversation + versioned tree
    const validatorOutput = data?.output ?? data;
    let validationOutputString = null;
    try {
      validationOutputString = JSON.stringify(validatorOutput);
    } catch (err) {
      console.warn('Failed to stringify validator output', err);
    }

    const id = conversationId || randomUUID();
    const treeState = JSON.stringify(tree);
    const now = new Date();

    await prisma.conversation.upsert({
      where: { id },
      update: {
        treeState,
      },
      create: {
        id,
        treeState,
      },
    });

    const versionNumber =
      (await prisma.treeVersion.count({
        where: { conversationId: id },
      })) + 1;

    await prisma.treeVersion.create({
      data: {
        conversationId: id,
        version: versionNumber,
        treeState,
        validationOutput: validationOutputString,
        isValid: true,
        validatedAt: now,
      },
    });

    return { ok: true, message: 'Tree validated and stored with version history.' };
  },
});
