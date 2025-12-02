'use client';

import SyncLoader from '@/components/SyncLoader';
import ChatInterface from '@/components/ChatInterface';
import LeftSidebar from '@/components/LeftSidebar';
import RightSidebar from '@/components/RightSidebar';
import { useState } from 'react';

export default function Home() {
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentPage, setCurrentPage] = useState(null);
  const [totalPages, setTotalPages] = useState(null);
  const [syncStatus, setSyncStatus] = useState('idle');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  async function handleSyncNow() {
    setSyncing(true);
    setProgress(0);
    setCurrentPage(null);
    setTotalPages(null);
    setSyncStatus('syncing');

    try {
      const response = await fetch('/api/sync-segments', {
        method: 'POST',
      });

      const result = await response.json();

      if (result.success) {
        setProgress(100);
        setSyncStatus('completed');

        // Show completion briefly then hide everything
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Reset status to hide all UI elements except the button
        setSyncStatus('idle');
        setProgress(0);
      } else {
        throw new Error(result.error || 'Sync failed');
      }
    } catch (error) {
      console.error('Sync error:', error);
      alert(`Sync failed: ${error.message}`);
      setSyncStatus('error');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="h-screen flex bg-[#11101a] text-white relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_20%_20%,#242132_0%,transparent_35%),radial-gradient(circle_at_80%_0%,#181722_0%,transparent_30%),linear-gradient(135deg,#0d0c14,#141322)]" />
      <LeftSidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        onSyncNow={handleSyncNow}
        syncing={syncing}
        syncStatus={syncStatus}
      />

      <main className="flex-1 flex relative z-10 min-w-0">
        <div className="flex-1 p-6 flex flex-col min-w-0">
          <ChatInterface />
        </div>
        <RightSidebar />
      </main>

      <SyncLoader
        isVisible={syncing}
        progress={progress}
        currentPage={currentPage}
        totalPages={totalPages}
        status={syncStatus}
      />
    </div>
  );
}
