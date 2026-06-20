/** Extended RTCPeerConnection with metadata */
export interface PeerConnection {
  pc: RTCPeerConnection;
  peerId: string;
  peerName: string;
  dataChannel: RTCDataChannel | null;
  state: 'connecting' | 'connected' | 'disconnected' | 'failed';
}

/** Connection request waiting for confirmation */
export interface PendingConnection {
  fromPeerId: string;
  fromName: string;
  offerSdp: RTCSessionDescriptionInit;
  timestamp: number;
}
