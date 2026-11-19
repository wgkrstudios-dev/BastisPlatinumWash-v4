self.addEventListener('install', (event) => {
    try {
        self.skipWaiting();
    } catch (err) {
        console.error('Service Worker install error:', err);
        if (self.Sentry && typeof self.Sentry.captureException === 'function') {
            self.Sentry.captureException(err);
        }
    }
});

self.addEventListener('activate', (event) => {
    try {
        event.waitUntil(self.clients.claim());
    } catch (err) {
        console.error('Service Worker activate error:', err);
        if (self.Sentry && typeof self.Sentry.captureException === 'function') {
            self.Sentry.captureException(err);
        }
    }
});

self.addEventListener('fetch', (event) => {
    try {
        event.respondWith(fetch(event.request));
    } catch (err) {
        console.error('Service Worker fetch error:', err);
        if (self.Sentry && typeof self.Sentry.captureException === 'function') {
            self.Sentry.captureException(err);
        }
    }
});
