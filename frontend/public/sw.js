self.addEventListener('install', event => {
  // Activate immediately
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    // Delete all caches
    caches.keys()
      .then(keys => Promise.all(keys.map(key => caches.delete(key))))
      .then(() => self.clients.claim())
      .then(() => self.registration.unregister())
      .then(() => {
        // Reload all open client windows
        return self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            if (client.url) {
              client.navigate(client.url);
            }
          });
        });
      })
  );
});

// Bypass fetch completely so no caching happens
self.addEventListener('fetch', event => {
  // Do not call event.respondWith() -> passes control back to network naturally
});
