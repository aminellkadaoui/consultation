import { onAuth } from './data.js?v=sentence-2';

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
const APP_NAME = 'consultation';
const DEVICES = 'consultation_notification_devices';
const TESTS = 'consultation_notification_tests';
const STORAGE_KEY = 'consultationPushDeviceId';

let currentUser = null;
let currentToken = '';
let runtime = null;
let serviceWorkerRegistration = null;
let foregroundBound = false;
let ui = null;

function config() {
  return globalThis.CONSULTATION_CONFIG?.firebase || {};
}

function setStatus(message, state = '') {
  if (!ui) return;
  ui.statusText.textContent = message;
  ui.status.classList.toggle('is-success', state === 'success');
  ui.status.classList.toggle('is-error', state === 'error');
  ui.dot.classList.toggle('is-on', state === 'success');
  ui.dot.classList.toggle('is-off', state === 'error');
}

function setBusy(busy) {
  if (!ui) return;
  ui.enable.disabled = busy || !currentUser;
  ui.test.disabled = busy || !currentUser || !currentToken;
}

function mountUi() {
  if (document.getElementById('notification-settings-panel')) return;
  const host = document.querySelector('#setup-view .setup-grid') || document.querySelector('#setup-view');
  if (!host) return;
  const panel = document.createElement('section');
  panel.id = 'notification-settings-panel';
  panel.className = 'panel editor-section notification-settings-panel';
  panel.innerHTML = `
    <div class="notification-settings-head">
      <div>
        <p class="eyebrow">الإشعارات</p>
        <h2>إشعارات الطلبات</h2>
        <p class="notification-settings-status" id="notification-settings-status"><span class="notification-settings-dot" aria-hidden="true"></span><span id="notification-settings-status-text">تحقق من حالة هذا الجهاز.</span></p>
      </div>
    </div>
    <div class="notification-settings-actions">
      <button type="button" class="button primary" id="enable-device-notifications">تفعيل إشعارات هذا الجهاز</button>
      <button type="button" class="button secondary" id="test-device-notification" disabled>إرسال إشعار تجريبي</button>
    </div>
    <p class="notification-settings-meta">سيظهر إشعار مختصر عند وصول طلب جديد. التفاصيل الكاملة تبقى داخل لوحة الإدارة.</p>`;
  host.append(panel);
  const status = panel.querySelector('#notification-settings-status');
  ui = {
    panel,
    status,
    statusText: panel.querySelector('#notification-settings-status-text'),
    dot: status.querySelector('.notification-settings-dot'),
    enable: panel.querySelector('#enable-device-notifications'),
    test: panel.querySelector('#test-device-notification')
  };
  ui.enable.addEventListener('click', () => activateDevice(true));
  ui.test.addEventListener('click', sendTestNotification);
  refreshPermissionStatus();
}

async function ensureRuntime() {
  if (runtime) return runtime;
  const [appSDK, dbSDK, messagingSDK] = await Promise.all([
    import(`${SDK}firebase-app.js`),
    import(`${SDK}firebase-firestore.js`),
    import(`${SDK}firebase-messaging.js`)
  ]);
  const app = appSDK.getApps().find(item => item.name === APP_NAME);
  if (!app) throw new Error('Firebase admin session is not initialized.');
  const firebaseConfig = config();
  const databaseId = firebaseConfig.databaseId || '(default)';
  runtime = {
    dbSDK,
    messagingSDK,
    db: dbSDK.getFirestore(app, databaseId),
    messaging: messagingSDK.getMessaging(app)
  };
  return runtime;
}

async function sha256(value) {
  const input = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', input);
  return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function localDeviceId() {
  try { return localStorage.getItem(STORAGE_KEY) || ''; } catch { return ''; }
}

function saveLocalDeviceId(value) {
  try { localStorage.setItem(STORAGE_KEY, value); } catch {}
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) throw new Error('هذا المتصفح لا يدعم Service Worker.');
  const registration = await navigator.serviceWorker.register('./firebase-messaging-sw.js?v=push-1', { scope: './' });
  await registration.update().catch(() => {});
  serviceWorkerRegistration = registration;
  return registration;
}

function refreshPermissionStatus() {
  if (!ui) return;
  if (!('Notification' in globalThis)) {
    setStatus('هذا المتصفح لا يدعم إشعارات الويب.', 'error');
    ui.enable.disabled = true;
    return;
  }
  if (Notification.permission === 'denied') {
    setStatus('الإشعارات مرفوضة لهذا الموقع. فعّلها من إعدادات المتصفح ثم أعد المحاولة.', 'error');
  } else if (Notification.permission === 'granted' && currentToken) {
    setStatus('✓ إشعارات هذا الجهاز مفعلة', 'success');
  } else if (Notification.permission === 'granted') {
    setStatus('إذن الإشعارات موجود. جارٍ ربط هذا الجهاز…');
  } else {
    setStatus('إشعارات هذا الجهاز غير مفعلة بعد.');
  }
}

