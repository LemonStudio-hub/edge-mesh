<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useSessionStore } from '../stores/session.js';
import { useTransferStore } from '../stores/transfer.js';
import { useFileTransfer } from '../composables/useFileTransfer.js';
import type { FileMetadata } from '@edge-mesh/shared';
import ConnectionStatus from '../components/ConnectionStatus.vue';
import FileDropZone from '../components/FileDropZone.vue';

const router = useRouter();
const session = useSessionStore();
const transferStore = useTransferStore();
const { sendFile, createReceiver } = useFileTransfer();

// Received files list
const receivedFiles = ref<Array<{ blob: Blob; metadata: FileMetadata; url: string }>>([]);

// Redirect to home if no active session
onMounted(() => {
  if (!session.getWebRTC()) {
    router.replace({ name: 'home' });
    return;
  }

  // Set up file receiver on the data channel
  const dc = session.webrtcDataChannel;
  if (dc) {
    const receiver = createReceiver(dc);
    receiver.onFileReceived((blob: Blob, metadata: FileMetadata) => {
      // Store the blob for download
      receivedFiles.value.push({ blob, metadata, url: URL.createObjectURL(blob) });
    });
  }
});

onUnmounted(() => {
  // Clean up blob URLs
  for (const f of receivedFiles.value) {
    URL.revokeObjectURL(f.url);
  }
});

// Computed: sorted transfers (active first, then completed)
const sortedTransfers = computed(() => {
  const entries = Array.from(transferStore.transfers.values());
  const order = { transferring: 0, connecting: 1, verifying: 2, complete: 3, error: 4, cancelled: 5 };
  return entries.sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));
});

const activeTransfers = computed(() =>
  sortedTransfers.value.filter((t) => ['transferring', 'connecting', 'verifying'].includes(t.status))
);

const completedTransfers = computed(() =>
  sortedTransfers.value.filter((t) => t.status === 'complete')
);

async function handleFileSelected(file: File) {
  const dc = session.webrtcDataChannel;
  if (!dc) return;
  await sendFile(file, dc);
}

function downloadFile(url: string, name: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
}

function handleDisconnect() {
  session.disconnect();
  router.replace({ name: 'home' });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec < 1024) return `${bytesPerSec.toFixed(0)} B/s`;
  if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
  return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
}
</script>

<template>
  <div class="transfer-view">
    <!-- Connection Status Bar -->
    <ConnectionStatus
      :peer-name="session.connectedPeerName"
      :connection-state="session.webrtcConnectionState"
      :start-time="session.connectionStartTime"
      @disconnect="handleDisconnect"
    />

    <!-- Disconnected State -->
    <div v-if="session.webrtcConnectionState === 'disconnected'" class="disconnected-banner">
      <p>Connection lost.</p>
      <button class="btn-primary" @click="handleDisconnect">Return to Home</button>
    </div>

    <!-- File Drop Zone -->
    <section class="send-section">
      <h2>Send Files</h2>
      <FileDropZone @file-selected="handleFileSelected" />
    </section>

    <!-- Active Transfers -->
    <section v-if="activeTransfers.length > 0" class="transfers-section">
      <h2>Transferring</h2>
      <div v-for="t in activeTransfers" :key="t.id" class="transfer-item active">
        <div class="transfer-header">
          <span class="direction" :class="t.direction">
            {{ t.direction === 'send' ? '↑' : '↓' }}
          </span>
          <span class="filename">{{ t.metadata?.name || 'Unknown' }}</span>
          <span class="size">{{ t.metadata ? formatSize(t.metadata.size) : '' }}</span>
        </div>
        <div class="progress-bar">
          <div
            class="progress-fill"
            :style="{ width: `${Math.min(t.progress * 100, 100)}%` }"
          ></div>
        </div>
        <div class="transfer-meta">
          <span>{{ (t.progress * 100).toFixed(1) }}%</span>
          <span v-if="t.speed > 0">{{ formatSpeed(t.speed) }}</span>
          <span class="status">{{ t.status }}</span>
          <button
            v-if="t.status === 'transferring'"
            class="btn-cancel"
            @click="transferStore.cancelTransfer(t.id)"
          >
            Cancel
          </button>
        </div>
      </div>
    </section>

    <!-- Completed Transfers -->
    <section v-if="completedTransfers.length > 0" class="transfers-section">
      <h2>Completed</h2>
      <div v-for="t in completedTransfers" :key="t.id" class="transfer-item completed">
        <div class="transfer-header">
          <span class="direction" :class="t.direction">
            {{ t.direction === 'send' ? '↑' : '↓' }}
          </span>
          <span class="filename">{{ t.metadata?.name }}</span>
          <span class="size">{{ t.metadata ? formatSize(t.metadata.size) : '' }}</span>
          <span class="check">✓</span>
          <button class="btn-remove" @click="transferStore.removeTransfer(t.id)">×</button>
        </div>
      </div>
    </section>

    <!-- Received Files -->
    <section v-if="receivedFiles.length > 0" class="received-section">
      <h2>Received Files</h2>
      <div v-for="(file, i) in receivedFiles" :key="i" class="received-item">
        <div class="file-icon">📄</div>
        <div class="file-details">
          <span class="file-name">{{ file.metadata.name }}</span>
          <span class="file-size">{{ formatSize(file.metadata.size) }}</span>
        </div>
        <button class="btn-primary btn-sm" @click="downloadFile(file.url, file.metadata.name)">
          Download
        </button>
      </div>
    </section>

    <!-- Empty State -->
    <section
      v-if="activeTransfers.length === 0 && completedTransfers.length === 0 && receivedFiles.length === 0"
      class="empty-state"
    >
      <p>No transfers yet. Drop a file above to start sending.</p>
    </section>
  </div>
