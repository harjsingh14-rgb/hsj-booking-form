'use strict';
const crypto = require('crypto');
const store = require('../lib/store');
const { readBody } = require('../lib/http');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const page = (body) => '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Booking form report</title><style>body{font:16px system-ui;margin:32px auto;max-width:640px;padding:0 16px;color:#16202b}table{border-collapse:collapse;width:100%;margin:16px 0}td,th{border-bottom:1px solid #dde3ea;padding:8px;text-align:left}td:nth-child(n+2),th:nth-child(n+2){text-align:right}input,button{font:inherit;padding:8px}</style>' + body;
function summarise(rows) {
  const n = rows.length; const at = (k) => rows.filter((r) => (r.step || 1) >= k || r.status === 'booked').length;
  const pct = (x) => (n ? Math.round((x / n) * 100) + '%' : '');
  const stages = [['Gave contact details', n], ['Answered about their teen', at(2)], ['Answered start date', at(3)], ['Answered invest question', at(4)], ['Confirmed attendance', at(5)], ['Picked a time', at(6)], ['Booked', rows.filter((r) => r.status === 'booked').length]];
  const dq = { invest: rows.filter((r) => r.dqReason === 'invest').length, attend: rows.filter((r) => r.dqReason === 'attend').length };
  const years = {};
  for (const r of rows) { const y = (r.answers && r.answers.yearGroup) || 'Not answered'; years[y] = years[y] || { n: 0, booked: 0 }; years[y].n++; if (r.status === 'booked') years[y].booked++; }
  return { n, stages: stages.map(([label, count]) => ({ label, count, pct: pct(count) })), dq, years };
}
module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.setHeader('Cache-Control', 'no-store');
  const form = '<h1>Booking form report</h1><form method="post"><input type="password" name="key" placeholder="Report password" autofocus> <select name="days"><option>7</option><option selected>30</option><option>90</option></select> days <button>View</button></form>';
  if (req.method !== 'POST') return res.end(page(form));
  let b = await readBody(req);
  if (typeof req.body === 'string' && !b.key) b = Object.fromEntries(new URLSearchParams(req.body));
  const want = process.env.REPORT_KEY || ''; const got = String(b.key || '');
  const ok = want && got.length === want.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(want));
  if (!ok) { res.statusCode = 401; return res.end(page(form + '<p>Wrong password.</p>')); }
  const days = Math.min(365, Math.max(1, Number(b.days) || 30));
  const rows = await store.recent(days);
  if (!rows) return res.end(page(form + '<p>Firebase is not connected yet, so there is nothing to report.</p>'));
  const s = summarise(rows);
  let html = form + '<h2>Last ' + days + ' days</h2><table><tr><th>Stage</th><th>People</th><th>Of starters</th></tr>' + s.stages.map((x) => '<tr><td>' + esc(x.label) + '</td><td>' + x.count + '</td><td>' + x.pct + '</td></tr>').join('') + '</table>';
  html += '<table><tr><th>Ended early</th><th>People</th></tr><tr><td>Not in a position to invest</td><td>' + s.dq.invest + '</td></tr><tr><td>Both cannot attend</td><td>' + s.dq.attend + '</td></tr></table>';
  html += '<table><tr><th>Year group</th><th>Started</th><th>Booked</th></tr>' + Object.entries(s.years).map(([y, v]) => '<tr><td>' + esc(y) + '</td><td>' + v.n + '</td><td>' + v.booked + '</td></tr>').join('') + '</table>';
  res.end(page(html));
};
module.exports.summarise = summarise;
