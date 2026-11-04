/* SafeTrip VN — Web Push handlers (v1.34).
 *
 * This file is NOT a standalone service worker: vite.config.ts adds it to
 * the Workbox-generated SW via workbox.importScripts, so the precache /
 * offline behavior stays exactly as before and this file only adds the two
 * push listeners. Plain script on purpose (importScripts has no modules).
 *
 * The payload is sent by the Cloudflare push Worker (cloudflare/worker.js):
 * a JSON string { title, body, url }. The defaults below mirror
 * that payload so a malformed push still shows the right warning. */

self.addEventListener('push', function (event) {
  var data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    /* not JSON — fall through to the default warning text */
  }
  var title = data.title || 'Sắp đến giờ điểm danh';
  var options = {
    body: data.body || 'Còn 5 phút — chạm để bấm TÔI AN TOÀN.',
    icon: '/icon-192.png',
    badge: '/favicon.png',
    // Same tag every time: a repeat warning REPLACES the previous one on
    // the lock screen instead of stacking up.
    tag: 'safetrip-dms-warning',
    renotify: true,
    // Keep the warning on screen until the traveler reacts — this is a
    // safety nudge, not a news ping. (Ignored where unsupported.)
    requireInteraction: true,
    vibrate: [300, 120, 300, 120, 300],
    data: { url: data.url || '/?tab=monitor' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var target = (event.notification.data && event.notification.data.url) || '/?tab=monitor';
  event.waitUntil(
    (async function () {
      var wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (var i = 0; i < wins.length; i++) {
        var w = wins[i];
        if (new URL(w.url).origin !== self.location.origin) continue;
        // Fast path: the app is already open — ask it to switch straight
        // to the check-in tab in place (App.tsx listens for this), so the
        // traveler lands on the TÔI AN TOÀN button with no reload.
        try { w.postMessage({ type: 'SAFETRIP_OPEN_TAB', tab: 'monitor' }); } catch (e) {}
        // Deep-link path: point the existing window at the target URL —
        // a fresh load reads ?tab= from the URL and opens that tab.
        try { if ('navigate' in w) await w.navigate(target); } catch (e) {}
        if ('focus' in w) { await w.focus(); return; }
      }
      if (self.clients.openWindow) await self.clients.openWindow(target);
    })()
  );
});
