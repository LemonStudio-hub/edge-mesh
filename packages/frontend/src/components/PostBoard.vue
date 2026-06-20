<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { usePostsStore } from '../stores/posts.js';
import PostCard from './PostCard.vue';

const posts = usePostsStore();
const emit = defineEmits<{ connect: [peerId: string, peerName: string] }>();

let refreshTimer: ReturnType<typeof setInterval>;

onMounted(() => {
  posts.fetchPosts();
  refreshTimer = setInterval(() => posts.fetchPosts(), 10000);
});

onUnmounted(() => {
  clearInterval(refreshTimer);
});
</script>

<template>
  <section class="post-board">
    <div class="board-header">
      <h2>Active Posts</h2>
      <span class="count">{{ posts.posts.length }} online</span>
    </div>
    <div v-if="posts.loading" class="loading">Loading posts...</div>
    <div v-else-if="posts.posts.length === 0" class="empty">
      No active posts. Be the first to publish!
    </div>
    <div v-else class="posts-grid">
      <PostCard
        v-for="post in posts.posts"
        :key="post.id"
        :post="post"
        @connect="(id, name) => emit('connect', id, name)"
      />
    </div>
  </section>
</template>

<style scoped>
.post-board {
  background: var(--surface);
  padding: 1.5rem;
  border-radius: var(--radius);
  box-shadow: var(--shadow);
}

.board-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

h2 {
  font-size: 1.1rem;
}

.count {
  font-size: 0.85rem;
  color: var(--text-muted);
}

.loading,
.empty {
  text-align: center;
  padding: 2rem;
  color: var(--text-muted);
}

.posts-grid {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
</style>
