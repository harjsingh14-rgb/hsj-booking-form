'use strict';
const crypto = require('crypto');
const config = require('../lib/config');
const ghl = require('../lib/ghl');
const store = require('../lib/store');
const token = require('../lib/token');
const { validateContact } = require('../lib/validate');
const { readBody, send, str } = require('../lib/http');

// Step 1: contact details. Creates or updates the contact straight away so a partial submit is never lost.
module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
  const b = await readBody(req);
  if (b.company) return send(res, 200, { ok: true, token: 'x' }); // honeypot: bots fill hidden fields
  const c = validateContact(b);
  if (!c.ok) return send(res, 400, { errors: c.errors });
  let contact;
  try {
    contact = await ghl.upsertContact(c.value);
    await ghl.addTags(contact.id, [config.tags.started]);
  } catch (e) {
    console.error('lead failed', e.message, e.data ? JSON.stringify(e.data).slice(0, 300) : '');
    return send(res, 502, { error: 'We could not save your details just now. Please try again.' });
  }
  const prev = token.verify(b.token);
  const sid = prev && prev.cid === contact.id ? prev.sid : crypto.randomUUID();
  const t = b.tracking || {};
  await store.save(sid, {
    contactId: contact.id, name: c.value.name, email: c.value.email, phone: c.value.phone, status: 'started', step: 1,
    tracking: { fbclid: str(t.fbclid), utm_source: str(t.utm_source), utm_medium: str(t.utm_medium), utm_campaign: str(t.utm_campaign), utm_content: str(t.utm_content), utm_term: str(t.utm_term), page: str(t.page, 500) },
  }, { create: !prev });
  send(res, 200, { ok: true, token: token.sign({ sid, cid: contact.id, em: c.value.email, ph: c.value.phone, fn: c.value.firstName, ln: c.value.lastName }) });
};
