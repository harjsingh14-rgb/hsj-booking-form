'use strict';
const crypto = require('crypto');
const config = require('./config');
const b64 = (buf) => Buffer.from(buf).toString('base64url');
function sign(payload, ttlHours = 72) {
  const body = b64(JSON.stringify({ ...payload, exp: Date.now() + ttlHours * 3600 * 1000 }));
  const mac = crypto.createHmac('sha256', config.secret()).update(body).digest('base64url');
  return body + '.' + mac;
}
function verify(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [body, mac] = token.split('.');
  const expected = crypto.createHmac('sha256', config.secret()).update(body).digest('base64url');
  const a = Buffer.from(mac || ''); const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!data.exp || data.exp < Date.now()) return null;
    return data;
  } catch (e) { return null; }
}
module.exports = { sign, verify };
