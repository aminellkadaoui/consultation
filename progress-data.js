const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
const APP_NAME = 'consultation';
const REQUESTS = 'consultation_requests';
const PROGRESS = 'consultation_progress';

const DEFAULT_FIREBASE = Object.freeze({
  apiKey: 'AIzaSyAou6PxuGGpDSNnmZ1ja4eMYIke3OR_sXY',
  authDomain: 'elite-editor-9fe62.firebaseapp.com',
  projectId: 'elite-editor-9fe62',
  storageBucket: 'elite-editor-9fe62.firebasestorage.app',
  messagingSenderId: '705152552088',
  appId: '1:705152552088:web:c9b082ee8d5f0a1565d4ed'
});

const REQUEST_LIMITS = Object.freeze({
  fullName: 120, whatsapp: 32, instagram: 80,
  experience: 80, clientCount: 40, editingType: 200,
  problem: 2000, lastSituation: 2000, goal: 2000,
  approach: 2000, obstacle: 2000, sessionOutcome: 2000
});

const REQUEST_STATUSES = Object.freeze([
  'new', 'reviewing', 'accepted', 'scheduled', 'completed', 'archived'
]);

export const PROGRESS_KEYS = Object.freeze([
  'submitted', 'booking_payment', 'meeting', 'action_plan'
]);

export const PROGRESS_STATUSES = Object.freeze([
  'completed', 'current', 'pending'
]);

