'use strict';
const num = (v, d) => (v !== undefined && v !== '' && !isNaN(Number(v)) ? Number(v) : d);
module.exports = {
  tz: 'Europe/London',
  ghl: {
    base: 'https://services.leadconnectorhq.com',
    key: () => process.env.GHL_API_KEY || '',
    locationId: () => process.env.GHL_LOCATION_ID || '',
    calendarId: () => process.env.GHL_CALENDAR_ID || '',
  },
  windowHours: () => num(process.env.BOOKING_WINDOW_HOURS, 48),
  minNoticeHours: () => num(process.env.MIN_NOTICE_HOURS, 2),
  // If fewer than minSlots times are free inside the normal window, the form looks this far ahead instead.
  fallbackWindowHours: () => Math.max(num(process.env.FALLBACK_WINDOW_HOURS, 72), num(process.env.BOOKING_WINDOW_HOURS, 48)),
  minSlots: () => num(process.env.MIN_SLOTS, 3),
  thankYouUrl: () => process.env.THANK_YOU_URL || '',
  secret: () => process.env.FORM_SECRET || process.env.GHL_API_KEY || 'dev-only-secret',
  tags: { started: 'booking-form-started', booked: 'booking-form-booked', dq: 'booking-form-dq' },
  customFields: () => ({
    yearGroup: process.env.GHL_CF_YEAR_GROUP || '',
    currentGrade: process.env.GHL_CF_CURRENT_GRADE || '',
    targetGrade: process.env.GHL_CF_TARGET_GRADE || '',
    start: process.env.GHL_CF_START || '',
    invest: process.env.GHL_CF_INVEST || '',
    teenName: process.env.GHL_CF_TEEN_NAME || '',
  }),
};
