<script setup lang="ts">
import { ref } from 'vue';
import { usePeerStore } from '../stores/peer.js';
import { usePostsStore } from '../stores/posts.js';

const peer = usePeerStore();
const posts = usePostsStore();

const content = ref('');

async function submit() {
  if (!content.value.trim() || !peer.isOnline) return;
  await posts.createPost(content.value.trim());
  content.value = '';
}
</script>

<template>
  <section class="create-post">
    <h2>Create Post</h2>
    <div class="form-row">
      <textarea
        v-model="content"
        placeholder="Share something with the network..."
        rows="3"
        :disabled="!peer.isOnline"
      ></textarea>
    </div>
    <div class="form-actions">
      <span v-if="!peer.isOnline" class="offline-hint">You must be online to post</span>
      <button class="btn-primary" :disabled="!content.trim() || !peer.isOnline" @click="submit">
        Publish
      </button>
    </div>
  </section>
</template>

<style scoped>
.create-post {
  background: var(--surface);
  padding: 1.5rem;
  border-radius: var(--radius);
  box-shadow: var(--shadow);
}

h2 {
  font-size: 1.1rem;
  margin-bottom: 1rem;
}

.form-row {
  margin-bottom: 0.75rem;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 1rem;
}

.offline-hint {
  font-size: 0.85rem;
  color: var(--warning);
}
</style>
