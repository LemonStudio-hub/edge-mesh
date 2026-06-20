import { defineStore } from 'pinia';
import { ref, reactive } from 'vue';
import type { FileMetadata } from '@edge-mesh/shared';

export interface TransferState {
  id: string;
  direction: 'send' | 'receive';
  peerId: string;
  peerName: string;
  metadata: FileMetadata | null;
  progress: number;
  bytesTransferred: number;
  speed: number;
  status: 'connecting' | 'transferring' | 'verifying' | 'complete' | 'error' | 'cancelled';
  error?: string;
}

export const useTransferStore = defineStore('transfer', () => {
  const transfers = reactive<Map<string, TransferState>>(new Map());

  function addTransfer(transfer: TransferState) {
    transfers.set(transfer.id, transfer);
  }

  function updateProgress(id: string, bytesTransferred: number, speed: number) {
    const t = transfers.get(id);
    if (!t || !t.metadata) return;
    t.bytesTransferred = bytesTransferred;
    t.progress = bytesTransferred / t.metadata.size;
    t.speed = speed;
    t.status = 'transferring';
  }

  function completeTransfer(id: string) {
    const t = transfers.get(id);
    if (t) {
      t.progress = 1;
      t.status = 'complete';
    }
  }

  function errorTransfer(id: string, error: string) {
    const t = transfers.get(id);
    if (t) {
      t.status = 'error';
      t.error = error;
    }
  }

  function cancelTransfer(id: string) {
    const t = transfers.get(id);
    if (t) {
      t.status = 'cancelled';
    }
  }

  function removeTransfer(id: string) {
    transfers.delete(id);
  }

  return {
    transfers,
    addTransfer,
    updateProgress,
    completeTransfer,
    errorTransfer,
    cancelTransfer,
    removeTransfer,
  };
});
