// Minimal Service Worker for PWA status
self.addEventListener('install', (event) => {
  console.log('Service Worker installed');
});

self.addEventListener('fetch', (event) => {
  // Pass-through for now
  event.respondWith(fetch(event.request));
});
