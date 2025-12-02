import { tool } from 'ai';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

/**
 * Tool for retrieving all segment names from the database
 *
 * This tool allows the AI agent to fetch a list of all available segment names.
 * Segments represent user groups or categories in the system.
 *
 * @returns {Object} Tool definition with schema and execute function
 */
export const getSegmentsTool = tool({
  description: `Search for available user segments (tags). Returns a list of valid segment keys.`,

  inputSchema: z.object({
    // No input required - this tool fetches all segments
  }),

  execute: async () => {
    try {
      // Fetch all segments from database
      const segments = await prisma.segment.findMany({
        select: {
          name: true,
        },
        orderBy: {
          name: 'asc',
        },
      });

      // Extract just the names
      const segmentNames = segments.map(s => s.name);

      return {
        segments: segmentNames,
      };
    } catch (error) {
      throw new Error(`Failed to fetch segments: ${error.message}`);
    }
  },
});
