import { ref, onMounted, onUnmounted } from 'vue';
import type { SignalMessage } from '@edge-mesh/shared';
import { usePeerStore } from '../stores/peer.js';

export function useSignaling(roomId: string) {
  const peer = usePeerStore();
  const connected = ref(false);
  const peers = ref<{ peerId: string; name: string; isOnline: boolean }[]>([]);

  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  const messageHandlers: ((msg: SignalMessage) => void)[] = [];

  function connect() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const signalingUrl = import.meta.env.VITE_SIGNALING_URL || `${protocol}//${location.host}`;
    const url = `${signalingUrl}/api/signal/${roomId}`;

    ws = new WebSocket(url);

    ws.onopen = () => {
      connected.value = true;
      // Register this peer with the signaling server
      send({
        type: 'register' as any,
        peerId: peer.peerId,
        peerName: peer.name,
      } as any);
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
      scheduleReconnect();
    };

    ws.onerror = () => {
      connected.value = false;
    };
  }

  function handleMessage(msg: SignalMessage) {
    if (msg.type === 'peer-list') {
      peers.value = (msg as any).peers.filter(
        (p: any) => p.peerId !== peer.peerId
      );
    } else if (msg.type === 'peer-joined') {
      const p = (msg as any).peer;
      if (p.peerId !== peer.peerId) {
        const existing = peers.value.findIndex((x) => x.peerId === p.peerId);
        if (existing >= 0) {
          peers.value[existing] = p;
        } else {
          peers.value.push(p);
        }
      }
    } else if (msg.type === 'peer-left') {
      peers.value = peers.value.filter((p) => p.peerId !== (msg as any).peerId);
    }

    // Notify all handlers
    for (const handler of messageHandlers) {
      handler(msg);
    }
  }

  function send(msg: SignalMessage | any) {
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
    }, 3000);
  }

  function disconnect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (ws) {
      ws.close();
      ws = null;
    }
    connected.value = false;
  }

  onMounted(() => {
    connect();
  });

  onUnmounted(() => {
    disconnect();
  });

  return { connected, peers, send, onMessage, disconnect };
}
