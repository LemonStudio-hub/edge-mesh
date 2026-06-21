import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import type { Env } from '../src/env.js';

const testEnv = env as unknown as Env;

function getRegistry(): DurableObjectStub {
  const id = testEnv.POST_REGISTRY.idFromName('test-post-registry');
  return testEnv.POST_REGISTRY.get(id);
}

function createPost(
  stub: DurableObjectStub,
  overrides: Partial<{ authorPeerId: string; authorName: string; content: string }> = {},
) {
  return stub.fetch(
    new Request('https://internal/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        authorPeerId: overrides.authorPeerId ?? 'peer-aaa',
        authorName: overrides.authorName ?? 'Peer-aaa',
        content: overrides.content ?? 'Test content',
      }),
    }),
  );
}

describe('PostRegistry Durable Object', () => {
  it('starts with an empty post list', async () => {
    const stub = getRegistry();
    const res = await stub.fetch(new Request('https://internal/posts'));
    const posts = await res.json<unknown[]>();
    expect(posts).toEqual([]);
  });

  it('creates a post with correct fields', async () => {
    const stub = getRegistry();
    const res = await createPost(stub, {
      authorPeerId: 'peer-001',
      authorName: 'Peer-001',
      content: 'Hello world',
    });

    expect(res.status).toBe(201);
    const post = await res.json<{
      id: string;
      authorPeerId: string;
      authorName: string;
      content: string;
      createdAt: number;
      expiresAt: number;
    }>();

    expect(post.authorPeerId).toBe('peer-001');
    expect(post.authorName).toBe('Peer-001');
    expect(post.content).toBe('Hello world');
    expect(post.expiresAt).toBeGreaterThan(post.createdAt);
    expect(post.expiresAt - post.createdAt).toBe(5 * 60 * 1000);
  });

  it('returns posts sorted by createdAt descending', async () => {
    const stub = getRegistry();

    await createPost(stub, { authorPeerId: 'p1', content: 'first' });
    // Small delay to ensure different timestamps
    await new Promise((r) => setTimeout(r, 10));
    await createPost(stub, { authorPeerId: 'p2', content: 'second' });
    await new Promise((r) => setTimeout(r, 10));
    await createPost(stub, { authorPeerId: 'p3', content: 'third' });

    const res = await stub.fetch(new Request('https://internal/posts'));
    const posts = await res.json<{ content: string; createdAt: number }[]>();

    expect(posts.length).toBe(3);
    expect(posts[0].content).toBe('third');
    expect(posts[1].content).toBe('second');
    expect(posts[2].content).toBe('first');
  });

  it('deletes a post by id', async () => {
    const stub = getRegistry();
    const createRes = await createPost(stub, { content: 'delete me' });
    const created = await createRes.json<{ id: string }>();

    const deleteRes = await stub.fetch(
      new Request(`https://internal/posts/${created.id}`, { method: 'DELETE' }),
    );
    const body = await deleteRes.json<{ deleted: boolean }>();
    expect(body.deleted).toBe(true);

    const listRes = await stub.fetch(new Request('https://internal/posts'));
    const posts = await listRes.json<{ id: string }[]>();
    expect(posts.some((p) => p.id === created.id)).toBe(false);
  });

  it('heartbeat extends expiry for all posts by the peer', async () => {
    const stub = getRegistry();

    await createPost(stub, { authorPeerId: 'hb-peer', content: 'post 1' });
    await createPost(stub, { authorPeerId: 'hb-peer', content: 'post 2' });
    await createPost(stub, { authorPeerId: 'other-peer', content: 'post 3' });

    // Get initial expiry
    const listBefore = await stub.fetch(new Request('https://internal/posts'));
    const postsBefore = await listBefore.json<{ authorPeerId: string; content: string; expiresAt: number }[]>();
    const hbPost1Before = postsBefore.find(
      (p) => p.authorPeerId === 'hb-peer' && p.content === 'post 1',
    )!;
    const otherPostBefore = postsBefore.find((p) => p.authorPeerId === 'other-peer')!;

    // Wait a bit then send heartbeat
    await new Promise((r) => setTimeout(r, 50));

    const hbRes = await stub.fetch(
      new Request('https://internal/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ peerId: 'hb-peer' }),
      }),
    );
    expect((await hbRes.json<{ ok: boolean }>()).ok).toBe(true);

    // Check that hb-peer posts have extended expiry
    const listAfter = await stub.fetch(new Request('https://internal/posts'));
    const postsAfter = await listAfter.json<{ authorPeerId: string; content: string; expiresAt: number }[]>();
    const hbPost1After = postsAfter.find(
      (p) => p.authorPeerId === 'hb-peer' && p.content === 'post 1',
    )!;
    const otherPostAfter = postsAfter.find((p) => p.authorPeerId === 'other-peer')!;

    expect(hbPost1After.expiresAt).toBeGreaterThan(hbPost1Before.expiresAt);
    // Other peer's post expiry should be unchanged
    expect(otherPostAfter.expiresAt).toBe(otherPostBefore.expiresAt);
  });

  it('returns 404 for unknown paths', async () => {
    const stub = getRegistry();
    const res = await stub.fetch(new Request('https://internal/unknown'));
    expect(res.status).toBe(404);
  });

  it('multiple peers can create independent posts', async () => {
    const stub = getRegistry();

    await createPost(stub, { authorPeerId: 'alpha', authorName: 'Alpha', content: 'Alpha post' });
    await createPost(stub, { authorPeerId: 'beta', authorName: 'Beta', content: 'Beta post' });

    const listRes = await stub.fetch(new Request('https://internal/posts'));
    const posts = await listRes.json<{ authorPeerId: string }[]>();

    expect(posts.length).toBe(2);
    expect(posts.some((p) => p.authorPeerId === 'alpha')).toBe(true);
    expect(posts.some((p) => p.authorPeerId === 'beta')).toBe(true);
  });
});
