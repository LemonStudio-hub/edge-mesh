/** A published post visible to other peers */
export interface Post {
  id: string;
  authorPeerId: string;
  authorName: string;
  content: string;
  createdAt: number;
  expiresAt: number;
}

/** Information about a connected peer */
export interface PeerInfo {
  peerId: string;
  name: string;
  isOnline: boolean;
}

/** Metadata for a file being transferred */
export interface FileMetadata {
  name: string;
  size: number;
  type: string;
  totalChunks: number;
  checksum: string;
}

/** A single chunk of a file transfer */
export interface FileChunk {
  index: number;
  total: number;
  data: ArrayBuffer;
}

/** WebRTC signaling messages exchanged via the signaling server */
export type SignalMessage =
  | { type: 'register'; peerId: string; peerName: string }
  | { type: 'offer'; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { type: 'answer'; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { type: 'ice-candidate'; from: string; to: string; candidate: RTCIceCandidateInit }
  | { type: 'peer-joined'; peer: PeerInfo }
  | { type: 'peer-left'; peerId: string }
  | { type: 'peer-list'; peers: PeerInfo[] }
  | { type: 'connect-request'; from: string; fromName: string }
  | { type: 'connect-accept'; from: string }
  | { type: 'connect-reject'; from: string };

/** File transfer protocol messages sent over the data channel */
export type FileTransferMessage =
  | { type: 'file-meta'; metadata: FileMetadata }
  | { type: 'file-chunk'; index: number; total: number; data: ArrayBuffer }
  | { type: 'file-ack'; index: number }
  | { type: 'file-complete'; checksum: string }
  | { type: 'file-cancel' };
