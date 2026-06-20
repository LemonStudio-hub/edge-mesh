import type { PeerInfo, SignalMessage } from '@edge-mesh/shared';

interface Env {}

interface ConnectedPeer {
  ws: WebSocket;
  peerId: string;
  name: string;
}

export class SignalingRoom {
  private state: DurableObjectState;
  private peers: Map<string, ConnectedPeer> = new Map();

  constructor(state: DurableObjectState, _env: Env) {
    this.state = state;
  }

  async fetch(request: Request): Response {
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    this.handleSession(server);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  private handleSession(ws: WebSocket) {
    ws.accept();

    let peerId = '';
    let peerName = '';

    ws.addEventListener('message', (event) => {
      try {
        const msg = JSON.parse(event.data as string) as SignalMessage & {
          peerId?: string;
          peerName?: string;
        };

        // Registration message
        if (msg.type === 'register') {
          peerId = msg.peerId || '';
          peerName = msg.peerName || '';
          this.peers.set(peerId, { ws, peerId, name: peerName });

          // Send current peer list to the new peer
          const peerList: PeerInfo[] = Array.from(this.peers.values()).map(
            (p) => ({ peerId: p.peerId, name: p.name, isOnline: true })
          );
          ws.send(JSON.stringify({ type: 'peer-list', peers: peerList }));

          // Broadcast join to others
          this.broadcast(
            { type: 'peer-joined', peer: { peerId, name: peerName, isOnline: true } },
            peerId
          );
          return;
        }

        // Relay signaling messages to the target peer
        if ('to' in msg && msg.to) {
          const target = this.peers.get(msg.to);
          if (target && target.ws.readyState === WebSocket.READY_STATE_OPEN) {
            target.ws.send(JSON.stringify(msg));
          }
        }
      } catch (e) {
        console.error('Signaling message error:', e);
      }
    });

    ws.addEventListener('close', () => {
      if (peerId) {
        this.peers.delete(peerId);
        this.broadcast({ type: 'peer-left', peerId }, peerId);
      }
    });

    ws.addEventListener('error', () => {
      if (peerId) {
        this.peers.delete(peerId);
        this.broadcast({ type: 'peer-left', peerId }, peerId);
      }
    });
  }

  private broadcast(msg: SignalMessage, excludePeerId?: string) {
    const data = JSON.stringify(msg);
    for (const [id, peer] of this.peers) {
      if (id !== excludePeerId && peer.ws.readyState === WebSocket.READY_STATE_OPEN) {
        peer.ws.send(data);
      }
    }
  }
}
