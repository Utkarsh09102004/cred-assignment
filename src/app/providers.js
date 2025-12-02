'use client';

import { ConversationProvider } from '@/components/ConversationContext';

export function Providers({ children }) {
  return <ConversationProvider>{children}</ConversationProvider>;
}
