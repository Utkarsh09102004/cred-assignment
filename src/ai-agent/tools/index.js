/**
 * Tools Index
 *
 * Central export point for all AI agent tools.
 * This module aggregates all available tools and provides them
 * in a format ready to be consumed by the AI SDK.
 */

import { getSegmentsTool } from './segments';
import { getAttributesTool } from './attributes';
import { updateTreeTool } from './update-tree';

/**
 * Collection of all available tools for the AI agent
 *
 * Each tool is a self-contained unit that:
 * - Has a clear description for the AI to understand when to use it
 * - Defines an input schema using Zod for type safety
 * - Implements an execute function that performs the actual work
 */
export const tools = {
  get_segments: getSegmentsTool,
  get_attributes: getAttributesTool,
  update_tree: updateTreeTool,
};

/**
 * Tool metadata for documentation and debugging
 */
export const toolsMetadata = {
  get_segments: {
    name: 'Get Segments',
    category: 'Data Retrieval',
    purpose: 'Fetch all segment names from the database',
  },
  get_attributes: {
    name: 'Get Attributes',
    category: 'Data Retrieval',
    purpose: 'Fetch all attribute information with complete details',
  },
  update_tree: {
    name: 'Update Tree',
    category: 'Decision Tree',
    purpose: 'Validate and persist decision trees with version history',
  },
};
