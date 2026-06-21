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
let timer: ReturnType<typeof setInterval> | null = null;
let settled = false;

onMounted(() => {
  timer = setInterval(() => {
    if (settled) return;
    timeLeft.value--;
    if (timeLeft.value <= 0) {
      settled = true;
      emit('reject');
    }
  }, 1000);
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
});

function handleAccept() {
  if (settled) return;
  settled = true;
  if (timer) clearInterval(timer);
  emit('accept');
}

function handleReject() {
  if (settled) return;
  settled = true;
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
      <p class="timer">Auto-reject in {{ timeLeft }}s</p>
      <div class="actions">
        <button class="btn-ghost" @click="handleReject">Reject</button>
        <button class="btn-primary" @click="handleAccept">Accept</button>
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
</style>
