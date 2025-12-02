'use client';

import { useChat } from '@ai-sdk/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { useConversation } from './ConversationContext';

const suggestionBlockRegex = /<SUGGESTIONS>([\s\S]*?)<\/SUGGESTIONS>/;

function stripSuggestions(text = '') {
  return text.replace(suggestionBlockRegex, '').trim();
}

function normalizeGroups(rawGroups) {
  if (!Array.isArray(rawGroups)) return [];
  return rawGroups
    .map(group => ({
      for: group?.for || '',
      options: Array.isArray(group?.options) ? group.options : [],
    }))
    .filter(group => group.options.length > 0);
}

function extractSuggestions(message) {
  if (!message?.parts) return null;
  const textContent = message.parts
    .filter(p => p.type === 'text' || p.type === 'reasoning')
    .map(p => p.text || '')
    .join('\n');

  if (!textContent) return null;
  const match = textContent.match(suggestionBlockRegex);
  if (!match) return null;

  try {
    const parsed = JSON.parse(match[1]);
    const segments = normalizeGroups(parsed?.segments);
    const attributes = normalizeGroups(parsed?.attributes);
    const other = Array.isArray(parsed?.other)
      ? parsed.other
          .map(item => ({ text: item?.text || '' }))
          .filter(item => item.text)
      : [];
    if (segments.length === 0 && attributes.length === 0 && other.length === 0) return null;
    return { segments, attributes, other };
  } catch (err) {
    console.warn('Failed to parse suggestions block:', err);
    return null;
  }
}

function buildSuggestionKey(suggestion, type, messageId, groupFor = '') {
  const base = `${messageId || 'unknown'}:${type}:${groupFor || 'group'}`;
  if (type === 'segment') return `${base}:${suggestion.key || 'unknown'}`;
  if (type === 'attribute') {
    return `${base}:${suggestion.id || 'unknown'}:${suggestion.operator || 'op'}:${JSON.stringify(suggestion.value)}`;
  }
  return `${base}:${suggestion.text || 'other'}`;
}

function formatSuggestionText(suggestion, type) {
  if (type === 'segment') {
    return `Use segment "${suggestion.key}"`;
  }
  if (type === 'attribute') {
    const operator = suggestion.operator || '==';
    const value =
      suggestion.value !== undefined
        ? typeof suggestion.value === 'string'
          ? `"${suggestion.value}"`
          : JSON.stringify(suggestion.value)
        : '___';
    return `Use attribute filter ${suggestion.id} ${operator} ${value}`;
  }
  return suggestion.text || '';
}

/**
 * ChatInterface Component
 *
 * A beautiful, responsive chat interface that integrates with the AI SDK.
 * Features:
 * - Real-time streaming responses
 * - Auto-scrolling message list
 * - Tool call indicators
 * - Clean, modern UI
 */
