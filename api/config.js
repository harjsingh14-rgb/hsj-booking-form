'use strict';
const config = require('../lib/config');
const v = require('../lib/validate');
const { send } = require('../lib/http');
module.exports = async (req, res) => {
  send(res, 200, {
    years: v.YEARS, grades: v.GRADES, start: v.START, invest: v.INVEST, attend: v.ATTEND,
    thankYouUrl: config.thankYouUrl(), pixelId: process.env.META_PIXEL_ID || '', vslUrl: process.env.VSL_URL || '', windowHours: config.windowHours(),
  });
};
