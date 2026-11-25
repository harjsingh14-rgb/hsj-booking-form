'use strict';
// Firestore storage for reporting. If FIREBASE_SERVICE_ACCOUNT is not set the form still works; nothing is stored.
let db = null; let tried = false;
function getDb() {
  if (tried) return db; tried = true;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    const admin = require('firebase-admin');
    const json = JSON.parse(raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8'));
    if (json.private_key) json.private_key = json.private_key.replace(/\\n/g, '\n');
    const app = admin.apps.length ? admin.app() : admin.initializeApp({ credential: admin.credential.cert(json) });
    db = app.firestore(); db.settings({ ignoreUndefinedProperties: true });
  } catch (e) { console.error('Firebase not available:', e.message); db = null; }
  return db;
}
async function save(sid, data, { create = false } = {}) {
  const d = getDb(); if (!d) return false;
  try {
    const now = new Date().toISOString();
    const doc = { ...data, updatedAt: now }; if (create) doc.createdAt = now;
    await d.collection('submissions').doc(sid).set(doc, { merge: true });
    return true;
  } catch (e) { console.error('Firestore save failed:', e.message); return false; }
}
async function recent(days = 30) {
  const d = getDb(); if (!d) return null;
  const since = new Date(Date.now() - days * 864e5).toISOString();
  const snap = await d.collection('submissions').where('createdAt', '>=', since).get();
  return snap.docs.map((x) => ({ id: x.id, ...x.data() }));
}
module.exports = { save, recent, enabled: () => !!getDb() };
