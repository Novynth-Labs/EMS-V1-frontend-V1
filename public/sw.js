// ============================================================================
// Novynth EMS Service Worker: Web Push Background Notification Engine
// Compatible with Chrome, Edge, Firefox, Safari (macOS/iOS) & Android PWA
// ============================================================================

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// ── PUSH EVENT: Receive Background Push Protocol Messages ───────────────────
self.addEventListener('push', (event) => {
  if (!event.data) {
    return;
  }

  let data = {};
  try {
    data = event.data.json();
  } catch (e) {
    try {
      data = { title: 'Novynth EMS', body: event.data.text() };
    } catch (_) {
      data = { title: 'Novynth EMS Notification', body: 'New notification received' };
    }
  }

  const title = data.title || 'Novynth EMS';
  const type = data.data?.type || 'general';

  // Customize vibration and actions based on notification type
  let vibrationPattern = [100, 50, 100];
  let notificationActions = data.actions || [];
  let requireInteraction = Boolean(data.requireInteraction);

  if (type === 'incoming_call') {
    vibrationPattern = [300, 100, 300, 100, 300, 200, 500];
    requireInteraction = true;
    if (!notificationActions.length) {
      notificationActions = [
        { action: 'accept', title: 'Accept 📞' },
        { action: 'reject', title: 'Decline ❌' }
      ];
    }
  } else if (type === 'chat_message' || type === 'group_message') {
    vibrationPattern = [150, 50, 150];
    if (!notificationActions.length) {
      notificationActions = [
        { action: 'open', title: 'Reply 💬' }
      ];
    }
  } else if (type === 'missed_call') {
    vibrationPattern = [200, 100, 200];
    if (!notificationActions.length) {
      notificationActions = [
        { action: 'view', title: 'View 📵' }
      ];
    }
  }

  const options = {
    body: data.body || '',
    icon: data.icon || '/logo.png',
    badge: data.badge || '/favicon.svg',
    tag: data.tag || `notif_${Date.now()}`,
    vibrate: vibrationPattern,
    requireInteraction: requireInteraction,
    renotify: data.renotify !== false,
    silent: Boolean(data.silent),
    data: {
      url: data.data?.url || '/#/dashboard',
      type: type,
      meetingId: data.data?.meetingId || data.data?.roomId,
      chatId: data.data?.chatId,
      groupId: data.data?.groupId,
      timestamp: data.data?.timestamp || new Date().toISOString(),
      ...data.data
    },
    actions: notificationActions
  };

  // Broadcast to open client windows so active tabs can synchronize state immediately
  const broadcastPromise = self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    .then((windowClients) => {
      windowClients.forEach((client) => {
        client.postMessage({
          type: 'PUSH_NOTIFICATION_RECEIVED',
          payload: {
            title,
            options
          }
        });
      });
    })
    .catch((err) => console.warn('[SW] Error broadcasting to open windows:', err));

  // Display the system notification
  const showNotificationPromise = self.registration.showNotification(title, options);

  event.waitUntil(Promise.all([broadcastPromise, showNotificationPromise]));
});

// ── NOTIFICATION CLICK EVENT: Handle User Actions & Window Navigation ───────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const action = event.action;
  const notifData = event.notification.data || {};
  const targetUrl = notifData.url || '/#/dashboard';

  // If user declined an incoming call from notification action
  if (action === 'reject') {
    const notifyRejectPromise = self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        windowClients.forEach((client) => {
          client.postMessage({
            type: 'CALL_DECLINED_FROM_NOTIFICATION',
            meetingId: notifData.meetingId
          });
        });
      });
    event.waitUntil(notifyRejectPromise);
    return;
  }

  // Normal click or 'accept' / 'open' action: Focus existing window or open new one
  const clickHandlerPromise = self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    .then((windowClients) => {
      // 1. If an existing app window is open, focus it and navigate
      for (const client of windowClients) {
        if ('focus' in client) {
          client.postMessage({
            type: 'NOTIFICATION_NAVIGATE',
            url: targetUrl,
            action: action,
            data: notifData
          });
          return client.focus();
        }
      }

      // 2. If no window is currently open, open a new window at the target destination
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    });

  event.waitUntil(clickHandlerPromise);
});

// ── NOTIFICATION CLOSE EVENT ────────────────────────────────────────────────
self.addEventListener('notificationclose', (event) => {
  const notifData = event.notification.data || {};
  self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    .then((windowClients) => {
      windowClients.forEach((client) => {
        client.postMessage({
          type: 'NOTIFICATION_DISMISSED',
          data: notifData
        });
      });
    })
    .catch(() => {});
});

