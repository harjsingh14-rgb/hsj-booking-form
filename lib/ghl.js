'use strict';
const config = require('./config');
async function call(method, path, { body, query, version = '2021-07-28' } = {}) {
  const url = new URL(config.ghl.base + path);
  if (query) for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
  const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(url, {
      method,
      headers: { Authorization: 'Bearer ' + config.ghl.key(), Version: version, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    const text = await res.text(); let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = { raw: text }; }
    if (!res.ok) { const err = new Error('GrowthPilot ' + res.status + ' on ' + method + ' ' + path); err.status = res.status; err.data = data; throw err; }
    return data;
  } finally { clearTimeout(timer); }
}
async function upsertContact(c, customFields) {
  const body = { locationId: config.ghl.locationId(), firstName: c.firstName, lastName: c.lastName || undefined, name: c.name, email: c.email, phone: c.phone, timezone: config.tz, country: 'GB', source: 'Booking form' };
  if (customFields && customFields.length) body.customFields = customFields;
  const data = await call('POST', '/contacts/upsert', { body });
  const id = data && data.contact && data.contact.id;
  if (!id) throw new Error('GrowthPilot did not return a contact id');
  return { id, isNew: !!(data && data.new) };
}
const addTags = (contactId, tags) => call('POST', '/contacts/' + contactId + '/tags', { body: { tags } });
const removeTags = (contactId, tags) => call('DELETE', '/contacts/' + contactId + '/tags', { body: { tags } });
const addNote = (contactId, text) => call('POST', '/contacts/' + contactId + '/notes', { body: { body: text } });
const freeSlots = (startMs, endMs) => call('GET', '/calendars/' + config.ghl.calendarId() + '/free-slots', { version: '2021-04-15', query: { startDate: startMs, endDate: endMs, timezone: config.tz } });
function createAppointment({ contactId, startTime, title }) {
  return call('POST', '/calendars/events/appointments', { version: '2021-04-15', body: { calendarId: config.ghl.calendarId(), locationId: config.ghl.locationId(), contactId, startTime, title, appointmentStatus: 'confirmed', toNotify: true } });
}
function fieldsFromAnswers(a) {
  const map = config.customFields(); const out = [];
  const add = (key, value) => { if (key && value) out.push({ key, field_value: value }); };
  add(map.teenName, a.teenName); add(map.yearGroup, a.yearGroup); add(map.currentGrade, a.currentGrade);
  add(map.targetGrade, a.targetGrade); add(map.start, a.start); add(map.invest, a.invest);
  return out;
}
function noteFromAnswers(a, heading) {
  const lines = [heading];
  const add = (label, v) => { if (v) lines.push(label + ': ' + v); };
  add('Teen', a.teenName); add('Year group', a.yearGroup); add('Current grade', a.currentGrade); add('Target grade', a.targetGrade);
  add('Wants to start', a.start); add('Position to invest', a.invest); add('Both attending', a.attend);
  return lines.join('\n');
}
module.exports = { call, upsertContact, addTags, removeTags, addNote, freeSlots, createAppointment, fieldsFromAnswers, noteFromAnswers };
