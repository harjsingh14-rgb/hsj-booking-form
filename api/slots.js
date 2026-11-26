'use strict';
const config = require('../lib/config');
const ghl = require('../lib/ghl');
const slots = require('../lib/slots');
const { send } = require('../lib/http');
async function load(now = Date.now()) {
  const { from, to } = slots.allowedRange(now, config.fallbackWindowHours());
  const raw = await ghl.freeSlots(Math.floor(from), Math.ceil(to));
  return slots.offer(slots.flatten(raw), now);
}
module.exports = async (req, res) => {
  try {
    const list = await load();
    send(res, 200, { days: slots.group(list), timezone: 'UK time' });
  } catch (e) {
    console.error('slots failed', e.message, e.data ? JSON.stringify(e.data).slice(0, 300) : '');
    send(res, 502, { error: 'We could not load times just now. Please try again.' });
  }
};
module.exports.load = load;
