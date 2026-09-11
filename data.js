/* Shared data layer. Firebase loads only when a method needs it. */
const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
const APP_NAME = 'consultation';
const REQUESTS = 'consultation_requests';
const SETTINGS = 'consultation_settings';
const DEFAULT_FIREBASE = Object.freeze({
  apiKey: 'AIzaSyAou6PxuGGpDSNnmZ1ja4eMYIke3OR_sXY',
  authDomain: 'elite-editor-9fe62.firebaseapp.com',
  projectId: 'elite-editor-9fe62',
  storageBucket: 'elite-editor-9fe62.firebasestorage.app',
  messagingSenderId: '705152552088',
  appId: '1:705152552088:web:c9b082ee8d5f0a1565d4ed'
});

export const REQUEST_LIMITS = Object.freeze({
  fullName: 120, whatsapp: 32, instagram: 80,
  experience: 80, clientCount: 40, editingType: 200,
  problem: 2000, impact: 2000, goal: 2000,
  approach: 2000, obstacle: 2000, sessionOutcome: 2000
});
export const REQUEST_STATUSES = Object.freeze([
  'new', 'reviewing', 'accepted', 'scheduled', 'completed', 'archived'
]);
const SETTINGS_DEFAULTS = Object.freeze({
  brand: 'أمين',
  headline: 'تعمل كإديتور، لكنك محتار على ماذا تركز الآن؟',
  subheadline: 'نراجع المشكلة التي تواجهك، ونحدد ما يحتاج تركيزك الآن، وما تفعله أولًا.',
  price: 300, currency: 'درهم مغربي', durationMinutes: 60, actionDocHours: 24,
  videoUrl: '', videoPoster: '', bookingUrl: '', contactWhatsapp: '', testimonials: []
});
const SETTINGS_LIMITS = Object.freeze({
  brand: 120, headline: 240, subheadline: 1000, currency: 12,
  videoUrl: 2048, videoPoster: 2048, bookingUrl: 2048, contactWhatsapp: 64
});

let runtime = null;
let initialization = null;

function invalid(message) {
  const error = new Error(message);
  error.code = 'consultation/invalid-data';
  return error;
}

function textValue(value, name, max, required = true) {
  if (value === undefined || value === null) value = '';
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw invalid(`قيمة غير صالحة: ${name}`);
  }
  const text = String(value).trim();
  if ((required && !text) || text.length > max) {
    throw invalid(`راجع الحقل ${name}؛ الحد الأقصى ${max} حرفًا.`);
  }
  return text;
}

async function ensureFirebase() {
  if (runtime) return runtime;
  if (initialization) return initialization;
  initialization = (async () => {
    const [appSDK, authSDK, dbSDK] = await Promise.all([
      import(`${SDK}firebase-app.js`),
      import(`${SDK}firebase-auth.js`),
      import(`${SDK}firebase-firestore.js`)
    ]);
    const config = { ...DEFAULT_FIREBASE, ...(globalThis.CONSULTATION_CONFIG?.firebase || {}) };
    const databaseId = config.databaseId || '(default)';
    delete config.databaseId;
    const app = appSDK.getApps().find((item) => item.name === APP_NAME)
      || appSDK.initializeApp(config, APP_NAME);
    runtime = { authSDK, dbSDK, auth: authSDK.getAuth(app), db: dbSDK.getFirestore(app, databaseId) };
    return runtime;
  })();
  try {
    return await initialization;
  } catch (error) {
    initialization = null;
    throw error;
  }
}

function ensureAdminSession(auth) {
  if (!auth.currentUser) {
    const error = new Error('سجّل الدخول إلى لوحة الإدارة أولًا.');
    error.code = 'consultation/sign-in-required';
    throw error;
  }
  // Actual authorization is enforced by the UID allowlist in firestore.rules.
}

function normalizeTimestamp(value) {
  return value && typeof value.toDate === 'function' ? value.toDate().toISOString() : value || null;
}

export function getCurrentUser() {
  return runtime?.auth.currentUser || null;
}

export async function onAuth(callback) {
  const { authSDK, auth } = await ensureFirebase();
  return authSDK.onAuthStateChanged(auth, callback);
}

export async function login(email, password) {
  const { authSDK, auth } = await ensureFirebase();
  await authSDK.setPersistence(auth, authSDK.browserSessionPersistence);
  return (await authSDK.signInWithEmailAndPassword(auth, String(email).trim(), password)).user;
}

export async function logout() {
  const { authSDK, auth } = await ensureFirebase();
  await authSDK.signOut(auth);
}

export async function submitRequest(data) {
  const fields = {};
  for (const [name, max] of Object.entries(REQUEST_LIMITS)) {
    fields[name] = textValue(data?.[name], name, max);
  }
  if (globalThis.navigator?.onLine === false) {
    const error = new Error('اتصل بالإنترنت ثم أعد إرسال الطلب.');
    error.code = 'consultation/offline';
    throw error;
  }
  const { dbSDK, db } = await ensureFirebase();
  const payload = { ...fields, status: 'new', schemaVersion: 1, submittedAt: dbSDK.serverTimestamp() };
  const doc = await dbSDK.addDoc(dbSDK.collection(db, REQUESTS), payload);
  // Public clients cannot read requests. This receipt time is local; admin reads the server timestamp.
  return { id: doc.id, ...fields, status: 'new', schemaVersion: 1, submittedAt: new Date().toISOString() };
}

