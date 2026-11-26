'use strict';
// Runs the server logic against a fake GrowthPilot and Meta. No network, no real data.
const assert = require('assert');
process.env.GHL_API_KEY = 'test-key'; process.env.GHL_LOCATION_ID = 'loc1'; process.env.GHL_CALENDAR_ID = 'cal1';
process.env.FORM_SECRET = 'test-secret'; process.env.META_PIXEL_ID = '123'; process.env.META_ACCESS_TOKEN = 'tok';
process.env.BOOKING_WINDOW_HOURS = '48'; process.env.MIN_NOTICE_HOURS = '2';

const calls = []; let freeSlots = {}; let apptStatus = 200;
global.fetch = async (url, opts = {}) => {
  const u = new URL(String(url)); const body = opts.body ? JSON.parse(opts.body) : null;
  calls.push({ method: opts.method || 'GET', host: u.host, path: u.pathname, query: Object.fromEntries(u.searchParams), body, headers: opts.headers || {} });
  const json = (status, data) => ({ ok: status < 300, status, text: async () => JSON.stringify(data) });
  if (u.host === 'graph.facebook.com') return json(200, { events_received: 1 });
  if (u.pathname === '/contacts/upsert') return json(200, { new: true, contact: { id: 'c1' } });
  if (u.pathname.endsWith('/free-slots')) return json(200, freeSlots);
  if (u.pathname === '/calendars/events/appointments') return json(apptStatus, apptStatus === 200 ? { id: 'a1' } : { message: 'The slot you have selected is no longer available.' });
  return json(200, {});
};
function run(handler, { method = 'POST', body, headers = {} } = {}) {
  return new Promise((resolve) => {
    const res = { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(text) { let data = text; try { data = JSON.parse(text); } catch (e) {} resolve({ status: this.statusCode, data }); } };
    handler({ method, body, headers }, res);
  });
}
const v = require('../lib/validate'); const slots = require('../lib/slots'); const token = require('../lib/token');
const lead = require('../api/lead'); const progress = require('../api/progress'); const slotsApi = require('../api/slots'); const book = require('../api/book'); const report = require('../api/report');
const good = { teenName: 'Aman', yearGroup: 'Year 12', currentGrade: 'D', targetGrade: 'A', start: v.START[0], invest: v.INVEST[0], attend: v.ATTEND[0] };
const tests = []; const test = (name, fn) => tests.push([name, fn]);