</template>

<style scoped>
.transfer-view {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.disconnected-banner {
  background: #fef2f2;
  border: 1px solid var(--danger);
  border-radius: var(--radius);
  padding: 1.5rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.disconnected-banner p {
  color: var(--danger);
  font-weight: 600;
}

/* Send Section */
.send-section {
  background: var(--surface);
  padding: 1.5rem;
  border-radius: var(--radius);
  box-shadow: var(--shadow);
}

.send-section h2 {
  font-size: 1rem;
  margin-bottom: 1rem;
}

/* Transfers Section */
.transfers-section {
  background: var(--surface);
  padding: 1.5rem;
  border-radius: var(--radius);
  box-shadow: var(--shadow);
}

.transfers-section h2 {
  font-size: 1rem;
  margin-bottom: 1rem;
}

.transfer-item {
  padding: 0.75rem 0;
  border-top: 1px solid var(--border);
}

.transfer-item:first-child {
  border-top: none;
}

.transfer-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
}

.direction {
  font-weight: 700;
  width: 1.2rem;
  text-align: center;
}

.direction.send {
  color: var(--primary);
}

.direction.receive {
  color: var(--success);
}

.filename {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
}

.size {
  color: var(--text-muted);
  font-size: 0.8rem;
}

.check {
  color: var(--success);
  font-weight: 700;
}

.progress-bar {
  height: 4px;
  background: var(--border);
  border-radius: 2px;
  margin: 0.5rem 0;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--primary);
  border-radius: 2px;
  transition: width 0.15s linear;
}

.transfer-meta {
  display: flex;
  gap: 0.75rem;
  font-size: 0.8rem;
  color: var(--text-muted);
}

.status {
  text-transform: capitalize;
}

.btn-cancel {
  margin-left: auto;
  padding: 0.15rem 0.5rem;
  font-size: 0.75rem;
  background: transparent;
  color: var(--danger);
  border: 1px solid var(--danger);
  border-radius: 4px;
}

.btn-cancel:hover {
  background: var(--danger);
  color: white;
}

.btn-remove {
  padding: 0.1rem 0.4rem;
  font-size: 0.85rem;
  background: transparent;
  color: var(--text-muted);
  border: 1px solid var(--border);
  border-radius: 4px;
  margin-left: auto;
}

.btn-remove:hover {
  color: var(--danger);
  border-color: var(--danger);
}

/* Received Files */
.received-section {
  background: var(--surface);
  padding: 1.5rem;
  border-radius: var(--radius);
  box-shadow: var(--shadow);
}

.received-section h2 {
  font-size: 1rem;
  margin-bottom: 1rem;
}

.received-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 0;
  border-top: 1px solid var(--border);
}

.received-item:first-child {
  border-top: none;
}

.file-icon {
  font-size: 1.5rem;
}

.file-details {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.file-name {
  font-weight: 500;
  font-size: 0.9rem;
}

.file-size {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.btn-sm {
  padding: 0.35rem 0.75rem;
  font-size: 0.85rem;
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 3rem;
  color: var(--text-muted);
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
}
</style>
