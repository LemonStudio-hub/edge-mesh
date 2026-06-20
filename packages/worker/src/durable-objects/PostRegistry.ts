import type { Post } from '@edge-mesh/shared';

interface Env {
  // No bindings needed for this DO
}

export class PostRegistry {
  private state: DurableObjectState;
  private posts: Map<string, Post> = new Map();
  private lastHeartbeat: Map<string, number> = new Map();
  private alarmScheduled = false;

  constructor(state: DurableObjectState, _env: Env) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/posts' && request.method === 'GET') {
      this.cleanupExpired();
      const posts = Array.from(this.posts.values()).sort(
        (a, b) => b.createdAt - a.createdAt
      );
      return Response.json(posts);
    }

    if (path === '/posts' && request.method === 'POST') {
      const body = (await request.json()) as {
        authorPeerId: string;
        authorName: string;
        content: string;
      };

      const now = Date.now();
      const post: Post = {
        id: crypto.randomUUID(),
        authorPeerId: body.authorPeerId,
        authorName: body.authorName,
        content: body.content,
        createdAt: now,
        expiresAt: now + 5 * 60 * 1000, // 5 min default
      };

      this.posts.set(post.id, post);
      this.lastHeartbeat.set(body.authorPeerId, now);
      await this.ensureAlarm();
      return Response.json(post, { status: 201 });
    }

    if (path.startsWith('/posts/') && request.method === 'DELETE') {
      const id = path.split('/')[2];
      this.posts.delete(id);
      return Response.json({ deleted: true });
    }

    if (path === '/heartbeat' && request.method === 'POST') {
      const body = (await request.json()) as { peerId: string };
      const now = Date.now();
      this.lastHeartbeat.set(body.peerId, now);

      // Extend expiry for all posts by this peer
      for (const post of this.posts.values()) {
        if (post.authorPeerId === body.peerId) {
          post.expiresAt = now + 5 * 60 * 1000;
        }
      }
      return Response.json({ ok: true });
    }

    return new Response('Not found', { status: 404 });
  }

  async alarm() {
    this.cleanupExpired();

    // Remove posts for peers that haven't sent a heartbeat in 5 minutes
    const now = Date.now();
    const offlineThreshold = 5 * 60 * 1000;

    for (const [peerId, lastSeen] of this.lastHeartbeat) {
      if (now - lastSeen > offlineThreshold) {
        // Delete all posts by this offline peer
        for (const [id, post] of this.posts) {
          if (post.authorPeerId === peerId) {
            this.posts.delete(id);
          }
        }
        this.lastHeartbeat.delete(peerId);
      }
    }

    // Reschedule if there are still posts
    if (this.posts.size > 0) {
      await this.state.storage.setAlarm(Date.now() + 60_000);
    } else {
      this.alarmScheduled = false;
    }
  }

  private cleanupExpired() {
    const now = Date.now();
    for (const [id, post] of this.posts) {
      if (post.expiresAt < now) {
        this.posts.delete(id);
      }
    }
  }

  private async ensureAlarm() {
    if (!this.alarmScheduled) {
      this.alarmScheduled = true;
      await this.state.storage.setAlarm(Date.now() + 60_000);
    }
  }
}
