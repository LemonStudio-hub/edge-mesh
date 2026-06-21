import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

// Ensure crypto.randomUUID is available (happy-dom may not provide it)
if (!globalThis.crypto.randomUUID) {
  let counter = 0;
  (globalThis.crypto as any).randomUUID = () => `00000000-0000-0000-0000-${String(counter++).padStart(12, '0')}`;
}

// Mock WebRTC APIs before importing the composable
const mockDataChannel = {
  label: 'edge-mesh-transfer',
  binaryType: 'arraybuffer' as BinaryType,
  readyState: 'open',
  onopen: null as (() => void) | null,
  onclose: null as (() => void) | null,
  onmessage: null as ((event: MessageEvent) => void) | null,
  send: vi.fn(),
  close: vi.fn(),
};

const mockPeerConnection = {
  connectionState: 'new',
  localDescription: { type: 'offer', sdp: 'mock-sdp' },
  onicecandidate: null as ((event: RTCPeerConnectionIceEvent) => void) | null,
  onconnectionstatechange: null as (() => void) | null,
  ondatachannel: null as ((event: RTCDataChannelEvent) => void) | null,
  createDataChannel: vi.fn(() => mockDataChannel),
  createOffer: vi.fn().mockResolvedValue({ type: 'offer', sdp: 'mock-offer-sdp' }),
  createAnswer: vi.fn().mockResolvedValue({ type: 'answer', sdp: 'mock-answer-sdp' }),
  setLocalDescription: vi.fn().mockResolvedValue(undefined),
  setRemoteDescription: vi.fn().mockResolvedValue(undefined),
  addIceCandidate: vi.fn().mockResolvedValue(undefined),
  close: vi.fn(),
};

// Set up globals
(globalThis as any).RTCPeerConnection = vi.fn(() => mockPeerConnection);
(globalThis as any).RTCSessionDescription = vi.fn((init: any) => init);
(globalThis as any).RTCIceCandidate = vi.fn((init: any) => init);
(globalThis as any).WebSocket = vi.fn();

import { useWebRTC } from '@/composables/useWebRTC.js';

function createMockSignaling() {
  const send = vi.fn();
  const handlers: ((msg: any) => void)[] = [];
  const onMessage = vi.fn((handler: (msg: any) => void) => {
    handlers.push(handler);
    return () => {
      const idx = handlers.indexOf(handler);
      if (idx >= 0) handlers.splice(idx, 1);
    };
  });
  return { send, onMessage, handlers };
}

