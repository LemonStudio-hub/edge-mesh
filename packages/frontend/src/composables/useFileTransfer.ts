import { ref } from 'vue';
import { CHUNK_SIZE } from '@edge-mesh/shared';
import type { FileMetadata, FileTransferMessage } from '@edge-mesh/shared';
import { useTransferStore, type TransferState } from '../stores/transfer.js';

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
      b.toString(16).padStart(2, '0')
    ).join('');

    const metadata: FileMetadata = {
      name: file.name,
      size: file.size,
      type: file.type,
      totalChunks,
      checksum,
    };

    // Add transfer to store
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
      let chunkIndex = 0;
      const startTime = Date.now();

      while (offset < file.size) {
        const chunk = buffer.slice(offset, offset + CHUNK_SIZE);

        // Wait for buffer to drain (flow control)
        if (dataChannel.bufferedAmount > 1024 * 1024) {
          await new Promise<void>((resolve) => {
            dataChannel.onbufferedamountlow = () => resolve();
            dataChannel.bufferedAmountLowThreshold = 512 * 1024;
          });
        }

        // Send raw binary chunk — receiver tracks index by counting
        dataChannel.send(chunk);

        offset += CHUNK_SIZE;
        chunkIndex++;

        // Update progress
        const elapsed = (Date.now() - startTime) / 1000;
        const speed = offset / elapsed;
        transferStore.updateProgress(transferId, offset, speed);
      }

      // Send completion message
      const completeMsg: FileTransferMessage = { type: 'file-complete', checksum };
      dataChannel.send(JSON.stringify(completeMsg));
      transferStore.completeTransfer(transferId);
    } catch (err) {
      transferStore.errorTransfer(transferId, String(err));
    }
  }

  /** Receive files from a data channel */
  function createReceiver(dataChannel: RTCDataChannel): {
    onFileReceived: (handler: (file: Blob, metadata: FileMetadata) => void) => void;
  } {
    let metadata: FileMetadata | null = null;
    const chunks: ArrayBuffer[] = [];
    let receivedChunks = 0;
    let transferId = '';
    const fileHandlers: ((file: Blob, metadata: FileMetadata) => void)[] = [];

    dataChannel.onmessage = async (event) => {
      if (typeof event.data === 'string') {
        const msg = JSON.parse(event.data) as FileTransferMessage;
        if (msg.type === 'file-meta') {
          metadata = msg.metadata;
          transferId = crypto.randomUUID();
          transferStore.addTransfer({
            id: transferId,
            direction: 'receive',
            peerId: '',
            peerName: '',
            metadata,
            progress: 0,
            bytesTransferred: 0,
            speed: 0,
            status: 'transferring',
          });
          chunks.length = 0;
          receivedChunks = 0;
        } else if (msg.type === 'file-complete') {
          // Reassemble and verify
          if (metadata) {
            transferStore.updateProgress(transferId, metadata.size, 0);
            transferStore.completeTransfer(transferId);

            const blob = new Blob(chunks, { type: metadata.type });

            // Verify checksum
            const arrayBuffer = await blob.arrayBuffer();
            const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
            const checksum = Array.from(new Uint8Array(hashBuffer), (b) =>
              b.toString(16).padStart(2, '0')
            ).join('');

            if (checksum === metadata.checksum) {
              for (const handler of fileHandlers) {
                handler(blob, metadata);
              }
            } else {
              transferStore.errorTransfer(transferId, 'Checksum mismatch');
            }
          }
        } else if (msg.type === 'file-cancel') {
          transferStore.cancelTransfer(transferId);
        }
      } else if (event.data instanceof ArrayBuffer) {
        // Binary chunk
        chunks.push(event.data);
        receivedChunks++;

        if (metadata) {
          const bytesTransferred = chunks.reduce((sum, c) => sum + c.byteLength, 0);
          transferStore.updateProgress(transferId, bytesTransferred, 0);
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