export async function listRequests() {
  const { dbSDK, db, auth } = await ensureFirebase();
  ensureAdminSession(auth);
  const result = await dbSDK.getDocsFromServer(dbSDK.query(
    dbSDK.collection(db, REQUESTS), dbSDK.orderBy('submittedAt', 'desc')
  ));
  return result.docs.map((doc) => {
    const data = doc.data();
    return { ...data, id: doc.id, submittedAt: normalizeTimestamp(data.submittedAt), updatedAt: normalizeTimestamp(data.updatedAt) };
  });
}

export async function updateRequest(id, fields) {
  if (typeof id !== 'string' || !id || id.includes('/')) throw invalid('معرّف الطلب غير صالح.');
  const changes = {};
  for (const key of Object.keys(fields || {})) {
    if (!['status', 'privateNotes'].includes(key)) throw invalid('يمكن تعديل الحالة والملاحظات فقط.');
  }
  if (Object.hasOwn(fields || {}, 'status')) {
    if (!REQUEST_STATUSES.includes(fields.status)) throw invalid('حالة الطلب غير صالحة.');
    changes.status = fields.status;
  }
  if (Object.hasOwn(fields || {}, 'privateNotes')) {
    changes.privateNotes = textValue(fields.privateNotes, 'الملاحظات الخاصة', 6000, false);
  }
  if (!Object.keys(changes).length) throw invalid('لا توجد تغييرات للحفظ.');
  const { dbSDK, db, auth } = await ensureFirebase();
  ensureAdminSession(auth);
  await dbSDK.updateDoc(dbSDK.doc(db, REQUESTS, id), { ...changes, updatedAt: dbSDK.serverTimestamp() });
  return { id, ...changes };
}

export async function loadSettings() {
  const { dbSDK, db } = await ensureFirebase();
  const result = await dbSDK.getDocFromServer(dbSDK.doc(db, SETTINGS, 'public'));
  if (!result.exists()) return null;
  const data = result.data();
  // Explicit picking prevents unrelated document metadata from becoming page settings.
  return Object.fromEntries(Object.keys(SETTINGS_DEFAULTS).filter((key) => Object.hasOwn(data, key)).map((key) => [key, data[key]]));
}

function settingsUrl(value, name, allowRelative = false) {
  if (!value) return '';
  if (allowRelative && !value.includes(':') && !value.startsWith('//') && !value.includes('\\')) return value;
  let parsed;
  try { parsed = new URL(value); } catch { throw invalid(`أدخل رابطًا كاملًا في ${name}.`); }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
    throw invalid(`استعمل رابط HTTPS في ${name}.`);
  }
  return value;
}

export async function saveSettings(changes) {
  for (const key of Object.keys(changes || {})) {
    if (!Object.hasOwn(SETTINGS_DEFAULTS, key)) throw invalid(`إعداد غير معروف: ${key}`);
  }
  const { dbSDK, db, auth } = await ensureFirebase();
  ensureAdminSession(auth);
  const existing = await loadSettings();
  const local = globalThis.CONSULTATION_CONFIG || {};
  const defaults = Object.fromEntries(Object.keys(SETTINGS_DEFAULTS).map((key) => [key, local[key] ?? SETTINGS_DEFAULTS[key]]));
  const source = { ...defaults, ...(existing || {}), ...(changes || {}) };
  const settings = {};
  for (const [key, max] of Object.entries(SETTINGS_LIMITS)) {
    settings[key] = textValue(source[key], key, max, ['brand', 'headline', 'subheadline', 'currency'].includes(key));
  }
  for (const [key, min, max] of [['price', 0, 100000], ['durationMinutes', 1, 480], ['actionDocHours', 1, 168]]) {
    const value = Number(source[key]);
    if (source[key] === '' || !Number.isFinite(value) || value < min || value > max || (key !== 'price' && !Number.isInteger(value))) {
      throw invalid(`القيمة غير صالحة في ${key}.`);
    }
    settings[key] = value;
  }
  settings.videoUrl = settingsUrl(settings.videoUrl, 'رابط الفيديو');
  settings.bookingUrl = settingsUrl(settings.bookingUrl, 'رابط الحجز');
  settings.videoPoster = settingsUrl(settings.videoPoster, 'صورة الفيديو', true);
  if (!Array.isArray(source.testimonials) || source.testimonials.length > 12) throw invalid('الحد الأقصى 12 رأيًا.');
  settings.testimonials = source.testimonials.map((item) => {
    const testimonial = {
      name: textValue(item?.name, 'اسم صاحب الرأي', 120),
      role: textValue(item?.role, 'وصف صاحب الرأي', 200, false),
      quote: textValue(item?.quote, 'نص الرأي', 3000, false),
      videoUrl: settingsUrl(textValue(item?.videoUrl, 'فيديو الرأي', 2048, false), 'فيديو الرأي'),
      imageUrl: settingsUrl(textValue(item?.imageUrl, 'صورة الرأي', 2048, false), 'صورة الرأي')
    };
    if (!testimonial.quote && !testimonial.videoUrl && !testimonial.imageUrl) {
      throw invalid('أضف نصًا أو فيديو أو صورة لكل رأي.');
    }
    return testimonial;
  });
  await dbSDK.setDoc(dbSDK.doc(db, SETTINGS, 'public'), { ...settings, updatedAt: dbSDK.serverTimestamp() });
  return settings;
}

globalThis.ConsultationData = Object.freeze({
  login, logout, onAuth, getCurrentUser, submitRequest, listRequests,
  updateRequest, loadSettings, saveSettings, REQUEST_LIMITS, REQUEST_STATUSES
});
