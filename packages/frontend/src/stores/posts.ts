import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Post } from '@edge-mesh/shared';
import { usePeerStore } from './peer.js';

export const usePostsStore = defineStore('posts', () => {
  const posts = ref<Post[]>([]);
  const loading = ref(false);

  async function fetchPosts() {
    loading.value = true;
    try {
      const res = await fetch('/api/posts');
      if (res.ok) {
        posts.value = await res.json();
      }
    } catch {
      // keep existing posts on error
    } finally {
      loading.value = false;
    }
  }

  async function createPost(content: string) {
    const peer = usePeerStore();
    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorPeerId: peer.peerId,
          authorName: peer.name,
          content,
        }),
      });
      if (res.ok) {
        const post: Post = await res.json();
        posts.value.unshift(post);
      }
    } catch {
      // handle error
    }
  }

  async function deletePost(id: string) {
    try {
      await fetch(`/api/posts/${id}`, { method: 'DELETE' });
      posts.value = posts.value.filter((p) => p.id !== id);
    } catch {
      // handle error
    }
  }

  return { posts, loading, fetchPosts, createPost, deletePost };
});
