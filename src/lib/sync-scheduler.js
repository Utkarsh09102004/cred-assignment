import { syncSegments } from './segment-sync-service.js';

let started = false;
let running = false;
let intervalId = null;

function getIntervalMs() {
  const fromEnv = Number(process.env.SYNC_INTERVAL_MS || '');
  if (!Number.isNaN(fromEnv) && fromEnv > 0) return fromEnv;
  return 60 * 60 * 1000; // default: 1 hour
}

async function runOnce() {
  if (running) return;
  running = true;
  try {
    await syncSegments();
  } catch (err) {
    console.error('Scheduled segment sync failed:', err);
  } finally {
    running = false;
  }
}

export function startSyncScheduler() {
  if (started || (typeof globalThis !== 'undefined' && globalThis.__segmentSyncSchedulerStarted)) {
    return;
  }
  started = true;
  if (typeof globalThis !== 'undefined') {
    globalThis.__segmentSyncSchedulerStarted = true;
  }

  const intervalMs = getIntervalMs();
  // Kick off immediately, then schedule hourly
  runOnce();
  intervalId = setInterval(runOnce, intervalMs);
  return intervalId;
}

export function stopSyncScheduler() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  started = false;
  running = false;
  if (typeof globalThis !== 'undefined') {
    delete globalThis.__segmentSyncSchedulerStarted;
  }
}
