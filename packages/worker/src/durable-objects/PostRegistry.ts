import type { Post } from '@edge-mesh/shared';

interface Env {}

const POST_EXPIRY_MS = 5 * 60 * 1000;
const OFFLINE_THRESHOLD_MS = 5 * 60 * 1000;
const MIN_ALARM_INTERVAL_MS = 60_000;

export class PostRegistry {
  private state: DurableObjectState;
  private posts: Map<string, Post> | null = null;
  private lastHeartbeat: Map<string, number> | null = null;
  private initialized = false;

  constructor(state: DurableObjectState, _env: Env) {
    this.state = state;
  }

  /** Lazy-load posts and heartbeats from SQLite storage */
  private async init() {
    if (this.initialized) return;
    this.initialized = true;

    const stored = await this.state.storage.list<Post>();
    this.posts = new Map();
    this.lastHeartbeat = new Map();

    for (const [key, value] of stored) {
      if (key.startsWith('post:')) {
        this.posts.set(key.slice(5), value);
      } else if (key.startsWith('hb:')) {
        this.lastHeartbeat.set(key.slice(3), value as unknown as number);
      }
    }

    // Schedule alarm if there are posts
    if (this.posts.size > 0) {
      await this.scheduleAlarm();
    }
  }

  /** Schedule alarm for the earliest expiry time, with a minimum interval */
  private async scheduleAlarm() {
    let earliest = Infinity;
    const now = Date.now();

    for (const post of this.posts!.values()) {
      if (post.expiresAt < earliest) earliest = post.expiresAt;
    }
    for (const [, lastSeen] of this.lastHeartbeat!) {
      const peerExpiry = lastSeen + OFFLINE_THRESHOLD_MS;
      if (peerExpiry < earliest) earliest = peerExpiry;
    }

    // Fire at the earliest expiry, but at least MIN_ALARM_INTERVAL_MS from now
    const delay = Math.max(earliest - now, MIN_ALARM_INTERVAL_MS);
    await this.state.storage.setAlarm(Date.now() + delay);
  }

  async fetch(request: Request): Promise<Response> {
    await this.init();

    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/posts' && request.method === 'GET') {
      await this.cleanupExpired();
      const posts = Array.from(this.posts!.values()).sort(
        (a, b) => b.createdAt - a.createdAt,
      );
      return Response.json(posts);
    }

    if (path === '/posts' && request.method === 'POST') {
      const body = (await request.json()) as {
        authorPeerId: string;
        authorName: string;
        content: string;
      };

      // Input validation
      if (!body.authorPeerId || !body.authorName || !body.content) {
        return Response.json(
          { error: 'authorPeerId, authorName, and content are required' },
          { status: 400 },
        );
      }

      const now = Date.now();
      const post: Post = {
        id: crypto.randomUUID(),
        authorPeerId: body.authorPeerId,
        authorName: body.authorName,
        content: body.content,
        createdAt: now,
        expiresAt: now + POST_EXPIRY_MS,
      };

      this.posts!.set(post.id, post);
      this.lastHeartbeat!.set(body.authorPeerId, now);

      // Persist to storage
      await this.state.storage.put(`post:${post.id}`, post);
      await this.state.storage.put(`hb:${body.authorPeerId}`, now);
      await this.scheduleAlarm();

      return Response.json(post, { status: 201 });
    }

    if (path.startsWith('/posts/') && request.method === 'DELETE') {
      // Extract ID safely: /posts/{id} — use URL pathname segments
      const segments = path.split('/').filter(Boolean); // removes empty strings from leading/trailing slashes
      const id = segments.length >= 2 ? segments[1] : '';

      if (!id) {
        return Response.json({ error: 'post id is required' }, { status: 400 });
      }

      const post = this.posts!.get(id);

      if (!post) {
        return Response.json({ deleted: true });
      }

      // Ownership check: require authorPeerId in query string
      const queryPeerId = url.searchParams.get('authorPeerId');
      if (queryPeerId && queryPeerId !== post.authorPeerId) {
        return Response.json({ error: 'not authorized to delete this post' }, { status: 403 });
      }

      this.posts!.delete(id);
      await this.state.storage.delete(`post:${id}`);

      return Response.json({ deleted: true });
    }

    if (path === '/heartbeat' && request.method === 'POST') {
      const body = (await request.json()) as { peerId: string };

      if (!body.peerId) {
        return Response.json({ error: 'peerId is required' }, { status: 400 });
      }

      const now = Date.now();
      this.lastHeartbeat!.set(body.peerId, now);
      await this.state.storage.put(`hb:${body.peerId}`, now);

      // Extend expiry for all posts by this peer
      for (const post of this.posts!.values()) {
        if (post.authorPeerId === body.peerId) {
          post.expiresAt = now + POST_EXPIRY_MS;
          await this.state.storage.put(`post:${post.id}`, post);
        }
      }

      return Response.json({ ok: true });
    }

    return new Response('Not found', { status: 404 });
  }

  async alarm() {
    await this.init();
    await this.cleanupExpired();

    const now = Date.now();

    for (const [peerId, lastSeen] of this.lastHeartbeat!) {
      if (now - lastSeen > OFFLINE_THRESHOLD_MS) {
        for (const [id, post] of this.posts!) {
          if (post.authorPeerId === peerId) {
            this.posts!.delete(id);
            await this.state.storage.delete(`post:${id}`);
          }
        }
        this.lastHeartbeat!.delete(peerId);
        await this.state.storage.delete(`hb:${peerId}`);
      }
    }

    // Reschedule if there are still posts
    if (this.posts!.size > 0) {
      await this.scheduleAlarm();
    }
  }

  private async cleanupExpired() {
    const now = Date.now();
    for (const [id, post] of this.posts!) {
      if (post.expiresAt < now) {
        this.posts!.delete(id);
        await this.state.storage.delete(`post:${id}`);
      }
    }
  }
}
