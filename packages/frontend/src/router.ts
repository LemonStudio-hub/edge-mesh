import { createRouter, createWebHistory } from 'vue-router';
import HomeView from './views/HomeView.vue';
import TransferView from './views/TransferView.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/transfer', name: 'transfer', component: TransferView },
  ],
});

export default router;