describe('useWebRTC', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActivePinia(createPinia());
    mockPeerConnection.connectionState = 'new';
    mockDataChannel.readyState = 'open';
  });

  describe('initial state', () => {
    it('starts with connectionState new', () => {
      const sig = createMockSignaling();
      const rtc = useWebRTC(sig.send, sig.onMessage, { autoCleanup: false });
      expect(rtc.connectionState.value).toBe('new');
    });

    it('starts with null dataChannel', () => {
      const sig = createMockSignaling();
      const rtc = useWebRTC(sig.send, sig.onMessage, { autoCleanup: false });
      expect(rtc.dataChannel.value).toBeNull();
    });

    it('starts with empty remotePeerId', () => {
      const sig = createMockSignaling();
      const rtc = useWebRTC(sig.send, sig.onMessage, { autoCleanup: false });
      expect(rtc.remotePeerId.value).toBe('');
    });
  });

  describe('connect', () => {
    it('creates a peer connection and data channel', async () => {
      const sig = createMockSignaling();
      const rtc = useWebRTC(sig.send, sig.onMessage, { autoCleanup: false });

      await rtc.connect('remote-peer');

      expect(rtc.remotePeerId.value).toBe('remote-peer');
      expect(rtc.connectionState.value).toBe('connecting');
      expect(mockPeerConnection.createDataChannel).toHaveBeenCalledWith(
        'edge-mesh-transfer',
        { ordered: true },
      );
    });

    it('creates and sends an SDP offer', async () => {
      const sig = createMockSignaling();
      const rtc = useWebRTC(sig.send, sig.onMessage, { autoCleanup: false });

      await rtc.connect('remote-peer');

      expect(mockPeerConnection.createOffer).toHaveBeenCalled();
      expect(mockPeerConnection.setLocalDescription).toHaveBeenCalled();
      expect(sig.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'offer',
          to: 'remote-peer',
          sdp: { type: 'offer', sdp: 'mock-offer-sdp' },
        }),
      );
    });

    it('registers a signaling message handler', async () => {
      const sig = createMockSignaling();
      const rtc = useWebRTC(sig.send, sig.onMessage, { autoCleanup: false });

      await rtc.connect('remote-peer');

      expect(sig.onMessage).toHaveBeenCalled();
    });
  });

  describe('accept', () => {
    it('sets remote description and creates answer', async () => {
      const sig = createMockSignaling();
      const rtc = useWebRTC(sig.send, sig.onMessage, { autoCleanup: false });

      const offerSdp = { type: 'offer' as RTCSdpType, sdp: 'remote-offer' };
      await rtc.accept(offerSdp, 'caller-peer');

      expect(rtc.remotePeerId.value).toBe('caller-peer');
      expect(mockPeerConnection.setRemoteDescription).toHaveBeenCalled();
      expect(mockPeerConnection.createAnswer).toHaveBeenCalled();
      expect(mockPeerConnection.setLocalDescription).toHaveBeenCalled();
    });

    it('sends the answer via signaling', async () => {
      const sig = createMockSignaling();
      const rtc = useWebRTC(sig.send, sig.onMessage, { autoCleanup: false });

      await rtc.accept({ type: 'offer' as RTCSdpType, sdp: 'remote-offer' }, 'caller-peer');

      expect(sig.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'answer',
          to: 'caller-peer',
          sdp: { type: 'answer', sdp: 'mock-answer-sdp' },
        }),
      );
    });
  });

  describe('disconnect', () => {
    it('closes peer connection and resets state', async () => {
      const sig = createMockSignaling();
      const rtc = useWebRTC(sig.send, sig.onMessage, { autoCleanup: false });

      await rtc.connect('remote-peer');
      rtc.disconnect();

      expect(mockPeerConnection.close).toHaveBeenCalled();
      expect(rtc.connectionState.value).toBe('disconnected');
      expect(rtc.remotePeerId.value).toBe('');
      expect(rtc.dataChannel.value).toBeNull();
    });

    it('cleans up signaling handler', async () => {
      const sig = createMockSignaling();
      const rtc = useWebRTC(sig.send, sig.onMessage, { autoCleanup: false });

      await rtc.connect('remote-peer');
      const handlerCountBefore = sig.handlers.length;
      rtc.disconnect();

      // The handler should have been removed
      expect(sig.handlers.length).toBeLessThan(handlerCountBefore);
    });
  });

  describe('data channel events', () => {
    it('fires onDataChannel handlers when channel opens', async () => {
      const sig = createMockSignaling();
      const rtc = useWebRTC(sig.send, sig.onMessage, { autoCleanup: false });

      const channelHandler = vi.fn();
      rtc.onDataChannel(channelHandler);

      await rtc.connect('remote-peer');

      // Simulate data channel open
      if (mockDataChannel.onopen) {
        mockDataChannel.onopen();
      }

      expect(channelHandler).toHaveBeenCalled();
      expect(rtc.connectionState.value).toBe('connected');
    });

    it('fires onData handlers on message', async () => {
      const sig = createMockSignaling();
      const rtc = useWebRTC(sig.send, sig.onMessage, { autoCleanup: false });

      const dataHandler = vi.fn();
      rtc.onData(dataHandler);

      await rtc.connect('remote-peer');

      // Simulate message
      const event = new MessageEvent('message', { data: 'test' });
      if (mockDataChannel.onmessage) {
        mockDataChannel.onmessage(event);
      }

      expect(dataHandler).toHaveBeenCalledWith(event);
    });

    it('sets connectionState to disconnected on channel close', async () => {
      const sig = createMockSignaling();
      const rtc = useWebRTC(sig.send, sig.onMessage, { autoCleanup: false });

      await rtc.connect('remote-peer');

      if (mockDataChannel.onclose) {
        mockDataChannel.onclose();
      }

      expect(rtc.connectionState.value).toBe('disconnected');
    });
  });

  describe('signaling message handling', () => {
    it('handles answer message by setting remote description', async () => {
      const sig = createMockSignaling();
      const rtc = useWebRTC(sig.send, sig.onMessage, { autoCleanup: false });

      await rtc.connect('remote-peer');

      // Get the handler that was registered
      const handler = sig.handlers[0];
      expect(handler).toBeDefined();

      // Simulate receiving an answer
      await handler({
        type: 'answer',
        from: 'remote-peer',
        to: '',
        sdp: { type: 'answer', sdp: 'answer-sdp' },
      });

      expect(mockPeerConnection.setRemoteDescription).toHaveBeenCalled();
    });

    it('handles ice-candidate message by adding candidate', async () => {
      const sig = createMockSignaling();
      const rtc = useWebRTC(sig.send, sig.onMessage, { autoCleanup: false });

      await rtc.connect('remote-peer');

      const handler = sig.handlers[0];
      await handler({
        type: 'ice-candidate',
        from: 'remote-peer',
        to: '',
        candidate: { candidate: 'candidate:1 1 UDP ...' },
      });

      expect(mockPeerConnection.addIceCandidate).toHaveBeenCalled();
    });
  });
});
