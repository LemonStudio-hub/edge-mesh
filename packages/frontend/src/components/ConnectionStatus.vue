<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';

const props = defineProps<{
  peerName: string;
  connectionState: string;
  startTime: number;
}>();

const emit = defineEmits<{ disconnect: [] }>();

const elapsed = ref(0);
let timer: ReturnType<typeof setInterval> | null = null;

function startTimer() {
  stopTimer();
  if (!props.startTime || props.connectionState === 'disconnected' || props.connectionState === 'failed') {
    return;
  }
  elapsed.value = Date.now() - props.startTime;
  timer = setInterval(() => {
    if (props.connectionState === 'disconnected' || props.connectionState === 'failed') {
      stopTimer();
      return;
    }
    elapsed.value = Date.now() - props.startTime;
  }, 1000);
}

function stopTimer() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

onMounted(() => {
  startTimer();
});

onUnmounted(() => {
  stopTimer();
});

watch(() => props.connectionState, (state) => {
  if (state === 'connected' || state === 'connecting') {
    startTimer();
  } else {
    stopTimer();
  }
});

const formattedTime = computed(() => {
  if (!props.startTime) return '00:00';
  const totalSec = Math.floor(elapsed.value / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
});

const statusColor = computed(() => {
  switch (props.connectionState) {
    case 'connected': return 'var(--success)';
    case 'connecting': return 'var(--warning)';
    default: return 'var(--danger)';
  }
});

const statusLabel = computed(() => {
  switch (props.connectionState) {
    case 'connected': return 'Connected';
    case 'connecting': return 'Connecting…';
    case 'disconnected': return 'Disconnected';
    case 'failed': return 'Connection Failed';
    default: return props.connectionState;
  }
});
</script>

<template>
  <div class="connection-status">
    <div class="status-left">
      <span class="status-dot" :style="{ background: statusColor }"></span>
      <div class="status-info">
        <span class="peer-name">{{ peerName }}</span>
        <span class="status-label">{{ statusLabel }}</span>
      </div>
    </div>
    <div class="status-right">
      <span class="elapsed">{{ formattedTime }}</span>
      <button class="btn-disconnect" @click="emit('disconnect')">Disconnect</button>
    </div>
  </div>
</template>

<style scoped>
.connection-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
}

.status-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.status-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.status-info {
  display: flex;
  flex-direction: column;
}

.peer-name {
  font-weight: 600;
  font-size: 0.95rem;
}

.status-label {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.status-right {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.elapsed {
  font-size: 0.9rem;
  font-variant-numeric: tabular-nums;
  color: var(--text-muted);
  font-family: 'SF Mono', 'Consolas', 'Monaco', monospace;
}

.btn-disconnect {
  padding: 0.4rem 0.8rem;
  font-size: 0.85rem;
  background: transparent;
  color: var(--danger);
  border: 1px solid var(--danger);
  border-radius: var(--radius);
}

.btn-disconnect:hover {
  background: var(--danger);
  color: white;
}
</style>
