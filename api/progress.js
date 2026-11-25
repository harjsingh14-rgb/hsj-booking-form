'use strict';
const config = require('../lib/config');
const ghl = require('../lib/ghl');
const store = require('../lib/store');
const token = require('../lib/token');
const { validateAnswers, disqualified } = require('../lib/validate');
const { readBody, send } = require('../lib/http');

// Saves answers after each question. Tags the contact when an answer ends the form.
module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
  const b = await readBody(req);
  const s = token.verify(b.token);
  if (!s) return send(res, 401, { error: 'expired' });
  const a = validateAnswers(b.answers || {}, { partial: true });
  if (!a.ok) return send(res, 400, { errors: a.errors });
  const answers = a.value; const dq = disqualified(answers);
  const step = Math.max(1, Math.min(7, Number(b.step) || 1));
  const jobs = [store.save(s.sid, { answers, step, ...(dq ? { status: 'disqualified', dqReason: dq } : {}) })];
  try {
    if (b.step === 2 && answers.yearGroup) {
      jobs.push(ghl.addTags(s.cid, ['bf-' + answers.yearGroup.toLowerCase().replace(/[^a-z0-9]+/g, '-')]));
      const cf = ghl.fieldsFromAnswers(answers);
      if (cf.length) jobs.push(ghl.call('PUT', '/contacts/' + s.cid, { body: { customFields: cf } }));
    }
    if (dq) {
      jobs.push(ghl.addTags(s.cid, [config.tags.dq]));
      jobs.push(ghl.removeTags(s.cid, [config.tags.started]));
      jobs.push(ghl.addNote(s.cid, ghl.noteFromAnswers(answers, 'Booking form: did not qualify (' + (dq === 'invest' ? 'not in a position to invest' : 'both cannot attend') + ')')));
    }
    await Promise.allSettled(jobs);
  } catch (e) { console.error('progress failed', e.message); }
  send(res, 200, { ok: true, disqualified: dq });
};
