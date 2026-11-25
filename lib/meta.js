'use strict';
const crypto = require('crypto');
const sha = (v) => crypto.createHash('sha256').update(String(v).trim().toLowerCase()).digest('hex');
// Sends a "Schedule" event to Meta's Conversions API. Does nothing unless the pixel id and token are set.
async function sendSchedule({ email, phone, firstName, lastName, ip, userAgent, fbp, fbc, eventId, pageUrl }) {
  const pixel = process.env.META_PIXEL_ID; const token = process.env.META_ACCESS_TOKEN;
  if (!pixel || !token) return { skipped: true };
  const user = { em: [sha(email)], ph: [sha(String(phone).replace(/\D/g, ''))], country: [sha('gb')] };
  if (firstName) user.fn = [sha(firstName)]; if (lastName) user.ln = [sha(lastName)];
  if (ip) user.client_ip_address = ip; if (userAgent) user.client_user_agent = userAgent;
  if (fbp) user.fbp = fbp; if (fbc) user.fbc = fbc;
  const payload = { data: [{ event_name: 'Schedule', event_time: Math.floor(Date.now() / 1000), action_source: 'website', event_id: eventId, event_source_url: pageUrl || undefined, user_data: user }] };
  if (process.env.META_TEST_EVENT_CODE) payload.test_event_code = process.env.META_TEST_EVENT_CODE;
  const version = process.env.META_API_VERSION ? process.env.META_API_VERSION + '/' : '';
  try {
    const res = await fetch('https://graph.facebook.com/' + version + pixel + '/events?access_token=' + encodeURIComponent(token), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const ok = res.ok; if (!ok) console.error('Meta event failed', res.status, await res.text());
    return { ok };
  } catch (e) { console.error('Meta event error', e.message); return { ok: false }; }
}
module.exports = { sendSchedule, sha };
