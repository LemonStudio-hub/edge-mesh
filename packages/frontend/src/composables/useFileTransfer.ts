import { CHUNK_SIZE } from '@edge-mesh/shared';
import type { FileMetadata, FileTransferMessage } from '@edge-mesh/shared';
import { useTransferStore } from '../stores/transfer.js';

export function useFileTransfer() {
  const transferStore = useTransferStore();

  /** Send a file over a data channel */
  async function sendFile(file: File, dataChannel: RTCDataChannel): Promise<void> {
    const transferId = crypto.randomUUID();
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    // Compute checksum using Web Crypto
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const checksum = Array.from(new Uint8Array(hashBuffer), (b) =>
      b.toString(16).padStart(2, '0'),
    ).join('');

    const metadata: FileMetadata = {
      name: file.name,
      size: file.size,
      type: file.type,
      totalChunks,
      checksum,
    };

    transferStore.addTransfer({
      id: transferId,
      direction: 'send',
      peerId: '',
      peerName: '',
      metadata,
      progress: 0,
      bytesTransferred: 0,
      speed: 0,
      status: 'connecting',
    });

    try {
      // Send metadata
      const metaMsg: FileTransferMessage = { type: 'file-meta', metadata };
      dataChannel.send(JSON.stringify(metaMsg));

      // Send chunks with flow control
      let offset = 0;
      const startTime = Date.now();

      while (offset < file.size) {
        // Check if transfer was cancelled locally
        const transfer = transferStore.transfers.get(transferId);
        if (transfer?.status === 'cancelled') {
          const cancelMsg: FileTransferMessage = { type: 'file-cancel' };
          dataChannel.send(JSON.stringify(cancelMsg));
          return;
        }

        const chunk = buffer.slice(offset, offset + CHUNK_SIZE);

        // Wait for buffer to drain (flow control)
        if (dataChannel.bufferedAmount > 1024 * 1024) {
          await new Promise<void>((resolve) => {
            dataChannel.onbufferedamountlow = () => resolve();
            dataChannel.bufferedAmountLowThreshold = 512 * 1024;
          });
        }

        dataChannel.send(chunk);
        offset += CHUNK_SIZE;

        // Update progress with speed
        const elapsed = (Date.now() - startTime) / 1000;
        const speed = elapsed > 0 ? offset / elapsed : 0;
        transferStore.updateProgress(transferId, offset, speed);
      }

      // Send completion message
      const completeMsg: FileTransferMessage = { type: 'file-complete', checksum };
      dataChannel.send(JSON.stringify(completeMsg));
      transferStore.completeTransfer(transferId);
    } catch (err) {
      // Try to notify remote peer on error
      try {
        const cancelMsg: FileTransferMessage = { type: 'file-cancel' };
        dataChannel.send(JSON.stringify(cancelMsg));
      } catch {
        // Channel may already be closed
      }
      transferStore.errorTransfer(transferId, String(err));
    }
  }

  /** Receive files from a data channel */
  function createReceiver(dataChannel: RTCDataChannel): {
    onFileReceived: (handler: (file: Blob, metadata: FileMetadata) => void) => void;
  } {
    let currentMetadata: FileMetadata | null = null;
    let currentChunks: ArrayBuffer[] = [];
    let currentTransferId = '';
    let receiveStartTime = 0;
    let lastChunkTime = 0;
    const fileHandlers: ((file: Blob, metadata: FileMetadata) => void)[] = [];

    dataChannel.onmessage = async (event) => {
      if (typeof event.data === 'string') {
        const msg = JSON.parse(event.data) as FileTransferMessage;

        if (msg.type === 'file-meta') {
          // Start receiving a new file
          currentMetadata = msg.metadata;
          currentTransferId = crypto.randomUUID();
          currentChunks = [];
          receiveStartTime = Date.now();
          lastChunkTime = receiveStartTime;

          transferStore.addTransfer({
            id: currentTransferId,
            direction: 'receive',
            peerId: '',
            peerName: '',
            metadata: currentMetadata,
            progress: 0,
            bytesTransferred: 0,
            speed: 0,
            status: 'transferring',
          });
        } else if (msg.type === 'file-complete') {
          if (!currentMetadata) return;

          // Reassemble and verify
          const blob = new Blob(currentChunks, { type: currentMetadata.type });
          const arrayBuffer = await blob.arrayBuffer();
          const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
          const checksum = Array.from(new Uint8Array(hashBuffer), (b) =>
            b.toString(16).padStart(2, '0'),
          ).join('');

          if (checksum === currentMetadata.checksum) {
            const elapsed = (Date.now() - receiveStartTime) / 1000;
            const speed = elapsed > 0 ? currentMetadata.size / elapsed : 0;
            transferStore.updateProgress(currentTransferId, currentMetadata.size, speed);
            transferStore.completeTransfer(currentTransferId);

            for (const handler of fileHandlers) {
              handler(blob, currentMetadata);
            }
          } else {
            transferStore.errorTransfer(currentTransferId, 'Checksum mismatch');
          }

          // Reset state for next file
          currentMetadata = null;
          currentChunks = [];
          currentTransferId = '';
        } else if (msg.type === 'file-cancel') {
          if (currentTransferId) {
            transferStore.cancelTransfer(currentTransferId);
          }
          currentMetadata = null;
          currentChunks = [];
          currentTransferId = '';
        }
      } else if (event.data instanceof ArrayBuffer) {
        // Binary chunk
        currentChunks.push(event.data);

        if (currentMetadata) {
          const bytesTransferred = currentChunks.reduce((sum, c) => sum + c.byteLength, 0);
          const now = Date.now();
          const elapsed = (now - receiveStartTime) / 1000;
          const speed = elapsed > 0 ? bytesTransferred / elapsed : 0;
          lastChunkTime = now;
          transferStore.updateProgress(currentTransferId, bytesTransferred, speed);
        }
      }
    };

    return {
      onFileReceived(handler: (file: Blob, metadata: FileMetadata) => void) {
        fileHandlers.push(handler);
      },
    };
  }

  return { sendFile, createReceiver };
}
