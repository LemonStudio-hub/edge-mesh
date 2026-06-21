import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useTransferStore, type TransferState } from '@/stores/transfer.js';
import type { FileMetadata } from '@edge-mesh/shared';

const testMetadata: FileMetadata = {
  name: 'test.txt',
  size: 1024,
  type: 'text/plain',
  totalChunks: 1,
  checksum: 'abc123',
};

function makeTransfer(overrides: Partial<TransferState> = {}): TransferState {
  return {
    id: 'transfer-1',
    direction: 'send',
    peerId: 'peer-1',
    peerName: 'Peer-1',
    metadata: testMetadata,
    progress: 0,
    bytesTransferred: 0,
    speed: 0,
    status: 'connecting',
    ...overrides,
  };
}

describe('useTransferStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('starts with an empty transfers map', () => {
    const store = useTransferStore();
    expect(store.transfers.size).toBe(0);
  });

  describe('addTransfer', () => {
    it('adds a transfer to the map', () => {
      const store = useTransferStore();
      const transfer = makeTransfer();
      store.addTransfer(transfer);

      expect(store.transfers.size).toBe(1);
      expect(store.transfers.get('transfer-1')).toEqual(transfer);
    });

    it('can add multiple transfers', () => {
      const store = useTransferStore();
      store.addTransfer(makeTransfer({ id: 't1' }));
      store.addTransfer(makeTransfer({ id: 't2' }));
      store.addTransfer(makeTransfer({ id: 't3' }));

      expect(store.transfers.size).toBe(3);
    });
  });

  describe('updateProgress', () => {
    it('updates bytesTransferred, progress, speed, and status', () => {
      const store = useTransferStore();
      store.addTransfer(makeTransfer());

      store.updateProgress('transfer-1', 512, 1024);

      const t = store.transfers.get('transfer-1')!;
      expect(t.bytesTransferred).toBe(512);
      expect(t.progress).toBe(0.5); // 512 / 1024
      expect(t.speed).toBe(1024);
      expect(t.status).toBe('transferring');
    });

    it('is a no-op for non-existent transfer', () => {
      const store = useTransferStore();
      store.updateProgress('nonexistent', 100, 50);
      expect(store.transfers.size).toBe(0);
    });

    it('is a no-op when metadata is null', () => {
      const store = useTransferStore();
      store.addTransfer(makeTransfer({ metadata: null }));
      store.updateProgress('transfer-1', 512, 1024);
      const t = store.transfers.get('transfer-1')!;
      expect(t.bytesTransferred).toBe(0);
    });
  });

  describe('completeTransfer', () => {
    it('sets progress to 1 and status to complete', () => {
      const store = useTransferStore();
      store.addTransfer(makeTransfer({ status: 'transferring', progress: 0.5 }));

      store.completeTransfer('transfer-1');

      const t = store.transfers.get('transfer-1')!;
      expect(t.progress).toBe(1);
      expect(t.status).toBe('complete');
    });
  });

  describe('errorTransfer', () => {
    it('sets status to error with error message', () => {
      const store = useTransferStore();
      store.addTransfer(makeTransfer());

      store.errorTransfer('transfer-1', 'Checksum mismatch');

      const t = store.transfers.get('transfer-1')!;
      expect(t.status).toBe('error');
      expect(t.error).toBe('Checksum mismatch');
    });
  });

  describe('cancelTransfer', () => {
    it('sets status to cancelled', () => {
      const store = useTransferStore();
      store.addTransfer(makeTransfer({ status: 'transferring' }));

      store.cancelTransfer('transfer-1');

      const t = store.transfers.get('transfer-1')!;
      expect(t.status).toBe('cancelled');
    });
  });

  describe('removeTransfer', () => {
    it('removes a transfer from the map', () => {
      const store = useTransferStore();
      store.addTransfer(makeTransfer());
      expect(store.transfers.size).toBe(1);

      store.removeTransfer('transfer-1');
      expect(store.transfers.size).toBe(0);
      expect(store.transfers.has('transfer-1')).toBe(false);
    });

    it('is a no-op for non-existent transfer', () => {
      const store = useTransferStore();
      store.removeTransfer('nonexistent');
      expect(store.transfers.size).toBe(0);
    });
  });

  describe('receive direction', () => {
    it('supports receive direction', () => {
      const store = useTransferStore();
      store.addTransfer(makeTransfer({ id: 'rx-1', direction: 'receive' }));

      const t = store.transfers.get('rx-1')!;
      expect(t.direction).toBe('receive');
    });
  });
});
