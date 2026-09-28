export function registerServiceWorker() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator && process.env.NODE_ENV !== 'test') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch((err) => {
        console.warn('[PWA] Service worker registration failed:', err);
      });
    });
  }
}

export function syncStoreNameWithDocument(storeName?: string) {
  if (!storeName || typeof document === 'undefined') return;
  document.title = `${storeName} - Salon & Spa`;
  document.documentElement.dataset.storeName = storeName;
  document.querySelector('meta[name="description"]')?.setAttribute('content', `Dashboard quản trị ${storeName}`);
  document.querySelector('meta[name="apple-mobile-web-app-title"]')?.setAttribute('content', storeName);
}
