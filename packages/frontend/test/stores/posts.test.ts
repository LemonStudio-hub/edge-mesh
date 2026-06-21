import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { usePostsStore } from '@/stores/posts.js';
import { usePeerStore } from '@/stores/peer.js';
import type { Post } from '@edge-mesh/shared';

function mockFetch(response: unknown, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(response),
  });
}

const testPost: Post = {
  id: 'post-1',
  authorPeerId: 'peer-aaa',
  authorName: 'Peer-aaa',
  content: 'Test post content',
  createdAt: Date.now(),
  expiresAt: Date.now() + 300_000,
};

describe('usePostsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    // Initialize peer store so createPost has a peerId
    const peer = usePeerStore();
    peer.$patch({ peerId: 'test-peer-id', name: 'TestPeer' });
  });

  describe('fetchPosts', () => {
    it('populates posts array on success', async () => {
      const posts = [testPost, { ...testPost, id: 'post-2', content: 'Second' }];
      globalThis.fetch = mockFetch(posts);

      const store = usePostsStore();
      await store.fetchPosts();

      expect(store.posts).toHaveLength(2);
      expect(store.posts[0].id).toBe('post-1');
      expect(store.posts[1].id).toBe('post-2');
    });

    it('keeps existing posts on fetch error', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const store = usePostsStore();
      store.posts = [testPost];
      await store.fetchPosts();

      expect(store.posts).toHaveLength(1);
      expect(store.posts[0].id).toBe('post-1');
    });

    it('sets loading state correctly', async () => {
      let resolveFetch: (v: unknown) => void;
      const fetchPromise = new Promise((resolve) => { resolveFetch = resolve; });
      globalThis.fetch = vi.fn().mockReturnValue(fetchPromise);

      const store = usePostsStore();
      expect(store.loading).toBe(false);

      const fetchCall = store.fetchPosts();
      expect(store.loading).toBe(true);

      resolveFetch!({ ok: true, json: () => Promise.resolve([]) });
      await fetchCall;

      expect(store.loading).toBe(false);
    });

    it('sets loading to false on error', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('fail'));

      const store = usePostsStore();
      await store.fetchPosts();

      expect(store.loading).toBe(false);
    });
  });

  describe('createPost', () => {
    it('prepends new post to array on success', async () => {
      const existingPost = { ...testPost, id: 'existing' };
      const newPost = { ...testPost, id: 'new-post', content: 'New!' };
      globalThis.fetch = mockFetch(newPost);

      const store = usePostsStore();
      store.posts = [existingPost];
      await store.createPost('New!');

      expect(store.posts).toHaveLength(2);
      expect(store.posts[0].id).toBe('new-post');
      expect(store.posts[1].id).toBe('existing');
    });

    it('does not modify posts on error', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('fail'));

      const store = usePostsStore();
      store.posts = [testPost];
      await store.createPost('Will fail');

      expect(store.posts).toHaveLength(1);
    });

    it('sends correct payload in POST request', async () => {
      globalThis.fetch = mockFetch(testPost);

      const store = usePostsStore();
      await store.createPost('Hello!');

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/posts'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('"content":"Hello!"'),
        }),
      );
    });
  });

  describe('deletePost', () => {
    it('removes post from array on success', async () => {
      globalThis.fetch = mockFetch({ deleted: true });

      const store = usePostsStore();
      store.posts = [testPost, { ...testPost, id: 'post-2' }];
      await store.deletePost('post-1');

      expect(store.posts).toHaveLength(1);
      expect(store.posts[0].id).toBe('post-2');
    });

    it('sends DELETE request with correct URL', async () => {
      globalThis.fetch = mockFetch({ deleted: true });

      const store = usePostsStore();
      store.posts = [testPost];
      await store.deletePost('post-1');

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/posts/post-1'),
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });
});
