<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
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
const webrtc = useWebRTC(signaling.send, signaling.onMessage);

// Connection request state
const pendingRequest = ref<{
  fromPeerId: string;
  fromName: string;
  offerSdp: RTCSessionDescriptionInit | null;
} | null>(null);

let removeSignalingHandler: (() => void) | null = null;

onMounted(() => {
  // Reset any leftover session state
  session.$reset();

  removeSignalingHandler = signaling.onMessage((msg: SignalMessage) => {
    if (msg.type === 'connect-request') {
      pendingRequest.value = {
        fromPeerId: (msg as any).from,
        fromName: (msg as any).fromName,
        offerSdp: null,
      };
    } else if (msg.type === 'connect-accept') {
      // Our request was accepted — WebRTC offer/answer follows automatically
    } else if (msg.type === 'connect-reject') {
      alert('Connection request was rejected.');
    } else if (msg.type === 'offer') {
      // Incoming offer — the other side accepted and is initiating
      pendingRequest.value = {
        fromPeerId: (msg as any).from,
        fromName: '',
        offerSdp: (msg as any).sdp,
      };
    }
  });

  // When data channel opens → navigate to transfer page
  webrtc.onDataChannel((dc) => {
    const targetPeerId = webrtc.remotePeerId.value;
    const targetPeerName = pendingRequest.value?.fromName || 'Remote Peer';

    // Store the session before navigating
    session.init(signaling, webrtc, targetPeerId, targetPeerName);

    // Navigate to transfer page
    router.push({ name: 'transfer' });
  });
});

onUnmounted(() => {
  removeSignalingHandler?.();
});

function handleConnectRequest(peerId: string, peerName: string) {
  // Store target info for when connection establishes
  pendingRequest.value = {
    fromPeerId: peerId,
    fromName: peerName,
    offerSdp: null,
  };

  signaling.send({
    type: 'connect-request',
    from: peer.peerId,
    fromName: peer.name,
    to: peerId,
  });
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
</style>
