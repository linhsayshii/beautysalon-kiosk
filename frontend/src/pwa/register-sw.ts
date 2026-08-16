export function registerServiceWorker() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator && process.env.NODE_ENV !== 'test') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('[PWA] Service worker registration failed:', err);
      });
    });
  }
}

export function syncStoreNameWithTitleAndManifest(storeName?: string) {
  if (!storeName || typeof document === 'undefined') return;
  document.title = `${storeName} - Salon & Spa`;
}
