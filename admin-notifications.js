import { onAuth } from './data.js?v=content-1';

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
const APP_NAME = 'consultation';
const DEVICES = 'consultation_notification_devices';
const TESTS = 'consultation_notification_tests';
const STORAGE_KEY = 'consultationPushDeviceId';
const DISABLED_KEY = 'consultationPushDisabled';

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
  ui.disable.disabled = busy || !currentUser || !currentToken;
  refreshDiagnostics();
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
      <button type="button" class="button ghost" id="disable-device-notifications" disabled>إيقاف إشعارات هذا الجهاز</button>
    </div>
    <ul id="notification-diagnostics" class="notification-settings-meta" aria-live="polite"></ul>
    <p class="notification-settings-meta">سيظهر إشعار مختصر عند وصول طلب جديد. التفاصيل الكاملة تبقى داخل لوحة الإدارة.</p>`;
  host.append(panel);
  const status = panel.querySelector('#notification-settings-status');
  ui = {
    panel,
    status,
    statusText: panel.querySelector('#notification-settings-status-text'),
    dot: status.querySelector('.notification-settings-dot'),
    enable: panel.querySelector('#enable-device-notifications'),
    test: panel.querySelector('#test-device-notification'),
    disable: panel.querySelector('#disable-device-notifications')
  };
  ui.enable.addEventListener('click', () => activateDevice(true));
  ui.test.addEventListener('click', sendTestNotification);
  ui.disable.addEventListener('click', disableDevice);
  refreshDiagnostics();
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
  if (!(await messagingSDK.isSupported())) throw new Error('Firebase Push غير مدعوم في هذا المتصفح.');
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
  const registration = await navigator.serviceWorker.register('./firebase-messaging-sw.js?v=push-2', { scope: './' });
  await registration.update().catch(() => {});
  serviceWorkerRegistration = registration;
  return registration;
}

function refreshPermissionStatus() {
  if (!ui) return;
  refreshDiagnostics();
  if (!('Notification' in globalThis)) {
    setStatus('هذا المتصفح لا يدعم إشعارات الويب.', 'error');
    ui.enable.disabled = true;
    return;
  }
  if (Notification.permission === 'denied') {
    setStatus('الإشعارات مرفوضة لهذا الموقع. فعّلها من إعدادات المتصفح ثم أعد المحاولة.', 'error');
  } else if (Notification.permission === 'granted' && currentToken) {
    setStatus('الجهاز مسجل. أرسل إشعارًا تجريبيًا للتحقق من وصوله.', 'success');
  } else if (!String(config().vapidKey || '').trim()) {
    setStatus('ينقص ربط مفتاح Web Push من إعدادات Firebase.', 'error');
  } else if (Notification.permission === 'granted') {
    setStatus('إذن الإشعارات موجود. اضغط تفعيل لربط هذا الجهاز.');
  } else {
    setStatus('إشعارات هذا الجهاز غير مفعلة بعد.');
  }
}

async function persistDevice(token, uid) {
  const { dbSDK, db } = await ensureRuntime();
  const deviceId = await sha256(token);
  const ref = dbSDK.doc(db, DEVICES, deviceId);
  const snapshot = await dbSDK.getDoc(ref);
  const createdAt = snapshot.exists() && snapshot.data()?.createdAt
    ? snapshot.data().createdAt : dbSDK.serverTimestamp();
  const userAgent = String(navigator.userAgent || '').slice(0, 500);
  await dbSDK.setDoc(ref, {
    token,
    ownerUid: uid,
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
    if (!currentUser || !currentToken) return;
    if (data.kind === 'consultation_test') setStatus('وصل الإشعار التجريبي إلى هذا الجهاز.', 'success');
    if (!('Notification' in globalThis) || Notification.permission !== 'granted') return;
    try {
    const registration = serviceWorkerRegistration || await registerServiceWorker();
    await registration.showNotification(data.title || 'طلب استشارة جديد', {
      body: data.body || 'وصل طلب جديد',
      tag: data.requestId ? `consultation-${data.requestId}` : 'consultation-notification',
      data: { url: data.url || './admin/', requestId: data.requestId || '' },
      renotify: false
    });
    } catch {
      setStatus('وصلت الرسالة، لكن المتصفح منع إظهار التنبيه.', 'error');
    }
  });
  foregroundBound = true;
}

async function activateDevice(requestPermission) {
  if (!currentUser || !ui) return;
  const activatingUid = currentUser.uid;
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
    if (!currentUser || currentUser.uid !== activatingUid) return;
    await persistDevice(token, activatingUid);
    if (currentUser?.uid !== activatingUid) return;
    currentToken = token;
    try { localStorage.removeItem(DISABLED_KEY); } catch {}
    await bindForegroundMessages();
    setStatus('الجهاز مسجل. أرسل إشعارًا تجريبيًا للتحقق من وصوله.', 'success');
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
    setStatus('تم حفظ طلب الاختبار. النجاح يتأكد عند ظهور الإشعار على الجهاز؛ إن لم يصل فراجع نشر Functions.', '');
  } catch (error) {
    console.error('Test notification failed:', error.code || error.message);
    setStatus('تعذّر إرسال الإشعار التجريبي. راجع نشر Firebase Functions والقواعد.', 'error');
  } finally {
    setBusy(false);
  }
}

function deviceOptedOut() {
  try { return localStorage.getItem(DISABLED_KEY) === 'true'; } catch { return false; }
}
function refreshDiagnostics() {
  const list = document.getElementById('notification-diagnostics');
  if (!list) return;
  const permission = 'Notification' in globalThis ? Notification.permission : 'unsupported';
  const lines = [
    config().vapidKey ? 'مفتاح Web Push: موجود في إعدادات الموقع.' : 'مفتاح Web Push: غير مضاف في consultation-config.js.',
    `إذن المتصفح: ${{ granted: 'مسموح', denied: 'مرفوض', default: 'لم يُطلب بعد', unsupported: 'غير مدعوم' }[permission]}.`,
    currentToken ? 'تسجيل الجهاز في Firebase: مكتمل.' : 'تسجيل الجهاز في Firebase: غير مكتمل.',
    'البريد والإرسال من الخادم: يتطلبان نشر Functions وإعداداتها؛ تسجيل الجهاز وحده لا يؤكدهما.'
  ];
  list.replaceChildren(...lines.map(text => { const li = document.createElement('li'); li.textContent = text; return li; }));
}
async function disableDevice() {
  if (!currentUser || !currentToken) return;
  setBusy(true);
  try {
    const { dbSDK, db, messagingSDK, messaging } = await ensureRuntime();
    const id = await sha256(currentToken);
    await dbSDK.updateDoc(dbSDK.doc(db, DEVICES, id), {
      enabled: false, lastSeenAt: dbSDK.serverTimestamp(), updatedAt: dbSDK.serverTimestamp()
    });
    try { localStorage.setItem(DISABLED_KEY, 'true'); } catch {}
    currentToken = '';
    await messagingSDK.deleteToken(messaging).catch(() => {});
    ui.enable.textContent = 'تفعيل إشعارات هذا الجهاز';
    setStatus('تم إيقاف الإشعارات على هذا الجهاز. الأجهزة الأخرى تبقى مفعلة.');
  } catch {
    setStatus('تعذّر إيقاف الإشعارات. تحقق من الاتصال وصلاحيات Firebase.', 'error');
  } finally { setBusy(false); }
}

async function handleAuth(user) {
  currentUser = user || null;
  currentToken = '';
  if (!ui) mountUi();
  if (!currentUser) {
    if (ui) {
      ui.enable.disabled = true;
      ui.test.disabled = true;
      ui.disable.disabled = true;
      ui.enable.textContent = 'تفعيل إشعارات هذا الجهاز';
      setStatus('سجّل الدخول لتفعيل إشعارات هذا الجهاز.');
    }
    return;
  }
  if (ui) ui.enable.disabled = false;
  refreshPermissionStatus();
  if ('Notification' in globalThis && Notification.permission === 'granted' && config().vapidKey && !deviceOptedOut()) {
    await activateDevice(false);
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountUi, { once: true });
else mountUi();

onAuth(handleAuth).catch(error => {
  console.error('Notification auth listener failed:', error.code || error.message);
  setStatus('تعذّر ربط إعدادات الإشعارات بحساب الإدارة.', 'error');
});
