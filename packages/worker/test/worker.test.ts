import { describe, it, expect } from 'vitest';
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import type { Env } from '../src/env.js';
import app from '../src/index.js';

const testEnv = env as unknown as Env;

describe('EdgeMesh Worker', () => {
  describe('GET /api/health', () => {
    it('returns status ok with version and timestamp', async () => {
      const req = new Request('http://localhost/api/health');
      const ctx = createExecutionContext();
      const res = await app.fetch(req, testEnv, ctx);
      await waitOnExecutionContext(ctx);

      expect(res.status).toBe(200);
      const body = await res.json<{ status: string; version: string; timestamp: number }>();
      expect(body.status).toBe('ok');
      expect(body.version).toBe('0.1.0');
      expect(typeof body.timestamp).toBe('number');
    });
  });

  describe('CORS', () => {
    it('includes CORS headers for the allowed origin', async () => {
      const req = new Request('http://localhost/api/health', {
        headers: { Origin: 'https://file.ijk.cam' },
      });
      const ctx = createExecutionContext();
      const res = await app.fetch(req, testEnv, ctx);
      await waitOnExecutionContext(ctx);

      expect(res.headers.get('access-control-allow-origin')).toBe('https://file.ijk.cam');
    });

    it('does not include CORS headers for an unauthorized origin', async () => {
      const req = new Request('http://localhost/api/health', {
        headers: { Origin: 'https://evil.com' },
      });
      const ctx = createExecutionContext();
      const res = await app.fetch(req, testEnv, ctx);
      await waitOnExecutionContext(ctx);

      expect(res.headers.get('access-control-allow-origin')).not.toBe('https://evil.com');
    });
  });

  describe('Posts API via Durable Objects', () => {
    it('GET /api/posts returns an array', async () => {
      const req = new Request('http://localhost/api/posts');
      const ctx = createExecutionContext();
      const res = await app.fetch(req, testEnv, ctx);
      await waitOnExecutionContext(ctx);

      expect(res.status).toBe(200);
      const posts = await res.json<unknown[]>();
      expect(Array.isArray(posts)).toBe(true);
    });

    it('POST /api/posts creates a post and returns 201', async () => {
      const req = new Request('http://localhost/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorPeerId: 'abc123def456',
          authorName: 'Peer-abc123',
          content: 'Hello EdgeMesh!',
        }),
      });
      const ctx = createExecutionContext();
      const res = await app.fetch(req, testEnv, ctx);
      await waitOnExecutionContext(ctx);

      expect(res.status).toBe(201);
      const post = await res.json<{
        id: string;
        authorPeerId: string;
        authorName: string;
        content: string;
        createdAt: number;
        expiresAt: number;
      }>();
      expect(post.authorPeerId).toBe('abc123def456');
      expect(post.authorName).toBe('Peer-abc123');
      expect(post.content).toBe('Hello EdgeMesh!');
      expect(typeof post.id).toBe('string');
      expect(post.expiresAt).toBeGreaterThan(post.createdAt);
    });

    it('POST then GET shows the created post', async () => {
      const createReq = new Request('http://localhost/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorPeerId: 'peer999',
          authorName: 'Peer-999',
          content: 'Test post',
        }),
      });
      const ctx1 = createExecutionContext();
      const createRes = await app.fetch(createReq, env, ctx1);
      await waitOnExecutionContext(ctx1);
      const created = await createRes.json<{ id: string }>();

      const listReq = new Request('http://localhost/api/posts');
      const ctx2 = createExecutionContext();
      const listRes = await app.fetch(listReq, env, ctx2);
      await waitOnExecutionContext(ctx2);
      const posts = await listRes.json<{ id: string }[]>();

      expect(posts.some((p) => p.id === created.id)).toBe(true);
    });

    it('DELETE /api/posts/:id removes the post', async () => {
      const createReq = new Request('http://localhost/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorPeerId: 'deleteme',
          authorName: 'Peer-del',
          content: 'To be deleted',
        }),
      });
      const ctx1 = createExecutionContext();
      const createRes = await app.fetch(createReq, env, ctx1);
      await waitOnExecutionContext(ctx1);
      const created = await createRes.json<{ id: string }>();

      const deleteReq = new Request(`http://localhost/api/posts/${created.id}`, {
        method: 'DELETE',
      });
      const ctx2 = createExecutionContext();
      const deleteRes = await app.fetch(deleteReq, env, ctx2);
      await waitOnExecutionContext(ctx2);
      const deleted = await deleteRes.json<{ deleted: boolean }>();
      expect(deleted.deleted).toBe(true);

      const listReq = new Request('http://localhost/api/posts');
      const ctx3 = createExecutionContext();
      const listRes = await app.fetch(listReq, env, ctx3);
      await waitOnExecutionContext(ctx3);
      const posts = await listRes.json<{ id: string }[]>();
      expect(posts.some((p) => p.id === created.id)).toBe(false);
    });

    it('POST /api/posts/heartbeat returns ok', async () => {
      const createReq = new Request('http://localhost/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorPeerId: 'heartbeatpeer',
          authorName: 'Peer-hb',
          content: 'Heartbeat test',
        }),
      });
      const ctx1 = createExecutionContext();
      await app.fetch(createReq, env, ctx1);
      await waitOnExecutionContext(ctx1);

      const hbReq = new Request('http://localhost/api/posts/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ peerId: 'heartbeatpeer' }),
      });
      const ctx2 = createExecutionContext();
      const hbRes = await app.fetch(hbReq, env, ctx2);
      await waitOnExecutionContext(ctx2);
      const hbBody = await hbRes.json<{ ok: boolean }>();
      expect(hbBody.ok).toBe(true);
    });
  });

  describe('Signaling route', () => {
    it('returns 426 when no WebSocket upgrade header', async () => {
      const req = new Request('http://localhost/api/signal/test-room');
      const ctx = createExecutionContext();
      const res = await app.fetch(req, testEnv, ctx);
      await waitOnExecutionContext(ctx);

      expect(res.status).toBe(426);
    });
  });

  describe('Unknown routes', () => {
    it('returns 404 for unknown API paths', async () => {
      const req = new Request('http://localhost/api/nonexistent');
      const ctx = createExecutionContext();
      const res = await app.fetch(req, testEnv, ctx);
      await waitOnExecutionContext(ctx);

      expect(res.status).toBe(404);
    });
  });
});
