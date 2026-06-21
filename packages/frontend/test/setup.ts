import { afterEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

// Create a fresh Pinia instance for each test
afterEach(() => {
  setActivePinia(createPinia());
});

// Ensure crypto.randomUUID exists (happy-dom may not provide it)
if (typeof globalThis.crypto.randomUUID !== 'function') {
  let uuidCounter = 0;
  (globalThis.crypto as any).randomUUID = function () {
    return `00000000-0000-0000-0000-${String(uuidCounter++).padStart(12, '0')}`;
  };
}

// Ensure crypto.subtle.digest exists
if (typeof globalThis.crypto.subtle?.digest !== 'function') {
  (globalThis.crypto as any).subtle = {
    ...globalThis.crypto.subtle,
    digest: vi.fn(async (_algorithm: string, data: ArrayBuffer) => {
      const view = new Uint8Array(32);
      const dataView = new Uint8Array(data);
      for (let i = 0; i < 32; i++) {
        view[i] = dataView[i % dataView.length] ?? 0;
      }
      return view.buffer;
    }),
  };
}
