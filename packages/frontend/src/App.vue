<script setup lang="ts">
import { RouterView } from 'vue-router';
</script>

<template>
  <div class="app">
    <header class="app-header">
      <h1 class="logo">EdgeMesh</h1>
      <p class="tagline">P2P File Distribution Network</p>
    </header>
    <main class="app-main">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  padding: 1.5rem 2rem;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}

.logo {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--primary);
  margin: 0;
}

.tagline {
  font-size: 0.85rem;
  color: var(--text-muted);
  margin: 0.25rem 0 0;
}

.app-main {
  flex: 1;
  padding: 2rem;
  max-width: 960px;
  margin: 0 auto;
  width: 100%;
}
</style>