async function persistDevice(token) {
  const { dbSDK, db } = await ensureRuntime();
  const deviceId = await sha256(token);
  const ref = dbSDK.doc(db, DEVICES, deviceId);
  const snapshot = await dbSDK.getDoc(ref);
  const createdAt = snapshot.exists() && snapshot.data()?.createdAt
    ? snapshot.data().createdAt : dbSDK.serverTimestamp();
  const userAgent = String(navigator.userAgent || '').slice(0, 500);
  await dbSDK.setDoc(ref, {
    token,
    ownerUid: currentUser.uid,
    enabled: true,
    userAgent,
    createdAt,
    lastSeenAt: dbSDK.serverTimestamp(),
    updatedAt: dbSDK.serverTimestamp()
  });

  const previousId = localDeviceId();
  if (previousId && previousId !== deviceId && /^[a-f0-9]{64}$/.test(previousId)) {
    await dbSDK.setDoc(dbSDK.doc(db, DEVICES, previousId), {
      enabled: false,
      lastSeenAt: dbSDK.serverTimestamp(),
      updatedAt: dbSDK.serverTimestamp()
    }, { merge: true }).catch(() => {});
  }
  saveLocalDeviceId(deviceId);
  return deviceId;
}

async function bindForegroundMessages() {
  if (foregroundBound) return;
  const { messagingSDK, messaging } = await ensureRuntime();
  messagingSDK.onMessage(messaging, async payload => {
    const data = payload.data || {};
    if (!('Notification' in globalThis) || Notification.permission !== 'granted') return;
    const registration = serviceWorkerRegistration || await registerServiceWorker();
    await registration.showNotification(data.title || 'طلب استشارة جديد', {
      body: data.body || 'وصل طلب جديد',
      tag: data.requestId ? `consultation-${data.requestId}` : 'consultation-notification',
      data: { url: data.url || './admin/', requestId: data.requestId || '' },
      renotify: false
    });
  });
  foregroundBound = true;
}

async function activateDevice(requestPermission) {
  if (!currentUser || !ui) return;
  setBusy(true);
  try {
    if (!('Notification' in globalThis)) throw new Error('هذا المتصفح لا يدعم إشعارات الويب.');
    const vapidKey = String(config().vapidKey || '').trim();
    if (!vapidKey) throw new Error('لم تتم إضافة Web Push key للمشروع بعد.');
    if (requestPermission && Notification.permission === 'default') await Notification.requestPermission();
    if (Notification.permission !== 'granted') {
      refreshPermissionStatus();
      return;
    }
    const { messagingSDK, messaging } = await ensureRuntime();
    if (!(await messagingSDK.isSupported())) throw new Error('Firebase Push غير مدعوم في هذا المتصفح.');
    const registration = await registerServiceWorker();
    const token = await messagingSDK.getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
    if (!token) throw new Error('تعذّر إنشاء Push token لهذا الجهاز.');
    await persistDevice(token);
    currentToken = token;
    await bindForegroundMessages();
    setStatus('✓ إشعارات هذا الجهاز مفعلة', 'success');
    ui.enable.textContent = '✓ إشعارات هذا الجهاز مفعلة';
  } catch (error) {
    console.error('Notification activation failed:', error.code || error.message);
    setStatus(error.message || 'تعذّر تفعيل الإشعارات على هذا الجهاز.', 'error');
  } finally {
    setBusy(false);
  }
}

async function sendTestNotification() {
  if (!currentUser || !currentToken || !ui) return;
  setBusy(true);
  try {
    const { dbSDK, db } = await ensureRuntime();
    await dbSDK.addDoc(dbSDK.collection(db, TESTS), {
      uid: currentUser.uid,
      token: currentToken,
      requestedAt: dbSDK.serverTimestamp()
    });
    setStatus('تم إرسال طلب الإشعار التجريبي. يفترض أن يظهر خلال لحظات.', 'success');
  } catch (error) {
    console.error('Test notification failed:', error.code || error.message);
    setStatus('تعذّر إرسال الإشعار التجريبي. راجع نشر Firebase Functions والقواعد.', 'error');
  } finally {
    setBusy(false);
  }
}

async function handleAuth(user) {
  currentUser = user || null;
  currentToken = '';
  if (!ui) mountUi();
  if (!currentUser) {
    if (ui) {
      ui.enable.disabled = true;
      ui.test.disabled = true;
      setStatus('سجّل الدخول لتفعيل إشعارات هذا الجهاز.');
    }
    return;
  }
  if (ui) ui.enable.disabled = false;
  refreshPermissionStatus();
  if ('Notification' in globalThis && Notification.permission === 'granted' && config().vapidKey) {
    await activateDevice(false);
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountUi, { once: true });
else mountUi();

onAuth(handleAuth).catch(error => {
  console.error('Notification auth listener failed:', error.code || error.message);
  setStatus('تعذّر ربط إعدادات الإشعارات بحساب الإدارة.', 'error');
});
