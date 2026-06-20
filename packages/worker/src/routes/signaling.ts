import { Hono } from 'hono';
import type { Env } from '../env.js';

export const signalingRoutes = new Hono<{ Bindings: Env }>();

signalingRoutes.get('/signal/:roomId', async (c) => {
  const roomId = c.req.param('roomId');
  const upgradeHeader = c.req.header('Upgrade');

  if (upgradeHeader !== 'websocket') {
    return c.text('Expected WebSocket upgrade', 426);
  }

  const id = c.env.SIGNALING_ROOM.idFromName(roomId);
  const stub = c.env.SIGNALING_ROOM.get(id);
  return stub.fetch(c.req.raw);
});
