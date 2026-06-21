import { ref, onMounted, onUnmounted } from 'vue';
import type { SignalMessage } from '@edge-mesh/shared';
import { usePeerStore } from '../stores/peer.js';

export interface SignalingOptions {
  /** If false, skip auto-connect on mount and auto-disconnect on unmount. Default: true */
  autoConnect?: boolean;
}

export function useSignaling(roomId: string, options: SignalingOptions = {}) {
  const { autoConnect = true } = options;
  const peer = usePeerStore();
  const connected = ref(false);
  const peers = ref<{ peerId: string; name: string; isOnline: boolean }[]>([]);

  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let pingTimer: ReturnType<typeof setInterval> | null = null;
  let reconnectDelay = 3000;
  const MAX_RECONNECT_DELAY = 30000;
  const PING_INTERVAL = 25000;
  const messageHandlers: ((msg: SignalMessage) => void)[] = [];

  function connect() {
    if (ws) {
      ws.close();
      ws = null;
    }

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const signalingUrl = import.meta.env.VITE_SIGNALING_URL || `${protocol}//${location.host}`;
    const url = `${signalingUrl}/api/signal/${roomId}`;

    ws = new WebSocket(url);

    ws.onopen = () => {
      connected.value = true;
      reconnectDelay = 3000; // Reset backoff on successful connection

      // Register this peer with the signaling server
      send({
        type: 'register',
        peerId: peer.peerId,
        peerName: peer.name,
      });

      // Start keepalive ping
      startPing();
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as SignalMessage;
        handleMessage(msg);
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      connected.value = false;
      stopPing();
      if (autoConnect) scheduleReconnect();
    };

    ws.onerror = () => {
      connected.value = false;
    };
  }

  function startPing() {
    stopPing();
    pingTimer = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, PING_INTERVAL);
  }

  function stopPing() {
    if (pingTimer) {
      clearInterval(pingTimer);
      pingTimer = null;
    }
  }

  function handleMessage(msg: SignalMessage) {
    if (msg.type === 'peer-list') {
      peers.value = msg.peers.filter(
        (p) => p.peerId !== peer.peerId,
      );
    } else if (msg.type === 'peer-joined') {
      const p = msg.peer;
      if (p.peerId !== peer.peerId) {
        const existing = peers.value.findIndex((x) => x.peerId === p.peerId);
        if (existing >= 0) {
          peers.value[existing] = p;
        } else {
          peers.value.push(p);
        }
      }
    } else if (msg.type === 'peer-left') {
      peers.value = peers.value.filter((p) => p.peerId !== msg.peerId);
    }

    // Notify all handlers
    for (const handler of messageHandlers) {
      handler(msg);
    }
  }

  function send(msg: SignalMessage | Record<string, unknown>) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  function onMessage(handler: (msg: SignalMessage) => void) {
    messageHandlers.push(handler);
    return () => {
      const idx = messageHandlers.indexOf(handler);
      if (idx >= 0) messageHandlers.splice(idx, 1);
    };
  }

  function scheduleReconnect() {
    if (reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, reconnectDelay);
    // Exponential backoff: 3s → 6s → 12s → 24s → 30s (max)
    reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
  }

  function disconnect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    stopPing();
    if (ws) {
      ws.close();
      ws = null;
    }
    connected.value = false;
    reconnectDelay = 3000; // Reset backoff
  }

  if (autoConnect) {
    onMounted(() => {
      connect();
    });

    onUnmounted(() => {
      disconnect();
    });
  }

  return { connected, peers, send, onMessage, connect, disconnect };
}
