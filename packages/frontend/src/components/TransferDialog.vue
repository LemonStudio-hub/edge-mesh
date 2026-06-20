<script setup lang="ts">
import { computed } from 'vue';
import { useTransferStore, type TransferState } from '../stores/transfer.js';

const transferStore = useTransferStore();

const activeTransfers = computed(() =>
  Array.from(transferStore.transfers.values()).filter(
    (t) => t.status !== 'complete' && t.status !== 'error' && t.status !== 'cancelled'
  )
);

const completedTransfers = computed(() =>
  Array.from(transferStore.transfers.values()).filter((t) => t.status === 'complete')
);

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec < 1024) return `${bytesPerSec.toFixed(0)} B/s`;
  if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
  return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
}

function cancelTransfer(id: string) {
  transferStore.cancelTransfer(id);
}

function removeTransfer(id: string) {
  transferStore.removeTransfer(id);
}
</script>

<template>
  <div v-if="activeTransfers.length > 0 || completedTransfers.length > 0" class="transfer-panel">
    <h3>File Transfers</h3>

    <div v-for="t in activeTransfers" :key="t.id" class="transfer-item">
      <div class="transfer-header">
        <span class="direction">{{ t.direction === 'send' ? '↑' : '↓' }}</span>
        <span class="filename">{{ t.metadata?.name || 'Unknown file' }}</span>
        <span class="size">{{ t.metadata ? formatSize(t.metadata.size) : '' }}</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: `${t.progress * 100}%` }"></div>
      </div>
      <div class="transfer-info">
        <span>{{ (t.progress * 100).toFixed(1) }}%</span>
        <span v-if="t.speed > 0">{{ formatSpeed(t.speed) }}</span>
        <span class="status">{{ t.status }}</span>
        <button v-if="t.status === 'transferring'" class="btn-cancel" @click="cancelTransfer(t.id)">
          Cancel
        </button>
      </div>
    </div>

    <div v-for="t in completedTransfers" :key="t.id" class="transfer-item completed">
      <div class="transfer-header">
        <span class="direction">{{ t.direction === 'send' ? '↑' : '↓' }}</span>
        <span class="filename">{{ t.metadata?.name }}</span>
        <span class="status-text">✓ Complete</span>
        <button class="btn-cancel" @click="removeTransfer(t.id)">×</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.transfer-panel {
  position: fixed;
  bottom: 1rem;
  right: 1rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1rem;
  min-width: 320px;
  max-width: 400px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  z-index: 50;
}

h3 {
  font-size: 0.9rem;
  margin-bottom: 0.75rem;
}

.transfer-item {
  padding: 0.5rem 0;
  border-top: 1px solid var(--border);
}

.transfer-item:first-of-type {
  border-top: none;
}

.transfer-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
}

.direction {
  font-weight: 700;
  color: var(--primary);
}

.filename {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.size {
  color: var(--text-muted);
  font-size: 0.8rem;
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
  transition: width 0.2s;
}

.transfer-info {
  display: flex;
  gap: 0.75rem;
  font-size: 0.8rem;
  color: var(--text-muted);
}

.status {
  margin-left: auto;
  text-transform: capitalize;
}

.status-text {
  color: var(--success);
  font-size: 0.8rem;
  margin-left: auto;
}

.btn-cancel {
  padding: 0.2rem 0.5rem;
  font-size: 0.75rem;
  background: transparent;
  color: var(--danger);
  border: 1px solid var(--danger);
  border-radius: 4px;
  margin-left: auto;
}

.btn-cancel:hover {
  background: var(--danger);
  color: white;
}

.completed {
  opacity: 0.7;
}
</style>
