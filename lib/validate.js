'use strict';
const GRADES = ['A*', 'A', 'B', 'C', 'D', 'E', 'U'];
const YEARS = ['Year 12', 'Year 13', 'Resitting or gap year'];
const START = ['As soon as possible', 'In the next month'];
const INVEST = ["Yes, if it's the right fit", 'Possibly, depending on the cost', 'Not right now'];
const ATTEND = ['Yes, we will both be on the call', 'No'];
const DQ = { invest: 'Not right now', attend: 'No' };

const TLD_TYPOS = { con: 'com', cmo: 'com', vom: 'com', comm: 'com', cim: 'com', 'co.k': 'co.uk', 'co.ul': 'co.uk', couk: 'co.uk' };
const DOMAIN_TYPOS = { 'gmial.com': 'gmail.com', 'gmai.com': 'gmail.com', 'gamil.com': 'gmail.com', 'gnail.com': 'gmail.com', 'hotmial.com': 'hotmail.com', 'hotmai.com': 'hotmail.com', 'yaho.com': 'yahoo.com', 'yahho.com': 'yahoo.com', 'outlok.com': 'outlook.com', 'iclod.com': 'icloud.com' };

function cleanName(raw) {
  const s = String(raw || '').replace(/\s+/g, ' ').trim();
  if (s.length < 2 || s.length > 80 || !/[A-Za-zÀ-ɏ]/.test(s) || /https?:|www\./i.test(s)) return { ok: false, error: 'Please enter your full name.' };
  return { ok: true, value: s };
}
function splitName(full) {
  const parts = full.split(' ');
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}
function cleanEmail(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (!/^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(s) || s.length > 120) return { ok: false, error: 'Please enter a valid email address.' };
  const domain = s.split('@')[1];
  if (DOMAIN_TYPOS[domain]) return { ok: false, error: 'Did you mean ' + s.split('@')[0] + '@' + DOMAIN_TYPOS[domain] + '?' };
  for (const bad of Object.keys(TLD_TYPOS)) {
    if (domain.endsWith('.' + bad)) return { ok: false, error: 'That email ends in .' + bad + '. Did you mean .' + TLD_TYPOS[bad] + '?' };
  }
  return { ok: true, value: s };
}
function cleanPhone(raw) {
  let s = String(raw || '').replace(/\(0\)/g, '').replace(/[\s().-]/g, '');
  if (s.startsWith('00')) s = '+' + s.slice(2);
  if (/^0\d{10}$/.test(s)) s = '+44' + s.slice(1);
  else if (/^44\d{10}$/.test(s)) s = '+' + s;
  else if (/^7\d{9}$/.test(s)) s = '+44' + s;
  if (!/^\+[1-9]\d{7,14}$/.test(s)) return { ok: false, error: 'Please enter a valid phone number, for example 07123 456789.' };
  if (s.startsWith('+44')) {
    const rest = s.slice(3);
    if (!/^[1237]\d{9}$/.test(rest)) return { ok: false, error: 'That does not look like a UK number. Please check it.' };
    if (/^(\d)\1{9}$/.test(rest) || rest === '7123456789') return { ok: false, error: 'Please enter your real phone number so we can confirm your call.' };
  }
  return { ok: true, value: s };
}
function oneOf(list, v, label) {
  return list.includes(v) ? { ok: true, value: v } : { ok: false, error: 'Please choose ' + label + '.' };
}
function validateContact(b) {
  const errors = {};
  const n = cleanName(b.name); if (!n.ok) errors.name = n.error;
  const e = cleanEmail(b.email); if (!e.ok) errors.email = e.error;
  const p = cleanPhone(b.phone); if (!p.ok) errors.phone = p.error;
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { name: n.value, email: e.value, phone: p.value, ...splitName(n.value) } };
}
function validateTeen(a) {
  const errors = {};
  const t = String(a.teenName || '').replace(/\s+/g, ' ').trim();
  if (t.length < 2 || t.length > 40 || !/[A-Za-zÀ-ɏ]/.test(t)) errors.teenName = "Please enter your teen's first name.";
  if (!YEARS.includes(a.yearGroup)) errors.yearGroup = 'Please choose a year group.';
  if (!GRADES.includes(a.currentGrade)) errors.currentGrade = 'Please choose their current grade.';
  if (!GRADES.includes(a.targetGrade)) errors.targetGrade = 'Please choose their target grade.';
  if (!errors.currentGrade && !errors.targetGrade && GRADES.indexOf(a.targetGrade) > GRADES.indexOf(a.currentGrade)) {
    errors.targetGrade = 'The target grade should be the same as or higher than the current grade.';
  }
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { teenName: t, yearGroup: a.yearGroup, currentGrade: a.currentGrade, targetGrade: a.targetGrade } };
}
function validateAnswers(a, { partial = false } = {}) {
  const out = {}; const errors = {};
  if (a.teenName !== undefined || a.yearGroup !== undefined || !partial) {
    const t = validateTeen(a); if (t.ok) Object.assign(out, t.value); else Object.assign(errors, t.errors);
  }
  for (const [key, list, label] of [['start', START, 'when you want to start'], ['invest', INVEST, 'an option'], ['attend', ATTEND, 'an option']]) {
    if (a[key] === undefined && partial) continue;
    const r = oneOf(list, a[key], label); if (r.ok) out[key] = r.value; else errors[key] = r.error;
  }
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: out };
}
function disqualified(a) {
  if (a.invest === DQ.invest) return 'invest';
  if (a.attend === DQ.attend) return 'attend';
  return null;
}
module.exports = { GRADES, YEARS, START, INVEST, ATTEND, DQ, cleanName, cleanEmail, cleanPhone, validateContact, validateTeen, validateAnswers, disqualified, splitName };
