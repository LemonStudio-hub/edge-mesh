import { defineStore } from 'pinia';
import { ref, onMounted, onUnmounted } from 'vue';
import { apiUrl } from '../utils/api.js';

const STORAGE_KEY = 'edge-mesh-peer-id';

export const usePeerStore = defineStore('peer', () => {
  const peerId = ref('');
  const name = ref('');
  const isOnline = ref(false);
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  function generatePeerId(): string {
    const array = new Uint8Array(8);
    crypto.getRandomValues(array);
    return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
  }

  function init() {
    // Reuse peer ID from sessionStorage if available (survives page refresh, not tab close)
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored && stored.length === 16) {
      peerId.value = stored;
    } else {
      peerId.value = generatePeerId();
      sessionStorage.setItem(STORAGE_KEY, peerId.value);
    }
    name.value = `Peer-${peerId.value.slice(0, 6)}`;
    setOnline();
  }

  function setOnline() {
    if (!peerId.value) return; // Guard: don't go online before init
    isOnline.value = true;
    if (!heartbeatTimer) {
      heartbeatTimer = setInterval(sendHeartbeat, 30_000);
    }
  }

  function setOffline() {
    isOnline.value = false;
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  async function sendHeartbeat() {
    if (!isOnline.value || !peerId.value) return;
    try {
      await fetch(apiUrl('/api/posts/heartbeat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ peerId: peerId.value }),
      });
    } catch {
      // Silently fail — will retry on next heartbeat
    }
  }

  function handleVisibilityChange() {
    if (document.visibilityState === 'hidden') {
      setOffline();
    } else {
      setOnline();
    }
  }

  function handleBeforeUnload() {
    setOffline();
  }

  onMounted(() => {
    init();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
  });

  onUnmounted(() => {
    setOffline();
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('beforeunload', handleBeforeUnload);
  });

  return { peerId, name, isOnline, setOnline, setOffline };
});
