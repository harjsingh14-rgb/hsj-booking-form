'use strict';
const config = require('../lib/config');
const ghl = require('../lib/ghl');
const store = require('../lib/store');
const token = require('../lib/token');
const slots = require('../lib/slots');
const meta = require('../lib/meta');
const { load } = require('./slots');
const { validateAnswers, disqualified } = require('../lib/validate');
const { readBody, send, clientIp, str } = require('../lib/http');

// Final step: creates the appointment. The appointment is what triggers the existing confirmation and reminder messages.
module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
  const b = await readBody(req);
  const s = token.verify(b.token);
  if (!s) return send(res, 401, { error: 'expired' });
  const a = validateAnswers(b.answers || {});
  if (!a.ok) return send(res, 400, { errors: a.errors });
  if (disqualified(a.value)) return send(res, 400, { error: 'not_eligible' });
  const start = str(b.startTime, 40);
  if (!start || !slots.isAllowed(start)) return send(res, 409, { error: 'slot_unavailable' });

  let free;
  try { free = await load(); } catch (e) { return send(res, 502, { error: 'We could not reach the calendar. Please try again.' }); }
  if (!free.some((x) => Date.parse(x) === Date.parse(start))) return send(res, 409, { error: 'slot_unavailable', days: slots.group(free) });

  const when = slots.longLabel(start);
  let appt;
  try {
    appt = await ghl.createAppointment({ contactId: s.cid, startTime: start, title: 'Discovery Call: ' + [s.fn, s.ln].filter(Boolean).join(' ') + ' (' + a.value.teenName + ', ' + a.value.yearGroup + ')' });
  } catch (e) {
    console.error('book failed', e.message, e.data ? JSON.stringify(e.data).slice(0, 300) : '');
    if (e.status === 400 || e.status === 409 || e.status === 422) return send(res, 409, { error: 'slot_unavailable', days: slots.group(free.filter((x) => x !== start)) });
    return send(res, 502, { error: 'We could not book that time. Please try again.' });
  }
  const eventId = 'sched_' + s.sid;
  await Promise.allSettled([
    ghl.addTags(s.cid, [config.tags.booked]),
    ghl.removeTags(s.cid, [config.tags.started]),
    ghl.addNote(s.cid, ghl.noteFromAnswers(a.value, 'Booking form: booked for ' + when)),
    store.save(s.sid, { answers: a.value, step: 7, status: 'booked', appointmentId: appt && appt.id, startTime: start, bookedAt: new Date().toISOString() }),
    meta.sendSchedule({ email: s.em, phone: s.ph, firstName: s.fn, lastName: s.ln, ip: clientIp(req), userAgent: req.headers && req.headers['user-agent'], fbp: str(b.fbp, 100), fbc: str(b.fbc, 300), eventId, pageUrl: str(b.page, 500) }),
  ]);
  send(res, 200, { ok: true, when, eventId, thankYouUrl: config.thankYouUrl() });
};
