/* scenery service worker — Web Push receiver only.
 *
 * `push` events deliver a JSON payload from NotifyWorkflow. We unpack
 * `title`, `body`, `image`, `tag`, `data.url` and let the OS render the
 * notification.
 *
 * `notificationclick` opens the site (focusing an existing tab if there
 * is one). The data.url is allowlisted to the deployed origin to avoid
 * acting on a tampered payload that could ship a foreign URL.
 */

const ORIGIN = 'https://scenery.apps.mrida.ng';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'scenery', body: '' };
  }
  const title = payload.title || 'scenery';
  const options = {
    body: payload.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    image: payload.image,
    tag: payload.tag,
    data: { url: payload.url || ORIGIN },
    renotify: true,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target =
    event.notification.data && event.notification.data.url
      ? event.notification.data.url
      : ORIGIN;
  const safeUrl = target.startsWith(ORIGIN) ? target : ORIGIN;
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((wins) => {
        const existing = wins.find((win) => win.url.startsWith(ORIGIN));
        if (existing) {
          existing.focus();
          existing.navigate(safeUrl);
          return undefined;
        }
        return self.clients.openWindow(safeUrl);
      }),
  );
});
