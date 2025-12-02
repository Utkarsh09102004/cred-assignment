'use client';

import { useEffect, useMemo, useState } from 'react';
import { useConversation } from './ConversationContext';

export default function LeftSidebar({
  collapsed,
  onToggle,
  onSyncNow,
  syncing,
  syncStatus,
}) {
  const { conversationId, setConversationId } = useConversation();
  const [conversations, setConversations] = useState([]);

  const statusLabel = useMemo(() => {
    if (syncing) return 'Syncing...';
    if (syncStatus === 'completed') return 'Synced';
    if (syncStatus === 'error') return 'Retry';
    return 'Sync Segments Now';
  }, [syncStatus, syncing]);

  const fetchConversations = async () => {
    try {
      const res = await fetch('/api/conversations');
      const data = await res.json();
      if (data.success) {
        setConversations(data.conversations || []);
      }
    } catch (err) {
      console.error('Fetch conversations failed:', err);
    }
  };

  useEffect(() => {
    fetchConversations();
    // Only fetch on mount

    // Listen for manual refresh events
    const handleRefresh = () => fetchConversations();
    window.addEventListener('refresh-conversations', handleRefresh);

    return () => {
      window.removeEventListener('refresh-conversations', handleRefresh);
    };
  }, []);

  return (
    <aside
      className={`${
        collapsed ? 'w-16' : 'w-72'
      } bg-[#1a1a22] text-white h-screen flex flex-col border-r border-white/5 transition-all duration-300 ease-in-out relative z-20 shadow-2xl shrink-0`}
    >
      <div className="flex items-center justify-between px-4 py-4 border-b border-white/5">
        {!collapsed && (
          <div className="text-lg font-semibold tracking-tight">Control</div>
        )}
        <button
          onClick={onToggle}
          aria-label="Toggle sidebar"
          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-5 w-5"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="px-3 py-4 space-y-4 flex-shrink-0">
          <button
            onClick={onSyncNow}
            disabled={syncing}
            className={`w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold transition-all duration-200 shadow-lg ${
              syncing
                ? 'bg-[#5645ee]/60 text-white cursor-not-allowed'
                : 'bg-gradient-to-r from-[#6d5df5] to-[#5645ee] hover:shadow-xl'
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`h-5 w-5 ${syncing ? 'animate-spin' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.414 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {!collapsed && <span>{statusLabel}</span>}
          </button>

          {!collapsed && (
            <button
              onClick={() => setConversationId(null)}
              className="w-full rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2 text-sm font-semibold flex items-center justify-center gap-2"
            >
              <span className="text-lg">+</span>
              <span>New Chat</span>
            </button>
          )}
        </div>

        {!collapsed && (
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="px-3 pb-2 mt-6">
              <div className="text-xs uppercase tracking-[0.25em] text-white/50">
                Conversations
              </div>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-hide px-3">
              <div className="space-y-1 pb-4">
                {conversations.map(conv => (
                  <button
                    key={conv.id}
                    onClick={() => setConversationId(conv.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${
                      conv.id === conversationId
                        ? 'bg-[#6d5df5]/20 text-white'
                        : 'text-white/70 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <div className="text-sm font-medium truncate">
                      {conv.title || 'Untitled'}
                    </div>
                  </button>
                ))}
                {conversations.length === 0 && (
                  <div className="text-xs text-white/50 px-3 py-2">No conversations yet.</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