// Inner component that gets re-created when conversation changes
function ChatInterfaceInner({ conversationId, setConversationId, pendingInitialInputRef }) {

  // Always call useChat but wrap the component to force re-initialization
  const { messages, sendMessage, status, setMessages } = useChat({
    api: '/api/chat',
    id: conversationId,
    body: { conversationId: conversationId },
  });

  const [input, setInput] = useState('');
  const [expandedTools, setExpandedTools] = useState({});
  const [usedSuggestionKeys, setUsedSuggestionKeys] = useState(new Set());
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const inputRef = useRef(null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const isBusy = status === 'submitted' || status === 'streaming';
  const isThinking = status === 'submitted';
  const processedToolCalls = useRef(new Set());
  const isCreatingConversation = useRef(false);
  const hasNavigatedRef = useRef(false);
  const titleRequestedRef = useRef(new Set());

  const ensureConversation = useCallback(
    async initialText => {
      if (conversationId) return conversationId;

      // Check if already creating to prevent race condition
      if (isCreatingConversation.current) {
        console.log('Already creating conversation, skipping...');
        return null;
      }

      isCreatingConversation.current = true;

      try {
        console.log('Creating new conversation...');
        const res = await fetch('/api/conversations/quick', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ promptText: initialText || '' }),
        });

        if (!res.ok) {
          const errorData = await res.json();
          console.error('API error response:', errorData);
          throw new Error(errorData.error || 'Failed to create conversation');
        }

        const data = await res.json();
        console.log('Conversation created:', data);

        if (!data.conversationId) {
          throw new Error('No conversation ID returned');
        }

        // Trigger conversations list refresh
        window.dispatchEvent(new Event('refresh-conversations'));

        return data.conversationId;
      } catch (err) {
        console.error('Conversation creation failed with error:', err.message, err);
        return null;
      } finally {
        isCreatingConversation.current = false;
      }
    },
    [conversationId]
  );

  // Reset navigation flag when switching conversations
  useEffect(() => {
    hasNavigatedRef.current = false;
  }, [conversationId]);

  // Send pending message when conversation is ready
  useEffect(() => {
    const pendingText = pendingInitialInputRef?.current;
    if (pendingText && conversationId && typeof sendMessage === 'function') {
      // Small delay to ensure everything is initialized
      const timer = setTimeout(() => {
        console.log('Sending pending message:', pendingText);
        sendMessage({ text: pendingText });
        pendingInitialInputRef.current = '';
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [conversationId, pendingInitialInputRef, sendMessage]);

  // Auto-scroll: Only on initial load and when new messages arrive
  const prevMessageCountRef = useRef(0);

  // Scroll to bottom on initial page load
  useEffect(() => {
    if (messagesContainerRef.current && messages.length > 0 && prevMessageCountRef.current === 0) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [messages]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > prevMessageCountRef.current && prevMessageCountRef.current > 0) {
      // New message arrived
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevMessageCountRef.current = messages.length;
  }, [messages]);

  // Detect when user is manually scrolling
  const handleScroll = useCallback(() => {
    if (!messagesContainerRef.current) return;

    const container = messagesContainerRef.current;
    const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 50;

    // Only track if user has scrolled away from bottom
    if (!isAtBottom) {
      setIsUserScrolling(true);
    } else {
      setIsUserScrolling(false);
    }
  }, []);

  // After first exchange completes, persist immediately and then navigate to the conversation route
  useEffect(() => {
    if (!conversationId) return;
    const hasUserMessage = messages.some(m => m.role === 'user');
    const shouldNavigate = hasUserMessage && status === 'ready' && !hasNavigatedRef.current;

    if (!shouldNavigate) return;

    hasNavigatedRef.current = true;

    const flushAndNavigate = async () => {
      // Save immediately so history is available after navigation/remount
      try {
        await fetch(`/api/conversations/${conversationId}/save-messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages }),
        });
      } catch (err) {
        console.error('Immediate save before navigation failed:', err);
      }

      setConversationId(conversationId); // navigate to /:id
    };

    flushAndNavigate();
  }, [conversationId, messages, setConversationId, status]);

  // Generate title out-of-band once we have at least one user message
  useEffect(() => {
    if (!conversationId) return;
    if (titleRequestedRef.current.has(conversationId)) return;

    const firstUserMessage = messages.find(m => m.role === 'user');
    if (!firstUserMessage) return;

    const text =
      firstUserMessage?.parts?.[0]?.text ||
      firstUserMessage?.content ||
      firstUserMessage?.text ||
      '';

    titleRequestedRef.current.add(conversationId);
    fetch(`/api/conversations/${conversationId}/title`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ promptText: text }),
    }).catch(err => console.error('Title generation failed:', err));
  }, [conversationId, messages]);

  // Save messages to database when they change (including AI responses)
  useEffect(() => {
    const saveMessages = async () => {
      // Only save if we have a valid conversation and messages
      if (!conversationId || messages.length === 0) {
        return;
      }

      // Don't save while AI is actively responding
      if (status === 'streaming' || status === 'submitted') {
        return;
      }

      try {
        const res = await fetch(`/api/conversations/${conversationId}/save-messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages }),
        });

        if (!res.ok) {
          console.error('Failed to save messages');
        }
      } catch (err) {
        console.error('Error saving messages:', err);
      }
    };

    // Debounce the save to avoid too many requests
    const timeoutId = setTimeout(saveMessages, 1000);
    return () => clearTimeout(timeoutId);
  }, [messages, conversationId, status]);

  // Load existing history when switching conversations
  useEffect(() => {
    const loadHistory = async () => {
      if (!conversationId) return;
      try {
        const res = await fetch(`/api/conversations/${conversationId}/messages`);
        const data = await res.json();
        if (data.success && Array.isArray(data.messages)) {
          setMessages(data.messages);
        }
      } catch (err) {
        console.error('History load failed:', err);
      }
    };
    loadHistory();
  }, [conversationId, setMessages]);

  const markdownComponents = useMemo(
    () => ({
      p: props => <p className="mb-3 last:mb-0 text-[15px] leading-6" {...props} />,
      strong: props => <strong className="font-semibold text-white" {...props} />,
      em: props => <em className="text-white/90" {...props} />,
      ul: props => <ul className="list-disc list-inside space-y-2 text-[15px]" {...props} />,
      ol: props => <ol className="list-decimal list-inside space-y-2 text-[15px]" {...props} />,
      li: props => <li className="leading-6" {...props} />,
      code: props => (
        <code
          className="px-2 py-1 rounded-md bg-black/30 text-[13px] font-mono border border-white/10"
          {...props}
        />
      ),
      pre: props => (
        <pre
          className="bg-black/40 border border-white/10 rounded-lg p-3 text-[13px] font-mono overflow-x-auto"
          {...props}
        />
      ),
      a: props => (
        <a
          className="text-[#8da2ff] underline underline-offset-2 hover:text-white"
          target="_blank"
          rel="noreferrer"
          {...props}
        />
      ),
      blockquote: props => (
        <blockquote
          className="border-l-4 border-white/20 pl-3 text-white/80 italic"
          {...props}
        />
      ),
    }),
    []
  );

  // Notify other components when update_tree succeeds so they can refetch
  const notifyTreeUpdated = useCallback(
    toolCallId => {
      if (typeof window === 'undefined') return;
      const key = `${conversationId || 'default'}:${toolCallId}`;
      if (processedToolCalls.current.has(key)) return;
      processedToolCalls.current.add(key);
      window.dispatchEvent(
        new CustomEvent('tree-updated', {
          detail: {
            conversationId,
            toolCallId,
            at: Date.now(),
          },
        })
      );
    },
    [conversationId]
  );

  useEffect(() => {
    // Look for successful update_tree tool results
    messages.forEach(msg => {
      if (msg.role !== 'assistant') return;
      (msg.parts || []).forEach(part => {
        const isTool =
          part.type?.startsWith('tool-') || part.type === 'dynamic-tool';
        if (!isTool) return;
        const toolName =
          part.type === 'dynamic-tool'
            ? part.toolName
            : part.type.replace('tool-', '');
        if (toolName !== 'update_tree') return;
        const output =
          part.output !== undefined
            ? part.output
            : part.result !== undefined
              ? part.result
              : undefined;
        if (output && output.ok) {
          notifyTreeUpdated(part.toolCallId ?? msg.id);
        }
      });
    });
  }, [messages, notifyTreeUpdated]);

  const handleSuggestionClick = useCallback(
    (suggestion, type, messageId) => {
      const nextText = formatSuggestionText(suggestion, type).trim();

      setInput(prev => {
        const trimmedPrev = prev.trim();
        // Avoid duplicating the same suggestion
        if (trimmedPrev.includes(nextText)) return prev;
        if (!trimmedPrev) return nextText;
        // Append with a separator to preserve prior choices
        return `${trimmedPrev}\n${nextText}`;
      });

      // Keep focus for fast multi-select flows
      inputRef.current?.focus();

      const key = buildSuggestionKey(suggestion, type, messageId);
      setUsedSuggestionKeys(prev => {
        const next = new Set(prev);
        next.add(key);
        return next;
      });
    },
    []
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header - Fixed at top */}
      <div className="flex-shrink-0 px-6 py-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm uppercase tracking-[0.25em] text-white/70">
              AI Agent
            </div>
            <h1 className="text-2xl font-semibold text-white">Segments & Attributes Copilot</h1>
          </div>
          <div className="hidden md:flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1 text-xs">
            <span className={`h-2.5 w-2.5 rounded-full ${isBusy ? 'bg-amber-300 animate-pulse' : 'bg-emerald-300'}`} />
            {isBusy ? 'Thinking' : 'Ready'}
          </div>
        </div>
      </div>

      {/* Chat container - Flexible height with proper scrolling */}
      <div className="relative flex-1 min-h-0 overflow-hidden flex flex-col">
        <div className="relative flex flex-col h-full">
          {/* Messages area - Scrollable */}
          <div
            ref={messagesContainerRef}
            onScroll={handleScroll}
            className="flex-1 min-h-0 overflow-y-auto px-6 py-4 scrollbar-hide"
          >
            <div className="space-y-4">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-white/60">
                <div className="h-14 w-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                  <svg
                    className="w-7 h-7 text-white/70"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0-3.866 3.582-7 8-7m0 0l-3 3m3-3l-3-3M5 6h5m-5 4h9m-9 4h7m-7 4h6" />
                  </svg>
                </div>
                <p className="text-lg font-medium">Ask anything about your segments or attributes.</p>
                <p className="text-sm text-white/50 mt-1">Try: “List all segments” or “Show me the preferences attribute.”</p>
              </div>
            )}

            {messages.map(message => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[78%] rounded-2xl px-4 py-3 ${
                    message.role === 'user'
                      ? 'bg-[#5645ee] text-white'
                      : 'bg-white/5 text-white'
                  }`}
                >
                  <div
                    className={`text-[11px] font-semibold mb-1 uppercase tracking-wide ${
                      message.role === 'user' ? 'text-white/80' : 'text-white/60'
                    }`}
                  >
                    {message.role === 'user' ? 'You' : 'AI Assistant'}
                  </div>

                  <div className="space-y-3 text-sm leading-6">
                    {(() => {
                      const parts = message.parts || [];
                      const firstToolIndex =
                        message.role === 'assistant'
                          ? parts.findIndex(
                              p => p.type?.startsWith('tool-') || p.type === 'dynamic-tool'
                            )
                          : -1;

                      return parts.map((part, idx) => {
                        const isToolPart =
                          part.type?.startsWith('tool-') || part.type === 'dynamic-tool';

                        if (part.type === 'text' || part.type === 'reasoning') {
                          const cleanedText = stripSuggestions(part.text || '');
                          // Hide text that comes before the first tool call, show text after tools
                          if (firstToolIndex !== -1 && idx < firstToolIndex) return null;
                          if (!cleanedText) return null;
                          return (
                            <ReactMarkdown
                              key={`${message.id}-text-${idx}`}
                              remarkPlugins={[remarkGfm]}
                              components={markdownComponents}
                            >
                              {cleanedText}
                            </ReactMarkdown>
                          );
                        }

                        if (isToolPart) {
                          const toolName =
                            part.type === 'dynamic-tool'
                              ? part.toolName
                              : part.type.replace('tool-', '');
                          const toolKey = part.toolCallId ?? `${message.id}-${idx}`;
                          const expanded = !!expandedTools[toolKey];
                          const toolOutput =
                            part.output !== undefined
                              ? part.output
                              : part.result !== undefined
                                ? part.result
                                : undefined;

                          return (
                            <div
                              key={`${message.id}-tool-${part.toolCallId ?? idx}`}
                              className="text-xs bg-white/10 border border-white/15 rounded-lg px-3 py-2"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setExpandedTools(prev => ({
                                        ...prev,
                                        [toolKey]: !expanded,
                                      }))
                                    }
                                    className="h-6 w-6 flex items-center justify-center rounded-full border border-white/15 text-white/80 hover:bg-white/10 transition"
                                    aria-label={expanded ? 'Hide tool output' : 'Show tool output'}
                                  >
                                    <span className="text-[11px] leading-none">
                                      {expanded ? '▾' : '▸'}
                                    </span>
                                  </button>
                                  <span className="font-mono text-white/80">{toolName}</span>
                                </div>
                                <span className="text-[11px] text-white/60">
                                  {part.state ? part.state.replace(/-/g, ' ') : 'running'}
                                </span>
                              </div>
                              {expanded && (
                                <pre className="mt-2 text-[11px] text-white/80 bg-black/30 rounded p-2 overflow-x-auto">
                                  {toolOutput === undefined
                                    ? 'No tool output yet.'
                                    : typeof toolOutput === 'string'
                                      ? toolOutput
                                      : JSON.stringify(toolOutput, null, 2)}
                                </pre>
                              )}
                            </div>
                          );
                        }

                        return null;
                      });
                    })()}
                  </div>
                  {message.role === 'assistant' && (() => {
                    const suggestions = extractSuggestions(message);
                    if (!suggestions) return null;
                    const hasSuggestions =
                      (suggestions.segments && suggestions.segments.length > 0) ||
                      (suggestions.attributes && suggestions.attributes.length > 0);
                    if (!hasSuggestions) return null;
                    return (
                      <div className="pt-3 mt-2 border-t border-white/5 flex flex-col gap-2">
                        {suggestions.segments?.map((group, gIdx) => (
                          <div key={`seg-group-${message.id}-${gIdx}`} className="flex flex-col gap-1.5">
                            <div className="text-[11px] uppercase tracking-wide text-white/50">
                              Segment alternatives{group.for ? ` for "${group.for}"` : ''}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {group.options.map((sugg, idx) => {
                                const key = buildSuggestionKey(sugg, 'segment', message.id, group.for);
                                const used = usedSuggestionKeys.has(key);
                                return (
                                  <button
                                    key={`seg-${message.id}-${gIdx}-${idx}-${sugg.key}`}
                                    type="button"
                                    onClick={() => handleSuggestionClick(sugg, 'segment', message.id)}
                                    className={`text-xs px-3 py-1.5 rounded-full border border-white/15 bg-white/10 flex items-center gap-2 hover:bg-white/15 transition ${
                                      used ? 'opacity-60' : ''
                                    }`}
                                  >
                                    <span className="text-[10px] font-semibold text-[#10b981] bg-[#10b981]/10 px-1.5 py-0.5 rounded">
                                      SEG
                                    </span>
                                    <span className="text-white/80 truncate max-w-[180px]" title={sugg.key}>
                                      {sugg.key}
                                    </span>
                                    {used && <span className="text-[10px] text-white/60">used</span>}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}

                        {suggestions.attributes?.map((group, gIdx) => (
                          <div key={`attr-group-${message.id}-${gIdx}`} className="flex flex-col gap-1.5">
                            <div className="text-[11px] uppercase tracking-wide text-white/50">
                              Attribute options{group.for ? ` for "${group.for}"` : ''}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {group.options.map((sugg, idx) => {
                                const key = buildSuggestionKey(sugg, 'attribute', message.id, group.for);
                                const used = usedSuggestionKeys.has(key);
                                const label = `${sugg.id} ${sugg.operator || '=='} ${
                                  sugg.value !== undefined ? JSON.stringify(sugg.value) : ''
                                }`;
                                return (
                                  <button
                                    key={`attr-${message.id}-${gIdx}-${idx}-${sugg.id}`}
                                    type="button"
                                    onClick={() => handleSuggestionClick(sugg, 'attribute', message.id)}
                                    className={`text-xs px-3 py-1.5 rounded-full border border-white/15 bg-white/10 flex items-center gap-2 hover:bg-white/15 transition ${
                                      used ? 'opacity-60' : ''
                                    }`}
                                  >
                                    <span className="text-[10px] font-semibold text-[#fbbf24] bg-[#fbbf24]/10 px-1.5 py-0.5 rounded">
                                      ATTR
                                    </span>
                                    <span className="text-white/80 truncate max-w-[220px]" title={label}>
                                      {label}
                                    </span>
                                    {used && <span className="text-[10px] text-white/60">used</span>}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}

                        {suggestions.other?.length > 0 && (
                          <div className="flex flex-col gap-1.5">
                            <div className="text-[11px] uppercase tracking-wide text-white/50">
                              Other
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {suggestions.other.map((sugg, idx) => {
                                const key = buildSuggestionKey(sugg, 'other', message.id, 'other');
                                const used = usedSuggestionKeys.has(key);
                                return (
                                  <button
                                    key={`other-${message.id}-${idx}`}
                                    type="button"
                                    onClick={() => handleSuggestionClick(sugg, 'other', message.id)}
                                    className={`text-xs px-3 py-1.5 rounded-full border border-white/15 bg-white/10 flex items-center gap-2 hover:bg-white/15 transition ${
                                      used ? 'opacity-60' : ''
                                    }`}
                                  >
                                    <span className="text-[10px] font-semibold text-[#60a5fa] bg-[#60a5fa]/10 px-1.5 py-0.5 rounded">
                                      NOTE
                                    </span>
                                    <span className="text-white/80 truncate max-w-[240px]" title={sugg.text}>
                                      {sugg.text}
                                    </span>
                                    {used && <span className="text-[10px] text-white/60">used</span>}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            ))}

            {isThinking && (
              <div className="flex justify-start">
                <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white flex items-center gap-3">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-white/70 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-white/70 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-white/70 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                  <span className="text-sm text-white/70">Thinking...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
            </div>
          </div>


          {/* Input area - Fixed at bottom */}
          <div className="flex-shrink-0 border-t border-white/5 px-6 py-4">
            <form
              onSubmit={async e => {
                e.preventDefault();
                if (!input.trim()) return;

                // If no conversation exists, create one first
                if (!conversationId) {
                  const id = await ensureConversation(input);
                  if (!id) {
                    console.error('Failed to create conversation');
                    return;
                  }
                  // Keep component mounted, set ID without navigating, and queue the first message
                  pendingInitialInputRef.current = input;
                  setConversationId(id, { navigate: false });
                  setInput('');

                  // The useEffect will handle sending the message once conversationId is set
                } else {
                  // Conversation exists, send message directly
                  sendMessage({ text: input });
                  setInput('');
                  // Auto-scroll will happen via the message effect
                }
              }}
              className="flex gap-3 items-center"
            >
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="Ask me anything about segments or attributes..."
                  disabled={isBusy}
                  ref={inputRef}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 pr-12 text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white/20 disabled:opacity-60"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 text-xs">
                  ↵
                </div>
              </div>
              <button
                type="submit"
                disabled={isBusy || !input.trim()}
                className="px-5 py-3 rounded-2xl font-semibold bg-gradient-to-r from-[#6d5df5] to-[#5645ee] text-white shadow-lg shadow-[#5645ee]/40 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isBusy ? (
                  <svg
                    className="animate-spin h-5 w-5"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                ) : (
                  'Send'
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

// Wrapper component for chat UI
export default function ChatInterface() {
  const { conversationId, setConversationId } = useConversation();
  const pendingInitialInputRef = useRef('');

  return (
    <ChatInterfaceInner
      conversationId={conversationId}
      setConversationId={setConversationId}
      pendingInitialInputRef={pendingInitialInputRef}
    />
  );
}
