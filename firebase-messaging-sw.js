/* Firebase Cloud Messaging service worker. Public Firebase web config only; no server secrets live here. */
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyAou6PxuGGpDSNnmZ1ja4eMYIke3OR_sXY',
  authDomain: 'elite-editor-9fe62.firebaseapp.com',
  projectId: 'elite-editor-9fe62',
  storageBucket: 'elite-editor-9fe62.firebasestorage.app',
  messagingSenderId: '705152552088',
  appId: '1:705152552088:web:c9b082ee8d5f0a1565d4ed'
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
  const data = payload.data || {};
  const requestId = data.requestId || '';
  return self.registration.showNotification(data.title || 'طلب استشارة جديد', {
    body: data.body || 'وصل طلب جديد',
    tag: requestId ? `consultation-${requestId}` : 'consultation-notification',
    data: {
      url: data.url || 'https://aminellkadaoui.github.io/consultation/admin/',
      requestId
    },
    renotify: false
  });
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = event.notification.data?.url || 'https://aminellkadaoui.github.io/consultation/admin/';
  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const adminPrefix = 'https://aminellkadaoui.github.io/consultation/admin';
    for (const client of windows) {
      if (client.url.startsWith(adminPrefix)) {
        if ('navigate' in client) await client.navigate(target).catch(() => {});
        return client.focus();
      }
    }
    return clients.openWindow(target);
  })());
});
