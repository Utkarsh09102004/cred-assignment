import { tool } from 'ai';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

/**
 * Tool for retrieving all attribute information from the database
 *
 * This tool allows the AI agent to fetch comprehensive information about all attributes.
 * Attributes define the properties and characteristics used to describe users or entities.
 * Each attribute includes metadata like type, allowed operations, constraints, and descriptions.
 *
 * @returns {Object} Tool definition with schema and execute function
 */
export const getAttributesTool = tool({
  description: `Get the list of available user attributes, their data types, and valid operators.`,

  inputSchema: z.object({
    // No input required - this tool fetches all attributes with full details
  }),

  execute: async () => {
    try {
      // Fetch all attributes from database
      const attributes = await prisma.attribute.findMany({
        orderBy: {
          name: 'asc',
        },
      });

      // Format the attributes for better readability in AI responses
      const formattedAttributes = attributes.map(attr => ({
        id: attr.id,
        name: attr.name,
        type: attr.type,
        operations: attr.ops,
        description: attr.description,
        ...(attr.enumValues && { enumValues: attr.enumValues }),
        ...(attr.min !== null && { min: attr.min }),
        ...(attr.max !== null && { max: attr.max }),
        ...(attr.itemType && { itemType: attr.itemType }),
        ...(attr.schema && { schema: attr.schema }),
      }));

      return {
        attributes: formattedAttributes,
      };
    } catch (error) {
      throw new Error(`Failed to fetch attributes: ${error.message}`);
    }
  },
});