export const PROGRESS_LABELS = Object.freeze({
  submitted: 'تم الإرسال',
  booking_payment: 'الحجز والدفع',
  meeting: 'الاجتماع',
  action_plan: 'خطة العمل'
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
    runtime = {
      authSDK,
      dbSDK,
      auth: authSDK.getAuth(app),
      db: dbSDK.getFirestore(app, databaseId)
    };
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
}

function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

export function validTrackingToken(token) {
  return typeof token === 'string'
    && token.length >= 32
    && token.length <= 128
    && /^[A-Za-z0-9_-]+$/.test(token);
}

export function defaultProgressStages() {
  return [
    { key: 'submitted', status: 'completed' },
    { key: 'booking_payment', status: 'current' },
    { key: 'meeting', status: 'pending' },
    { key: 'action_plan', status: 'pending' }
  ];
}

export function normalizeProgressStages(value) {
  const source = Array.isArray(value) ? value : [];
  return PROGRESS_KEYS.map((key, index) => {
    const row = source.find((item) => item && item.key === key) || source[index] || {};
    const status = PROGRESS_STATUSES.includes(row.status)
      ? row.status
      : defaultProgressStages()[index].status;
    return { key, status };
  });
}

export function currentStageFromStages(stages) {
  const normalized = normalizeProgressStages(stages);
  return normalized.find((stage) => stage.status === 'current')?.key
    || normalized.find((stage) => stage.status === 'pending')?.key
    || normalized.at(-1).key;
}

function validateStages(value) {
  const stages = normalizeProgressStages(value);
  if (stages.length !== PROGRESS_KEYS.length) throw invalid('مراحل المتابعة غير صالحة.');
  const currentCount = stages.filter((stage) => stage.status === 'current').length;
  if (currentCount > 1) throw invalid('يمكن أن توجد مرحلة حالية واحدة فقط.');
  return stages;
}

function normalizeTimestamp(value) {
  return value && typeof value.toDate === 'function' ? value.toDate().toISOString() : value || null;
}

function validatedRequestFields(data) {
  const fields = {};
  for (const [name, max] of Object.entries(REQUEST_LIMITS)) {
    if (name === 'editingType') continue;
    fields[name] = textValue(data?.[name], name, max);
  }
  if (!Array.isArray(data?.editingType) || data.editingType.length < 1 || data.editingType.length > 7) {
    throw invalid('اختر نوع المونتاج.');
  }
  fields.editingType = [...new Set(data.editingType.map(
    (value) => textValue(value, 'نوع المونتاج', REQUEST_LIMITS.editingType)
  ))];
  return fields;
}

export async function submitTrackedRequest(data) {
  const fields = validatedRequestFields(data);
  if (globalThis.navigator?.onLine === false) {
    const error = new Error('اتصل بالإنترنت ثم أعد إرسال الطلب.');
    error.code = 'consultation/offline';
    throw error;
  }

  const { dbSDK, db } = await ensureFirebase();
  const token = randomToken();
  const stages = defaultProgressStages();
  const currentStage = currentStageFromStages(stages);
  const requestRef = dbSDK.doc(dbSDK.collection(db, REQUESTS));
  const progressRef = dbSDK.doc(db, PROGRESS, token);
  const batch = dbSDK.writeBatch(db);

  batch.set(requestRef, {
    ...fields,
    status: 'new',
    schemaVersion: 3,
    trackingToken: token,
    currentStage,
    stages,
    submittedAt: dbSDK.serverTimestamp()
  });

  batch.set(progressRef, {
    currentStage,
    stages,
    updatedAt: dbSDK.serverTimestamp()
  });

  await batch.commit();

  return {
    id: requestRef.id,
    token,
    ...fields,
    status: 'new',
    schemaVersion: 3,
    currentStage,
    stages,
    submittedAt: new Date().toISOString()
  };
}

export async function loadProgress(token) {
  const cleanToken = String(token || '').trim();
  if (!validTrackingToken(cleanToken)) throw invalid('رابط المتابعة غير صالح.');
  const { dbSDK, db } = await ensureFirebase();
  const snapshot = await dbSDK.getDocFromServer(dbSDK.doc(db, PROGRESS, cleanToken));
  if (!snapshot.exists()) {
    const error = new Error('لم يتم العثور على طلب بهذا الرابط.');
    error.code = 'consultation/progress-not-found';
    throw error;
  }
  const data = snapshot.data();
  const stages = normalizeProgressStages(data.stages);
  return {
    token: cleanToken,
    stages,
    currentStage: PROGRESS_KEYS.includes(data.currentStage)
      ? data.currentStage
      : currentStageFromStages(stages),
    updatedAt: normalizeTimestamp(data.updatedAt)
  };
}

export async function updateTrackedRequest(id, fields) {
  if (typeof id !== 'string' || !id || id.includes('/')) throw invalid('معرّف الطلب غير صالح.');

  const allowed = new Set(['status', 'privateNotes', 'stages', 'currentStage']);
  for (const key of Object.keys(fields || {})) {
    if (!allowed.has(key)) throw invalid('يوجد حقل غير مسموح بتعديله.');
  }

  const { dbSDK, db, auth } = await ensureFirebase();
  ensureAdminSession(auth);

  const requestRef = dbSDK.doc(db, REQUESTS, id);
  const snapshot = await dbSDK.getDocFromServer(requestRef);
  if (!snapshot.exists()) throw invalid('الطلب غير موجود.');
  const existing = snapshot.data();

  const changes = {};
  if (Object.hasOwn(fields || {}, 'status')) {
    if (!REQUEST_STATUSES.includes(fields.status)) throw invalid('حالة الطلب غير صالحة.');
    changes.status = fields.status;
  }
  if (Object.hasOwn(fields || {}, 'privateNotes')) {
    changes.privateNotes = textValue(fields.privateNotes, 'الملاحظات الخاصة', 6000, false);
  }

  let stages = normalizeProgressStages(existing.stages);
  if (Object.hasOwn(fields || {}, 'stages')) stages = validateStages(fields.stages);

  let currentStage = currentStageFromStages(stages);
  if (Object.hasOwn(fields || {}, 'currentStage')) {
    if (!PROGRESS_KEYS.includes(fields.currentStage)) throw invalid('المرحلة الحالية غير صالحة.');
    currentStage = fields.currentStage;
  }

  const hasProgressChange = Object.hasOwn(fields || {}, 'stages')
    || Object.hasOwn(fields || {}, 'currentStage');

  let token = typeof existing.trackingToken === 'string' && validTrackingToken(existing.trackingToken)
    ? existing.trackingToken
    : '';

  if (hasProgressChange) {
    if (!token) token = randomToken();
    changes.trackingToken = token;
    changes.stages = stages;
    changes.currentStage = currentStage;
  }

  if (!Object.keys(changes).length) throw invalid('لا توجد تغييرات للحفظ.');

  const batch = dbSDK.writeBatch(db);
  batch.update(requestRef, { ...changes, updatedAt: dbSDK.serverTimestamp() });

  if (token) {
    batch.set(dbSDK.doc(db, PROGRESS, token), {
      stages: hasProgressChange ? stages : normalizeProgressStages(existing.stages),
      currentStage: hasProgressChange
        ? currentStage
        : (PROGRESS_KEYS.includes(existing.currentStage)
          ? existing.currentStage
          : currentStageFromStages(existing.stages)),
      updatedAt: dbSDK.serverTimestamp()
    }, { merge: true });
  }

  await batch.commit();
  return { id, ...changes };
}