test('phone numbers are checked and tidied', () => {
  assert.equal(v.cleanPhone('07700 900123').value, '+447700900123');
  assert.equal(v.cleanPhone('+44 (0)7700 900123').value, '+447700900123');
  assert.equal(v.cleanPhone('447700900123').value, '+447700900123');
  assert.equal(v.cleanPhone('0121 496 0000').value, '+441214960000');
  assert.equal(v.cleanPhone('12345').ok, false);
  assert.equal(v.cleanPhone('07777777777').ok, false);
  assert.equal(v.cleanPhone('+919876543210').value, '+919876543210');
});
test('emails are checked, common typos caught', () => {
  assert.equal(v.cleanEmail(' Parent@Example.co.uk ').value, 'parent@example.co.uk');
  assert.equal(v.cleanEmail('parent@gmial.com').ok, false);
  assert.equal(v.cleanEmail('parent@gmail.con').ok, false);
  assert.equal(v.cleanEmail('parent@gmail').ok, false);
});
test('target grade cannot be below current grade', () => {
  assert.equal(v.validateTeen({ ...good, currentGrade: 'B', targetGrade: 'C' }).ok, false);
  assert.equal(v.validateTeen({ ...good, currentGrade: 'B', targetGrade: 'B' }).ok, true);
  assert.equal(v.validateTeen({ ...good, currentGrade: 'U', targetGrade: 'A*' }).ok, true);
});
test('Year 12 is not screened out; only invest and attendance end the form', () => {
  assert.equal(v.disqualified(good), null);
  assert.equal(v.disqualified({ ...good, invest: 'Not right now' }), 'invest');
  assert.equal(v.disqualified({ ...good, attend: 'No' }), 'attend');
});
test('slots outside the 2 hour notice and 48 hour window are hidden', () => {
  const now = Date.parse('2026-11-26T09:00:00Z'); const iso = (h) => new Date(now + h * 3600e3).toISOString();
  const list = slots.filter(slots.flatten({ '2026-11-26': { slots: [iso(1), iso(3)] }, '2026-11-28': { slots: [iso(47), iso(49)] }, traceId: 'x' }), now);
  assert.deepEqual(list, [iso(3), iso(47)]);
  assert.equal(slots.group(list).length, 2);
});
test('a nearly full diary widens the picker to 72 hours; a healthy one stays at 48', () => {
  const now = Date.parse('2026-11-26T09:00:00Z'); const iso = (h) => new Date(now + h * 3600e3).toISOString();
  assert.deepEqual(slots.offer([iso(1), iso(13), iso(53), iso(55), iso(80)], now), [iso(13), iso(53), iso(55)]);
  assert.deepEqual(slots.offer([iso(5), iso(13), iso(30), iso(53)], now), [iso(5), iso(13), iso(30)]);
});
test('times show in UK time across the clock change', () => {
  assert.equal(slots.timeLabel('2026-07-01T15:00:00Z'), '4:00 pm');
  assert.equal(slots.timeLabel('2026-12-01T15:00:00Z'), '3:00 pm');
});
test('tampered or expired sessions are rejected', () => {
  const t = token.sign({ sid: 's', cid: 'c1' });
  assert.equal(token.verify(t).cid, 'c1');
  assert.equal(token.verify(t.slice(0, -2) + 'xx'), null);
  assert.equal(token.verify(token.sign({ sid: 's' }, -1)), null);
});
let tok;
test('step 1 saves the contact straight away and tags it started', async () => {
  calls.length = 0;
  const bad = await run(lead, { body: { name: 'A', email: 'nope', phone: '1' } });
  assert.equal(bad.status, 400); assert.ok(bad.data.errors.email && bad.data.errors.phone && bad.data.errors.name); assert.equal(calls.length, 0);
  const r = await run(lead, { body: { name: 'Test Parent', email: 'parent@example.com', phone: '07700 900123' } });
  assert.equal(r.status, 200); tok = r.data.token; assert.ok(token.verify(tok));
  const up = calls.find((c) => c.path === '/contacts/upsert');
  assert.equal(up.body.phone, '+447700900123'); assert.equal(up.body.locationId, 'loc1'); assert.equal(up.headers.Authorization, 'Bearer test-key');
  assert.deepEqual(calls.find((c) => c.path === '/contacts/c1/tags').body.tags, ['booking-form-started']);
});
test('bots that fill the hidden field never reach the CRM', async () => {
  calls.length = 0;
  await run(lead, { body: { name: 'Bot', email: 'b@example.com', phone: '07700900123', company: 'x' } });
  assert.equal(calls.length, 0);
});
test('year group is tagged; "Not right now" tags disqualified and drops the started tag', async () => {
  calls.length = 0;
  let r = await run(progress, { body: { token: tok, step: 2, answers: { teenName: 'Aman', yearGroup: 'Year 12', currentGrade: 'D', targetGrade: 'A' } } });
  assert.equal(r.data.disqualified, null);
  assert.deepEqual(calls.find((c) => c.method === 'POST' && c.path === '/contacts/c1/tags').body.tags, ['bf-year-12']);
  calls.length = 0;
  r = await run(progress, { body: { token: tok, step: 4, answers: { ...good, attend: undefined, invest: 'Not right now' } } });
  assert.equal(r.data.disqualified, 'invest');
  assert.ok(calls.some((c) => c.method === 'POST' && c.body.tags && c.body.tags[0] === 'booking-form-dq'));
  assert.ok(calls.some((c) => c.method === 'DELETE' && c.body.tags[0] === 'booking-form-started'));
  assert.ok(calls.some((c) => c.path === '/contacts/c1/notes'));
  assert.equal((await run(progress, { body: { token: 'bad', answers: {} } })).status, 401);
});
test('booking creates the appointment, tags booked and sends a hashed Schedule event', async () => {
  const start = new Date(Math.ceil((Date.now() + 5 * 3600e3) / 3600e3) * 3600e3).toISOString();
  freeSlots = { d: { slots: [start] } }; calls.length = 0;
  const s = await run(slotsApi, { method: 'GET' });
  assert.equal(s.data.days[0].slots[0].iso, start);
  const fs = calls.find((c) => c.path === '/calendars/cal1/free-slots'); assert.equal(fs.query.timezone, 'Europe/London');
  const r = await run(book, { body: { token: tok, answers: good, startTime: start, fbc: 'fb.1.1.abc' }, headers: { 'user-agent': 'UA', 'x-forwarded-for': '203.0.113.5, 10.0.0.1' } });
  assert.equal(r.status, 200); assert.ok(r.data.when.includes(' at '));
  const ap = calls.find((c) => c.path === '/calendars/events/appointments');
  assert.equal(ap.body.contactId, 'c1'); assert.equal(ap.body.calendarId, 'cal1'); assert.equal(ap.body.startTime, start); assert.ok(!ap.body.ignoreFreeSlotValidation);
  assert.ok(calls.some((c) => c.body && c.body.tags && c.body.tags[0] === 'booking-form-booked'));
  const m = calls.find((c) => c.host === 'graph.facebook.com');
  const ev = m.body.data[0]; assert.equal(ev.event_name, 'Schedule'); assert.equal(ev.event_id, r.data.eventId);
  assert.match(ev.user_data.em[0], /^[a-f0-9]{64}$/); assert.equal(ev.user_data.client_ip_address, '203.0.113.5');
  assert.ok(!JSON.stringify(m.body).includes('parent@example.com'));
});
test('a slot that is taken, too soon, or too far ahead cannot be booked', async () => {
  const soon = new Date(Date.now() + 3600e3).toISOString(); const far = new Date(Date.now() + 96 * 3600e3).toISOString(); const ok = new Date(Date.now() + 6 * 3600e3).toISOString();
  freeSlots = { d: { slots: [soon, far] } };
  for (const st of [soon, far, ok]) assert.equal((await run(book, { body: { token: tok, answers: good, startTime: st } })).status, 409);
  freeSlots = { d: { slots: [ok] } }; apptStatus = 400;
  assert.equal((await run(book, { body: { token: tok, answers: good, startTime: ok } })).status, 409);
  apptStatus = 200;
});
test('someone who said "Not right now" cannot book by skipping ahead', async () => {
  const ok = new Date(Date.now() + 6 * 3600e3).toISOString(); freeSlots = { d: { slots: [ok] } }; calls.length = 0;
  const r = await run(book, { body: { token: tok, answers: { ...good, invest: 'Not right now' }, startTime: ok } });
  assert.equal(r.status, 400); assert.ok(!calls.some((c) => c.path === '/calendars/events/appointments'));
});
test('report needs the password and counts drop-off', async () => {
  process.env.REPORT_KEY = 'secret';
  assert.equal((await run(report, { body: { key: 'wrong!' } })).status, 401);
  const s = report.summarise([{ step: 1 }, { step: 4, dqReason: 'invest', answers: { yearGroup: 'Year 13' } }, { step: 7, status: 'booked', answers: { yearGroup: 'Year 12' } }]);
  assert.equal(s.stages[0].count, 3); assert.equal(s.stages[6].count, 1); assert.equal(s.dq.invest, 1); assert.equal(s.years['Year 12'].booked, 1);
});

(async () => {
  let failed = 0;
  for (const [name, fn] of tests) {
    try { await fn(); console.log('PASS  ' + name); } catch (e) { failed++; console.log('FAIL  ' + name + '\n      ' + (e.message || e).toString().split('\n')[0]); }
  }
  console.log('\n' + (tests.length - failed) + ' of ' + tests.length + ' passed');
  process.exit(failed ? 1 : 0);
})();
