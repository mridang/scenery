/* scenery service worker — Web Push receiver only.
 *
 * `push` events deliver a JSON payload from NotifyWorkflow. We unpack
 * `title`, `body`, `image`, `tag`, `data.url` and let the OS render the
 * notification.
 *
 * `notificationclick` opens the site (focusing an existing tab if there
 * is one). The data.url is allowlisted to the deployed origin to avoid
 * acting on a tampered payload that could ship a foreign URL.
 *
 * Diagnostics: any payload-parse or showNotification failure is logged
 * to the SW console (visible via DevTools → Application → Service
 * Workers → Inspect) so we can tell whether the push event ever fired.
 */

const ORIGIN = 'https://scenery.apps.mrida.ng';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  console.log('[scenery sw] push event fired, dataLen=', event.data ? event.data.text().length : 'no data');
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (err) {
    console.warn('[scenery sw] payload JSON parse failed:', err);
    payload = { title: 'scenery', body: 'New movies (failed to read payload)' };
  }
  const title = payload.title || 'scenery';
  // Drop missing-asset references — a 404 on icon/badge can cause some
  // browsers to silently drop the notification. We only set what we have.
  const options = {
    body: payload.body || 'Daily movie picks',
    tag: payload.tag,
    data: { url: payload.url || ORIGIN },
    renotify: true,
    requireInteraction: true,
  };
  if (payload.image) {
    options.image = payload.image;
  }
  event.waitUntil(
    self.registration
      .showNotification(title, options)
      .then(() => console.log('[scenery sw] showNotification resolved'))
      .catch((err) => console.error('[scenery sw] showNotification rejected:', err)),
  );
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
