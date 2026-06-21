import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useFileTransfer } from '@/composables/useFileTransfer.js';
import { useTransferStore } from '@/stores/transfer.js';
import { CHUNK_SIZE } from '@edge-mesh/shared';

// Mock crypto.subtle.digest by spying on the existing method
const mockDigest = vi.fn().mockResolvedValue(new ArrayBuffer(32));
vi.spyOn(globalThis.crypto.subtle, 'digest').mockImplementation(mockDigest);

function createMockDataChannel() {
  return {
    send: vi.fn(),
    bufferedAmount: 0,
    bufferedAmountLowThreshold: 0,
    onbufferedamountlow: null as (() => void) | null,
    onmessage: null as ((event: MessageEvent) => void) | null,
    binaryType: 'arraybuffer' as BinaryType,
    readyState: 'open',
    close: vi.fn(),
  } as unknown as RTCDataChannel;
}

function createMockFile(name: string, size: number, content?: Uint8Array): File {
  const data = content ?? new Uint8Array(size);
  return new File([data], name, { type: 'application/octet-stream' });
}

describe('useFileTransfer', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    mockDigest.mockResolvedValue(new ArrayBuffer(32));
  });

  describe('sendFile', () => {
    it('sends file-meta JSON message first', async () => {
      const { sendFile } = useFileTransfer();
      const dc = createMockDataChannel();
      const file = createMockFile('test.txt', 100);

      await sendFile(file, dc);

      expect(dc.send).toHaveBeenCalled();
      const firstCall = (dc.send as any).mock.calls[0][0];
      const meta = JSON.parse(firstCall);
      expect(meta.type).toBe('file-meta');
      expect(meta.metadata.name).toBe('test.txt');
      expect(meta.metadata.size).toBe(100);
    });

    it('computes correct totalChunks for small file', async () => {
      const { sendFile } = useFileTransfer();
      const dc = createMockDataChannel();
      const file = createMockFile('small.txt', 100);

      await sendFile(file, dc);

      const metaCall = JSON.parse((dc.send as any).mock.calls[0][0]);
      expect(metaCall.metadata.totalChunks).toBe(1);
    });

    it('computes correct totalChunks for large file', async () => {
      const { sendFile } = useFileTransfer();
      const dc = createMockDataChannel();
      const file = createMockFile('large.bin', CHUNK_SIZE * 2);

      await sendFile(file, dc);

      const metaCall = JSON.parse((dc.send as any).mock.calls[0][0]);
      expect(metaCall.metadata.totalChunks).toBe(2);
    });

    it('sends binary chunks after file-meta', async () => {
      const { sendFile } = useFileTransfer();
      const dc = createMockDataChannel();
      const fileSize = CHUNK_SIZE + 100;
      const file = createMockFile('test.bin', fileSize);

      await sendFile(file, dc);

      const calls = (dc.send as any).mock.calls;
      expect(typeof calls[0][0]).toBe('string');
      expect(calls[1][0]).toBeInstanceOf(ArrayBuffer);
      expect(calls[1][0].byteLength).toBe(CHUNK_SIZE);
      expect(calls[2][0]).toBeInstanceOf(ArrayBuffer);
      expect(calls[2][0].byteLength).toBe(100);
    });

    it('sends file-complete JSON message last', async () => {
      const { sendFile } = useFileTransfer();
      const dc = createMockDataChannel();
      const file = createMockFile('test.txt', 100);

      await sendFile(file, dc);

      const calls = (dc.send as any).mock.calls;
      const lastCall = calls[calls.length - 1][0];
      const complete = JSON.parse(lastCall);
      expect(complete.type).toBe('file-complete');
      expect(typeof complete.checksum).toBe('string');
    });

    it('completes transfer with status complete on success', async () => {
      const { sendFile } = useFileTransfer();
      const store = useTransferStore();
      const dc = createMockDataChannel();
      const file = createMockFile('test.txt', 100);

      await sendFile(file, dc);

      const transfers = Array.from(store.transfers.values());
      expect(transfers.length).toBe(1);
      expect(transfers[0].direction).toBe('send');
      expect(transfers[0].status).toBe('complete');
      expect(transfers[0].progress).toBe(1);
    });
  });

  describe('createReceiver', () => {
    it('registers onmessage handler on data channel', () => {
      const { createReceiver } = useFileTransfer();
      const dc = createMockDataChannel();

      createReceiver(dc);

      expect(dc.onmessage).toBeDefined();
    });

    it('handles file-meta message and creates transfer in store', () => {
      const { createReceiver } = useFileTransfer();
      const store = useTransferStore();
      const dc = createMockDataChannel();

      createReceiver(dc);

      const metadata = {
        name: 'received.txt',
        size: 100,
        type: 'text/plain',
        totalChunks: 1,
        checksum: 'abc123',
      };
      dc.onmessage!(new MessageEvent('message', {
        data: JSON.stringify({ type: 'file-meta', metadata }),
      }));

      const transfers = Array.from(store.transfers.values());
      expect(transfers.length).toBe(1);
      expect(transfers[0].direction).toBe('receive');
      expect(transfers[0].metadata!.name).toBe('received.txt');
    });

    it('accumulates binary chunks and updates progress', () => {
      const { createReceiver } = useFileTransfer();
      const store = useTransferStore();
      const dc = createMockDataChannel();

      createReceiver(dc);

      const metadata = {
        name: 'test.bin',
        size: 100,
        type: 'application/octet-stream',
        totalChunks: 2,
        checksum: 'abc',
      };
      dc.onmessage!(new MessageEvent('message', {
        data: JSON.stringify({ type: 'file-meta', metadata }),
      }));

      const chunk = new ArrayBuffer(50);
      dc.onmessage!(new MessageEvent('message', { data: chunk }));

      const transfers = Array.from(store.transfers.values());
      expect(transfers[0].bytesTransferred).toBe(50);
    });

    it('handles file-cancel message', () => {
      const { createReceiver } = useFileTransfer();
      const store = useTransferStore();
      const dc = createMockDataChannel();

      createReceiver(dc);

      const metadata = {
        name: 'test.bin',
        size: 100,
        type: 'application/octet-stream',
        totalChunks: 1,
        checksum: 'abc',
      };
      dc.onmessage!(new MessageEvent('message', {
        data: JSON.stringify({ type: 'file-meta', metadata }),
      }));

      dc.onmessage!(new MessageEvent('message', {
        data: JSON.stringify({ type: 'file-cancel' }),
      }));

      const transfers = Array.from(store.transfers.values());
      expect(transfers[0].status).toBe('cancelled');
    });

    it('calls onFileReceived handler on successful transfer with matching checksum', async () => {
      const { createReceiver } = useFileTransfer();
      const dc = createMockDataChannel();

      const hashBuffer = new Uint8Array(32).fill(0xab).buffer;
      mockDigest.mockResolvedValue(hashBuffer);

      const receiver = createReceiver(dc);
      const fileHandler = vi.fn();
      receiver.onFileReceived(fileHandler);

      const checksum = 'ab'.repeat(32);

      const metadata = {
        name: 'test.bin',
        size: 50,
        type: 'application/octet-stream',
        totalChunks: 1,
        checksum,
      };
      dc.onmessage!(new MessageEvent('message', {
        data: JSON.stringify({ type: 'file-meta', metadata }),
      }));

      dc.onmessage!(new MessageEvent('message', { data: new ArrayBuffer(50) }));

      dc.onmessage!(new MessageEvent('message', {
        data: JSON.stringify({ type: 'file-complete', checksum }),
      }));

      await new Promise((r) => setTimeout(r, 50));

      expect(fileHandler).toHaveBeenCalled();
      const [blob, receivedMeta] = fileHandler.mock.calls[0];
      expect(blob).toBeInstanceOf(Blob);
      expect(receivedMeta.name).toBe('test.bin');
    });

    it('reports error on checksum mismatch', async () => {
      const { createReceiver } = useFileTransfer();
      const store = useTransferStore();
      const dc = createMockDataChannel();

      const hashBuffer = new Uint8Array(32).fill(0xab).buffer;
      mockDigest.mockResolvedValue(hashBuffer);

      createReceiver(dc);

      const metadata = {
        name: 'test.bin',
        size: 50,
        type: 'application/octet-stream',
        totalChunks: 1,
        checksum: 'ffff',
      };
      dc.onmessage!(new MessageEvent('message', {
        data: JSON.stringify({ type: 'file-meta', metadata }),
      }));

      dc.onmessage!(new MessageEvent('message', { data: new ArrayBuffer(50) }));

      dc.onmessage!(new MessageEvent('message', {
        data: JSON.stringify({ type: 'file-complete', checksum: 'ffff' }),
      }));

      await new Promise((r) => setTimeout(r, 50));

      const transfers = Array.from(store.transfers.values());
      expect(transfers[0].status).toBe('error');
      expect(transfers[0].error).toBe('Checksum mismatch');
    });
  });
});
