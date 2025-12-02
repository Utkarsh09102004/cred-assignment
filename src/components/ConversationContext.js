'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

const ConversationContext = createContext({
  conversationId: null,
  setConversationId: () => {},
});

export function ConversationProvider({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [conversationId, setConversationIdState] = useState(null);

  // Sync context with URL (expects / or /:conversationId)
  useEffect(() => {
    const slug = pathname?.slice(1) || '';
    setConversationIdState(slug || null);
  }, [pathname]);

  const setConversationId = (id, options = { navigate: true }) => {
    const { navigate = true } = options || {};

    if (!id) {
      setConversationIdState(null);
      if (navigate) {
        router.replace('/');
      }
      return;
    }

    setConversationIdState(id);
    if (navigate) {
      router.replace(`/${id}`);
    }
  };

  const value = useMemo(
    () => ({
      conversationId,
      setConversationId,
    }),
    [conversationId]
  );

  return (
    <ConversationContext.Provider value={value}>
      {children}
    </ConversationContext.Provider>
  );
}

export function useConversation() {
  return useContext(ConversationContext);
}
