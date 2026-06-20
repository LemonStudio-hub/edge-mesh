<script setup lang="ts">
import type { Post } from '@edge-mesh/shared';

defineProps<{ post: Post }>();
const emit = defineEmits<{ connect: [peerId: string, peerName: string] }>();

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}
</script>

<template>
  <div class="post-card">
    <div class="post-header">
      <span class="author-name">{{ post.authorName }}</span>
      <span class="online-dot"></span>
      <span class="time">{{ timeAgo(post.createdAt) }}</span>
    </div>
    <p class="post-content">{{ post.content }}</p>
    <div class="post-actions">
      <button
        class="btn-primary btn-sm"
        @click="emit('connect', post.authorPeerId, post.authorName)"
      >
        Connect
      </button>
    </div>
  </div>
</template>

<style scoped>
.post-card {
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  transition: border-color 0.15s;
}

.post-card:hover {
  border-color: var(--primary);
}

.post-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.author-name {
  font-weight: 600;
  font-size: 0.9rem;
}

.online-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--success);
}

.time {
  margin-left: auto;
  font-size: 0.8rem;
  color: var(--text-muted);
}

.post-content {
  font-size: 0.9rem;
  margin-bottom: 0.75rem;
  white-space: pre-wrap;
}

.post-actions {
  display: flex;
  justify-content: flex-end;
}

.btn-sm {
  padding: 0.35rem 0.75rem;
  font-size: 0.85rem;
}
</style>
