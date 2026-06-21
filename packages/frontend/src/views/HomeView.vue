<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { CONNECTION_REQUEST_TIMEOUT_MS } from '@edge-mesh/shared';
import { usePeerStore } from '../stores/peer.js';
import { useSessionStore } from '../stores/session.js';
import { useSignaling } from '../composables/useSignaling.js';
import { useWebRTC } from '../composables/useWebRTC.js';
import { useOnlineStatus } from '../composables/useOnlineStatus.js';
import type { SignalMessage } from '@edge-mesh/shared';
import CreatePost from '../components/CreatePost.vue';
import PostBoard from '../components/PostBoard.vue';
import ConnectionRequest from '../components/ConnectionRequest.vue';

const router = useRouter();
const peer = usePeerStore();
const session = useSessionStore();
useOnlineStatus();

// Use a shared room for all peers
const signaling = useSignaling('global');
const webrtc = useWebRTC(signaling.send, signaling.onMessage, {}, peer.peerId);

// Connection request state (for incoming requests — shows the accept/reject dialog)
const pendingRequest = ref<{
  fromPeerId: string;
  fromName: string;
  offerSdp: RTCSessionDescriptionInit | null;
} | null>(null);

// Outgoing request target (for requests we initiated — no dialog shown)
const outgoingTarget = ref<{ peerId: string; name: string } | null>(null);

// Inline rejection message (replaces window.alert)
const rejectionMessage = ref('');
let rejectionTimer: ReturnType<typeof setTimeout> | null = null;

// Timeout for outgoing connection requests
let outgoingTimeout: ReturnType<typeof setTimeout> | null = null;

let removeSignalingHandler: (() => void) | null = null;

onMounted(() => {
  // Reset any leftover session state
  session.$reset();

  removeSignalingHandler = signaling.onMessage((msg: SignalMessage) => {
    if (msg.type === 'connect-request') {
      pendingRequest.value = {
        fromPeerId: msg.from,
        fromName: msg.fromName,
        offerSdp: null,
      };
    } else if (msg.type === 'connect-accept') {
      // Our request was accepted — the other side will send us an offer
      clearOutgoingTimeout();
    } else if (msg.type === 'connect-reject') {
      clearOutgoingTimeout();
      outgoingTarget.value = null;
      showRejection('Connection request was rejected.');
    } else if (msg.type === 'offer') {
      if (outgoingTarget.value) {
        // We initiated this connection — auto-accept the offer
        clearOutgoingTimeout();
        webrtc.accept(msg.sdp, msg.from);
      } else {
        // Unsolicited offer — show dialog
        pendingRequest.value = {
          fromPeerId: msg.from,
          fromName: '',
          offerSdp: msg.sdp,
        };
      }
    }
  });

  // When data channel opens → navigate to transfer page
  webrtc.onDataChannel(() => {
    const targetPeerId = webrtc.remotePeerId.value;
    const targetPeerName = pendingRequest.value?.fromName || outgoingTarget.value?.name || 'Remote Peer';

    // Store the session before navigating
    session.init(signaling, webrtc, targetPeerId, targetPeerName);

    // Navigate to transfer page
    router.push({ name: 'transfer' });
  });
});

onUnmounted(() => {
  removeSignalingHandler?.();
  clearOutgoingTimeout();
  if (rejectionTimer) clearTimeout(rejectionTimer);
});

function showRejection(message: string) {
  rejectionMessage.value = message;
  if (rejectionTimer) clearTimeout(rejectionTimer);
  rejectionTimer = setTimeout(() => {
    rejectionMessage.value = '';
  }, 5000);
}

function clearOutgoingTimeout() {
  if (outgoingTimeout) {
    clearTimeout(outgoingTimeout);
    outgoingTimeout = null;
  }
}

function handleConnectRequest(peerId: string, peerName: string) {
  outgoingTarget.value = { peerId, name: peerName };

  signaling.send({
    type: 'connect-request',
    from: peer.peerId,
    fromName: peer.name,
    to: peerId,
  });

  // Set timeout for outgoing request
  clearOutgoingTimeout();
  outgoingTimeout = setTimeout(() => {
    if (outgoingTarget.value?.peerId === peerId) {
      outgoingTarget.value = null;
      showRejection('Connection request timed out.');
    }
  }, CONNECTION_REQUEST_TIMEOUT_MS);
}

async function acceptConnection() {
  if (!pendingRequest.value) return;
  const { fromPeerId, offerSdp } = pendingRequest.value;

  if (offerSdp) {
    // We received an offer directly — accept it
    await webrtc.accept(offerSdp, fromPeerId);
  } else {
    // We received a connect-request — send acceptance, then create offer
    signaling.send({
      type: 'connect-accept',
      from: peer.peerId,
      to: fromPeerId,
    });
    await webrtc.connect(fromPeerId);
  }
  // Don't clear pendingRequest here — keep the name for the session init
}

function rejectConnection() {
  if (pendingRequest.value) {
    signaling.send({
      type: 'connect-reject',
      from: peer.peerId,
      to: pendingRequest.value.fromPeerId,
    });
    pendingRequest.value = null;
  }
}
</script>

<template>
  <div class="home">
    <CreatePost />
    <PostBoard @connect="handleConnectRequest" />

    <!-- Outgoing request pending indicator -->
    <div v-if="outgoingTarget" class="outgoing-indicator">
      <span class="outgoing-spinner"></span>
      Waiting for <strong>{{ outgoingTarget.name }}</strong> to accept…
    </div>

    <!-- Inline rejection message -->
    <div v-if="rejectionMessage" class="rejection-message">
      {{ rejectionMessage }}
    </div>

    <ConnectionRequest
      v-if="pendingRequest"
      :from-peer-id="pendingRequest.fromPeerId"
      :from-name="pendingRequest.fromName || 'Unknown peer'"
      @accept="acceptConnection"
      @reject="rejectConnection"
    />
  </div>
</template>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.outgoing-indicator {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: var(--primary);
  color: white;
  border-radius: var(--radius);
  font-size: 0.9rem;
}

.outgoing-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.rejection-message {
  padding: 0.75rem 1rem;
  background: var(--danger);
  color: white;
  border-radius: var(--radius);
  font-size: 0.9rem;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
