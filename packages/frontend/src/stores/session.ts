import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useSignaling } from '../composables/useSignaling.js';
import { useWebRTC } from '../composables/useWebRTC.js';
import type { SignalMessage } from '@edge-mesh/shared';

export const useSessionStore = defineStore('session', () => {
  // Composable instances — created lazily in init()
  let signaling: ReturnType<typeof useSignaling> | null = null;
  let webrtc: ReturnType<typeof useWebRTC> | null = null;

  // Connected peer info
  const connectedPeerId = ref('');
  const connectedPeerName = ref('');
  const connectionStartTime = ref(0);

  // Expose reactive state from composables
  const signalingConnected = ref(false);
  const webrtcConnectionState = ref<'new' | 'connecting' | 'connected' | 'disconnected' | 'failed'>('new');
  const webrtcDataChannel = ref<RTCDataChannel | null>(null);

  const isConnected = computed(() => webrtcConnectionState.value === 'connected');

  /** Initialize the session — called when P2P connection is confirmed in HomeView */
  function init(
    sig: ReturnType<typeof useSignaling>,
    rtc: ReturnType<typeof useWebRTC>,
    peerId: string,
    peerName: string,
  ) {
    signaling = sig;
    webrtc = rtc;
    connectedPeerId.value = peerId;
    connectedPeerName.value = peerName;
    connectionStartTime.value = Date.now();

    // Sync reactive state
    signalingConnected.value = sig.connected.value;
    webrtcConnectionState.value = rtc.connectionState.value as any;
    webrtcDataChannel.value = rtc.dataChannel.value;

    // Watch for state changes via the composable's reactive refs
    // Use a simple polling approach since we can't use watch() outside setup
    const syncInterval = setInterval(() => {
      if (!signaling || !webrtc) {
        clearInterval(syncInterval);
        return;
      }
      signalingConnected.value = signaling.connected.value;
      webrtcConnectionState.value = webrtc.connectionState.value as any;
      webrtcDataChannel.value = webrtc.dataChannel.value;
    }, 500);
  }

  /** Get the signaling composable instance */
  function getSignaling() {
    return signaling;
  }

  /** Get the WebRTC composable instance */
  function getWebRTC() {
    return webrtc;
  }

  /** Tear down the entire session */
  function disconnect() {
    webrtc?.disconnect();
    signaling?.disconnect();
    signaling = null;
    webrtc = null;
    connectedPeerId.value = '';
    connectedPeerName.value = '';
    connectionStartTime.value = 0;
    signalingConnected.value = false;
    webrtcConnectionState.value = 'disconnected';
    webrtcDataChannel.value = null;
  }

  /** Reset all state without disconnecting (for cleanup after disconnect is already done) */
  function $reset() {
    signaling = null;
    webrtc = null;
    connectedPeerId.value = '';
    connectedPeerName.value = '';
    connectionStartTime.value = 0;
    signalingConnected.value = false;
    webrtcConnectionState.value = 'new';
    webrtcDataChannel.value = null;
  }

  return {
    connectedPeerId,
    connectedPeerName,
    connectionStartTime,
    signalingConnected,
    webrtcConnectionState,
    webrtcDataChannel,
    isConnected,
    init,
    getSignaling,
    getWebRTC,
    disconnect,
    $reset,
  };
});
