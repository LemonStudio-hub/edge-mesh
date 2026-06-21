import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useSessionStore } from '@/stores/session.js';
import { ref } from 'vue';

// Mock composables
vi.mock('@/composables/useSignaling.js', () => ({
  useSignaling: vi.fn(() => ({
    connected: ref(false),
    peers: ref([]),
    send: vi.fn(),
    onMessage: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
  })),
}));

vi.mock('@/composables/useWebRTC.js', () => ({
  useWebRTC: vi.fn(() => ({
    connectionState: ref('new'),
    dataChannel: ref(null),
    remotePeerId: ref(''),
    connect: vi.fn(),
    accept: vi.fn(),
    onDataChannel: vi.fn(),
    onData: vi.fn(),
    disconnect: vi.fn(),
  })),
}));

describe('useSessionStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('starts with empty state', () => {
    const store = useSessionStore();
    expect(store.connectedPeerId).toBe('');
    expect(store.connectedPeerName).toBe('');
    expect(store.connectionStartTime).toBe(0);
    expect(store.signalingConnected).toBe(false);
    expect(store.webrtcConnectionState).toBe('new');
    expect(store.webrtcDataChannel).toBeNull();
  });

  describe('init', () => {
    it('stores peer info and marks connection start time', () => {
      const store = useSessionStore();
      const before = Date.now();

      const mockSig = {
        connected: ref(true),
        peers: ref([]),
        send: vi.fn(),
        onMessage: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
      };
      const mockRtc = {
        connectionState: ref('connecting' as const),
        dataChannel: ref(null),
        remotePeerId: ref(''),
        connect: vi.fn(),
        accept: vi.fn(),
        onDataChannel: vi.fn(),
        onData: vi.fn(),
        disconnect: vi.fn(),
      };

      store.init(mockSig as any, mockRtc as any, 'peer-123', 'Alice');

      expect(store.connectedPeerId).toBe('peer-123');
      expect(store.connectedPeerName).toBe('Alice');
      expect(store.connectionStartTime).toBeGreaterThanOrEqual(before);
      expect(store.signalingConnected).toBe(true);
      expect(store.webrtcConnectionState).toBe('connecting');
    });
  });

  describe('disconnect', () => {
    it('clears all state', () => {
      const store = useSessionStore();
      const mockSig = {
        connected: ref(true),
        peers: ref([]),
        send: vi.fn(),
        onMessage: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
      };
      const mockRtc = {
        connectionState: ref('connected' as const),
        dataChannel: ref(null),
        remotePeerId: ref(''),
        connect: vi.fn(),
        accept: vi.fn(),
        onDataChannel: vi.fn(),
        onData: vi.fn(),
        disconnect: vi.fn(),
      };

      store.init(mockSig as any, mockRtc as any, 'peer-123', 'Alice');
      store.disconnect();

      expect(store.connectedPeerId).toBe('');
      expect(store.connectedPeerName).toBe('');
      expect(store.connectionStartTime).toBe(0);
      expect(store.signalingConnected).toBe(false);
      expect(store.webrtcConnectionState).toBe('disconnected');
      expect(store.webrtcDataChannel).toBeNull();
    });

    it('calls disconnect on signaling and webrtc composables', () => {
      const store = useSessionStore();
      const sigDisconnect = vi.fn();
      const rtcDisconnect = vi.fn();

      const mockSig = {
        connected: ref(true),
        peers: ref([]),
        send: vi.fn(),
        onMessage: vi.fn(),
        connect: vi.fn(),
        disconnect: sigDisconnect,
      };
      const mockRtc = {
        connectionState: ref('connected' as const),
        dataChannel: ref(null),
        remotePeerId: ref(''),
        connect: vi.fn(),
        accept: vi.fn(),
        onDataChannel: vi.fn(),
        onData: vi.fn(),
        disconnect: rtcDisconnect,
      };

      store.init(mockSig as any, mockRtc as any, 'p', 'P');
      store.disconnect();

      expect(rtcDisconnect).toHaveBeenCalled();
      expect(sigDisconnect).toHaveBeenCalled();
    });
  });

  describe('$reset', () => {
    it('resets to initial values without calling composables', () => {
      const store = useSessionStore();
      const mockSig = {
        connected: ref(true),
        peers: ref([]),
        send: vi.fn(),
        onMessage: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
      };
      const mockRtc = {
        connectionState: ref('connected' as const),
        dataChannel: ref(null),
        remotePeerId: ref(''),
        connect: vi.fn(),
        accept: vi.fn(),
        onDataChannel: vi.fn(),
        onData: vi.fn(),
        disconnect: vi.fn(),
      };

      store.init(mockSig as any, mockRtc as any, 'p', 'P');
      store.$reset();

      expect(store.connectedPeerId).toBe('');
      expect(store.connectedPeerName).toBe('');
      expect(store.webrtcConnectionState).toBe('new');
    });
  });

  describe('isConnected', () => {
    it('is false when connectionState is new', () => {
      const store = useSessionStore();
      expect(store.isConnected).toBe(false);
    });

    it('is true when connectionState is connected', () => {
      const store = useSessionStore();
      const mockSig = {
        connected: ref(true),
        peers: ref([]),
        send: vi.fn(),
        onMessage: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
      };
      const mockRtc = {
        connectionState: ref('connected' as const),
        dataChannel: ref(null),
        remotePeerId: ref(''),
        connect: vi.fn(),
        accept: vi.fn(),
        onDataChannel: vi.fn(),
        onData: vi.fn(),
        disconnect: vi.fn(),
      };

      store.init(mockSig as any, mockRtc as any, 'p', 'P');
      // The syncInterval sets webrtcConnectionState from rtc.connectionState.value
      // which is 'connected'
      expect(store.isConnected).toBe(true);
    });
  });
});
