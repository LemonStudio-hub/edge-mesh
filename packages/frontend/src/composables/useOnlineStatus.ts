import { ref, onMounted, onUnmounted } from 'vue';
import { usePeerStore } from '../stores/peer.js';

export function useOnlineStatus() {
  const peer = usePeerStore();
  const isPageVisible = ref(document.visibilityState === 'visible');
  const isNetworkOnline = ref(navigator.onLine);

  function handleVisibilityChange() {
    isPageVisible.value = document.visibilityState === 'visible';
    if (isPageVisible.value && isNetworkOnline.value) {
      peer.setOnline();
    } else {
      peer.setOffline();
    }
  }

  function handleOnline() {
    isNetworkOnline.value = true;
    if (isPageVisible.value) {
      peer.setOnline();
    }
  }

  function handleOffline() {
    isNetworkOnline.value = false;
    peer.setOffline();
  }

  onMounted(() => {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
  });

  onUnmounted(() => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  });

  return { isPageVisible, isNetworkOnline };
}
