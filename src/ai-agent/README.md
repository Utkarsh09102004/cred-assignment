# AI Agent Documentation

This directory contains the AI agent implementation using Vercel AI SDK and Claude.

## Architecture

```
ai-agent/
├── config.js         # Agent configuration (model, prompts, settings)
├── index.js          # Main agent module & exports
├── tools/            # Tool definitions
│   ├── index.js      # Tools collection & metadata
│   ├── segments.js   # Segment retrieval tool
│   └── attributes.js # Attribute retrieval tool
└── README.md         # This file
```

## Components

### 1. Configuration (`config.js`)

Centralized settings for:
- **Model**: Claude Sonnet 4 (claude-sonnet-4-20250514)
- **System Prompt**: Defines agent behavior and capabilities
- **Max Steps**: Limits multi-step reasoning (default: 10)
- **Provider Options**: Anthropic-specific settings

### 2. Tools (`tools/`)

#### Get Segments Tool
- **Purpose**: Retrieves all segment names from database
- **Input**: None required
- **Output**: Array of segment names with count

#### Get Attributes Tool
- **Purpose**: Retrieves all attributes with complete metadata
- **Input**: None required
- **Output**: Detailed attribute information including:
  - id, name, type
  - operations, description
  - constraints (min, max, enumValues)
  - schema information

### 3. Main Module (`index.js`)

Exports:
- `getModel()`: Returns configured Claude model
- `getAgentConfig()`: Complete agent configuration
- All tools and configuration constants

## Usage

### In API Routes

```javascript
import { streamText } from 'ai';
import { getAgentConfig } from '@/ai-agent';

export async function POST(req) {
  const { messages } = await req.json();
  const agentConfig = getAgentConfig();

  const result = streamText({
    ...agentConfig,
    messages,
  });

  return result.toDataStreamResponse();
}
```

### In Frontend

```javascript
import { useChat } from 'ai/react';

export default function ChatInterface() {
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    api: '/api/chat',
  });

  // Use messages, input, etc. in your UI
}
```

## Environment Variables

Required in `.env.local`:

```bash
ANTHROPIC_API_KEY=your_api_key_here
```

Get your API key from: https://console.anthropic.com/

## Adding New Tools

1. Create a new file in `tools/` directory:

```javascript
import { tool } from 'ai';
import { z } from 'zod';

export const myTool = tool({
  description: 'Clear description of what the tool does',

  inputSchema: z.object({
    param: z.string().describe('Parameter description'),
  }),

  execute: async ({ param }) => {
    // Your implementation
    return { result: 'value' };
  },
});
```

2. Export it in `tools/index.js`:

```javascript
import { myTool } from './myTool';

export const tools = {
  // ... existing tools
  my_tool: myTool,
};
```

## Best Practices

1. **Tool Descriptions**: Write clear, specific descriptions to help the AI know when to use the tool
2. **Input Validation**: Always use Zod schemas for type safety
3. **Error Handling**: Throw descriptive errors in execute functions
4. **Return Format**: Return structured objects with consistent formats
5. **Documentation**: Add JSDoc comments to all functions

## Troubleshooting

### Tool not being called
- Check tool description is clear and specific
- Ensure system prompt mentions the tool's purpose
- Verify input schema matches expected parameters

### API errors
- Verify `ANTHROPIC_API_KEY` is set correctly
- Check API key has proper permissions
- Review Anthropic API status

### Streaming issues
- Ensure using `streamText` not `generateText`
- Return `result.toDataStreamResponse()`
- Frontend must use `useChat` from 'ai/react'
