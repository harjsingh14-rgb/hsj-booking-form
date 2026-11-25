'use strict';
const config = require('./config');
// Turn the GrowthPilot free-slots response (keyed by date) into a flat list of ISO strings.
function flatten(resp) {
  const out = [];
  if (!resp || typeof resp !== 'object') return out;
  for (const [key, val] of Object.entries(resp)) {
    if (key === 'traceId') continue;
    const list = Array.isArray(val) ? val : val && Array.isArray(val.slots) ? val.slots : [];
    for (const s of list) if (typeof s === 'string' && !isNaN(Date.parse(s))) out.push(s);
  }
  return Array.from(new Set(out)).sort((a, b) => Date.parse(a) - Date.parse(b));
}
function allowedRange(now = Date.now()) {
  return { from: now + config.minNoticeHours() * 3600e3, to: now + config.windowHours() * 3600e3 };
}
function filter(slots, now = Date.now()) {
  const { from, to } = allowedRange(now);
  return slots.filter((s) => { const t = Date.parse(s); return t >= from && t <= to; });
}
function isAllowed(iso, now = Date.now()) {
  const t = Date.parse(iso); const { from, to } = allowedRange(now);
  return !isNaN(t) && t >= from - 60e3 && t <= to + 60e3;
}
const dayKey = (iso) => new Intl.DateTimeFormat('en-CA', { timeZone: config.tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
const dayLabel = (iso) => new Intl.DateTimeFormat('en-GB', { timeZone: config.tz, weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(iso));
const timeLabel = (iso) => new Intl.DateTimeFormat('en-GB', { timeZone: config.tz, hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(iso)).replace(/\s/g, ' ').toLowerCase();
const longLabel = (iso) => new Intl.DateTimeFormat('en-GB', { timeZone: config.tz, weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(iso)) + ' at ' + timeLabel(iso);
function group(slots) {
  const days = [];
  for (const iso of slots) {
    const key = dayKey(iso);
    let d = days.find((x) => x.date === key);
    if (!d) { d = { date: key, label: dayLabel(iso), slots: [] }; days.push(d); }
    d.slots.push({ iso, label: timeLabel(iso) });
  }
  return days;
}
module.exports = { flatten, filter, isAllowed, group, longLabel, timeLabel, dayLabel, allowedRange };
