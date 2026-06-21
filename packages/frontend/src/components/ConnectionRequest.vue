<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { CONNECTION_REQUEST_TIMEOUT_MS } from '@edge-mesh/shared';

const props = defineProps<{
  fromName: string;
  fromPeerId: string;
}>();

const emit = defineEmits<{
  accept: [];
  reject: [];
}>();

const timeLeft = ref(CONNECTION_REQUEST_TIMEOUT_MS / 1000);
const status = ref<'pending' | 'accepted' | 'rejected'>('pending');
let timer: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  timer = setInterval(() => {
    if (status.value !== 'pending') return;
    timeLeft.value--;
    if (timeLeft.value <= 0) {
      status.value = 'rejected';
      emit('reject');
    }
  }, 1000);
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
});

function handleAccept() {
  if (status.value !== 'pending') return;
  status.value = 'accepted';
  if (timer) clearInterval(timer);
  emit('accept');
}

function handleReject() {
  if (status.value !== 'pending') return;
  status.value = 'rejected';
  if (timer) clearInterval(timer);
  emit('reject');
}
</script>

<template>
  <div class="overlay">
    <div class="dialog">
      <h3>Connection Request</h3>
      <p class="message">
        <strong>{{ fromName }}</strong> wants to connect with you for file sharing.
      </p>
      <p v-if="status === 'pending'" class="timer">Auto-reject in {{ timeLeft }}s</p>
      <p v-else-if="status === 'accepted'" class="connecting">
        <span class="connecting-spinner"></span>
        Connecting…
      </p>
      <div class="actions">
        <button class="btn-ghost" :disabled="status !== 'pending'" @click="handleReject">Reject</button>
        <button class="btn-primary" :disabled="status !== 'pending'" @click="handleAccept">
          {{ status === 'accepted' ? 'Connecting…' : 'Accept' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.dialog {
  background: var(--surface);
  padding: 2rem;
  border-radius: 12px;
  max-width: 400px;
  width: 90%;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
}

h3 {
  margin: 0 0 1rem;
  font-size: 1.2rem;
}

.message {
  margin-bottom: 0.5rem;
  line-height: 1.5;
}

.timer {
  font-size: 0.85rem;
  color: var(--text-muted);
  margin-bottom: 1.5rem;
}

.actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}

.connecting {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  color: var(--primary);
  margin-bottom: 1.5rem;
}

.connecting-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid var(--border);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
