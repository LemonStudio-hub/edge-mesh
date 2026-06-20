<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { usePeerStore } from '../stores/peer.js';
import { useSignaling } from '../composables/useSignaling.js';
import { useWebRTC } from '../composables/useWebRTC.js';
import { useFileTransfer } from '../composables/useFileTransfer.js';
import { useOnlineStatus } from '../composables/useOnlineStatus.js';
import type { SignalMessage } from '@edge-mesh/shared';
import type { FileMetadata } from '@edge-mesh/shared';
import CreatePost from '../components/CreatePost.vue';
import PostBoard from '../components/PostBoard.vue';
import ConnectionRequest from '../components/ConnectionRequest.vue';
import FileDropZone from '../components/FileDropZone.vue';
import TransferDialog from '../components/TransferDialog.vue';

const peer = usePeerStore();
useOnlineStatus();

// Use a shared room for all peers
const signaling = useSignaling('global');
const webrtc = useWebRTC(signaling.send, signaling.onMessage);
const { sendFile, createReceiver } = useFileTransfer();

// Connection request state
const pendingRequest = ref<{
  fromPeerId: string;
  fromName: string;
  offerSdp: RTCSessionDescriptionInit;
} | null>(null);

// Active connection state
const connectedPeerId = ref('');
const connectedPeerName = ref('');
const showFileZone = ref(false);

let removeSignalingHandler: (() => void) | null = null;

onMounted(() => {
  removeSignalingHandler = signaling.onMessage((msg: SignalMessage) => {
    if (msg.type === 'connect-request') {
      // Store the pending request — the offer will come after acceptance
      pendingRequest.value = {
        fromPeerId: (msg as any).from,
        fromName: (msg as any).fromName,
        offerSdp: null as any,
      };
    } else if (msg.type === 'connect-accept') {
      // Our request was accepted — WebRTC offer/answer will follow via signaling
    } else if (msg.type === 'connect-reject') {
      alert('Connection request was rejected.');
    } else if (msg.type === 'offer') {
      // Incoming offer — this means the other side accepted and is initiating
      pendingRequest.value = {
        fromPeerId: (msg as any).from,
        fromName: '',
        offerSdp: (msg as any).sdp,
      };
    }
  });

  // When data channel connects, show file zone
  webrtc.onDataChannel((dc) => {
    showFileZone.value = true;
    connectedPeerId.value = '';
    // Set up receiver
    const receiver = createReceiver(dc);
    receiver.onFileReceived((blob: Blob, metadata: FileMetadata) => {
      // Trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = metadata.name;
      a.click();
      URL.revokeObjectURL(url);
    });
  });
});

onUnmounted(() => {
  removeSignalingHandler?.();
});

function handleConnectRequest(peerId: string, peerName: string) {
  // Send a connect-request via signaling
  signaling.send({
    type: 'connect-request',
    from: peer.peerId,
    fromName: peer.name,
    to: peerId,
  });
  connectedPeerName.value = peerName;
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

  connectedPeerId.value = fromPeerId;
  pendingRequest.value = null;
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

async function handleFileSelected(file: File) {
  if (webrtc.dataChannel.value) {
    await sendFile(file, webrtc.dataChannel.value);
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

    <div v-if="showFileZone && webrtc.connectionState.value === 'connected'" class="file-section">
      <h3>Connected — Send a file</h3>
      <FileDropZone @file-selected="handleFileSelected" />
    </div>

    <TransferDialog />
  </div>
</template>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.file-section {
  background: var(--surface);
  padding: 1.5rem;
  border-radius: var(--radius);
  box-shadow: var(--shadow);
}

.file-section h3 {
  font-size: 1rem;
  margin-bottom: 1rem;
  color: var(--success);
}
</style>
