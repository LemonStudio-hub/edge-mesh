import { describe, it, expect } from 'vitest';
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import type { Env } from '../src/env.js';
import app from '../src/index.js';

const testEnv = env as unknown as Env;

/**
 * Helper to create a WebSocket connection to the signaling room.
 * Uses the Hono app's /api/signal/:roomId endpoint with Upgrade header.
 */
async function connectPeer(roomId: string, peerId: string, peerName: string) {
  const req = new Request(`http://localhost/api/signal/${roomId}`, {
    headers: { Upgrade: 'websocket' },
  });
  const ctx = createExecutionContext();
  const res = await app.fetch(req, testEnv, ctx);
  await waitOnExecutionContext(ctx);

  // The response should be a 101 with a webSocket client
  const ws = res.webSocket as WebSocket | null;
  if (!ws) throw new Error('Expected WebSocket in response');
  ws.accept();

  // Collect received messages
  const messages: unknown[] = [];
  ws.addEventListener('message', (event) => {
    messages.push(JSON.parse(event.data as string));
  });

  // Register the peer
  ws.send(JSON.stringify({ type: 'register', peerId, peerName }));

  // Wait for registration to process
  await new Promise((r) => setTimeout(r, 50));

  return { ws, messages };
}

describe('SignalingRoom Durable Object', () => {
  describe('Peer registration', () => {
    it('registering a peer returns a peer-list', async () => {
      const { ws, messages } = await connectPeer('room-1', 'peer-a', 'Alice');

      // Should have received peer-list
      const peerList = messages.find((m: any) => m.type === 'peer-list') as any;
      expect(peerList).toBeDefined();
      expect(peerList.peers).toBeInstanceOf(Array);
      expect(peerList.peers.some((p: any) => p.peerId === 'peer-a')).toBe(true);

      ws.close();
    });

    it('second peer sees first peer in peer-list', async () => {
      const peer1 = await connectPeer('room-2', 'p1', 'Peer1');
      const peer2 = await connectPeer('room-2', 'p2', 'Peer2');

      // Peer2 should see Peer1 in its peer-list
      const peerList = peer2.messages.find((m: any) => m.type === 'peer-list') as any;
      expect(peerList).toBeDefined();
      expect(peerList.peers.some((p: any) => p.peerId === 'p1')).toBe(true);
      expect(peerList.peers.some((p: any) => p.peerId === 'p2')).toBe(true);

      peer1.ws.close();
      peer2.ws.close();
    });

    it('existing peers receive peer-joined when a new peer registers', async () => {
      const peer1 = await connectPeer('room-3', 'p1', 'Peer1');
      const peer2 = await connectPeer('room-3', 'p2', 'Peer2');

      // Peer1 should have received peer-joined for Peer2
      const joined = peer1.messages.find(
        (m: any) => m.type === 'peer-joined' && m.peer?.peerId === 'p2',
      ) as any;
      expect(joined).toBeDefined();
      expect(joined.peer.name).toBe('Peer2');
      expect(joined.peer.isOnline).toBe(true);

      peer1.ws.close();
      peer2.ws.close();
    });
  });

  describe('Message relay', () => {
    it('relays offer from peer A to peer B', async () => {
      const peer1 = await connectPeer('room-4', 'sender', 'Sender');
      const peer2 = await connectPeer('room-4', 'receiver', 'Receiver');

      // Clear previous messages
      peer1.messages.length = 0;
      peer2.messages.length = 0;

      // Send offer from sender to receiver
      peer1.ws.send(
        JSON.stringify({
          type: 'offer',
          from: 'sender',
          to: 'receiver',
          sdp: { type: 'offer', sdp: 'mock-sdp' },
        }),
      );

      await new Promise((r) => setTimeout(r, 50));

      // Receiver should get the offer
      const offer = peer2.messages.find((m: any) => m.type === 'offer') as any;
      expect(offer).toBeDefined();
      expect(offer.from).toBe('sender');
      expect(offer.to).toBe('receiver');
      expect(offer.sdp.sdp).toBe('mock-sdp');

      peer1.ws.close();
      peer2.ws.close();
    });

    it('relays answer from peer B to peer A', async () => {
      const peer1 = await connectPeer('room-5', 'caller', 'Caller');
      const peer2 = await connectPeer('room-5', 'callee', 'Callee');

      peer1.messages.length = 0;
      peer2.messages.length = 0;

      peer2.ws.send(
        JSON.stringify({
          type: 'answer',
          from: 'callee',
          to: 'caller',
          sdp: { type: 'answer', sdp: 'mock-answer' },
        }),
      );

      await new Promise((r) => setTimeout(r, 50));

      const answer = peer1.messages.find((m: any) => m.type === 'answer') as any;
      expect(answer).toBeDefined();
      expect(answer.from).toBe('callee');
      expect(answer.sdp.sdp).toBe('mock-answer');

      peer1.ws.close();
      peer2.ws.close();
    });

    it('relays ICE candidates', async () => {
      const peer1 = await connectPeer('room-6', 'ice-a', 'IceA');
      const peer2 = await connectPeer('room-6', 'ice-b', 'IceB');

      peer1.messages.length = 0;
      peer2.messages.length = 0;

      peer1.ws.send(
        JSON.stringify({
          type: 'ice-candidate',
          from: 'ice-a',
          to: 'ice-b',
          candidate: { candidate: 'candidate:1 1 UDP 2122260223 ...' },
        }),
      );

      await new Promise((r) => setTimeout(r, 50));

      const ice = peer2.messages.find((m: any) => m.type === 'ice-candidate') as any;
      expect(ice).toBeDefined();
      expect(ice.from).toBe('ice-a');
      expect(ice.candidate.candidate).toContain('candidate:1');

      peer1.ws.close();
      peer2.ws.close();
    });
  });

  describe('Disconnect handling', () => {
    it('broadcasts peer-left when a peer disconnects', async () => {
      const peer1 = await connectPeer('room-7', 'stayer', 'Stayer');
      const peer2 = await connectPeer('room-7', 'leaver', 'Leaver');

      // Clear messages
      peer1.messages.length = 0;

      // Close peer2
      peer2.ws.close();

      // Wait for the close event to propagate
      await new Promise((r) => setTimeout(r, 100));

      // Peer1 should receive peer-left for leaver
      const left = peer1.messages.find(
        (m: any) => m.type === 'peer-left' && m.peerId === 'leaver',
      );
      expect(left).toBeDefined();

      peer1.ws.close();
    });
  });

  describe('Room isolation', () => {
    it('peers in different rooms do not see each other', async () => {
      const peer1 = await connectPeer('room-a', 'p1', 'Peer1');
      const peer2 = await connectPeer('room-b', 'p2', 'Peer2');

      // Peer1's peer-list should only contain itself
      const peerList1 = peer1.messages.find((m: any) => m.type === 'peer-list') as any;
      expect(peerList1.peers.every((p: any) => p.peerId !== 'p2')).toBe(true);

      // Peer2's peer-list should only contain itself
      const peerList2 = peer2.messages.find((m: any) => m.type === 'peer-list') as any;
      expect(peerList2.peers.every((p: any) => p.peerId !== 'p1')).toBe(true);

      peer1.ws.close();
      peer2.ws.close();
    });
  });
});
