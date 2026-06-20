<script setup lang="ts">
defineProps<{ isOnline: boolean }>();
</script>

<template>
  <span class="badge" :class="{ online: isOnline, offline: !isOnline }">
    <span class="dot"></span>
    {{ isOnline ? 'Online' : 'Offline' }}
  </span>
</template>

<style scoped>
.badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.8rem;
  font-weight: 500;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.online {
  color: var(--success);
}

.online .dot {
  background: var(--success);
}

.offline {
  color: var(--text-muted);
}

.offline .dot {
  background: var(--text-muted);
}
</style>
