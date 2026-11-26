# HSJ booking form

One-click discovery call booking form for the landing page under the VSL. Parents answer a few questions and pick a time without leaving the page. The appointment is created in GrowthPilot, so the existing confirmation and reminder messages keep working.

## What the parent sees

| Step | Screen | Notes |
|---|---|---|
| 1 | Name, email, mobile | Format checked. Contact is saved to GrowthPilot straight away, tagged `booking-form-started` |
| 2 | Teen's first name, year group, current grade, target grade | Grades A* to U. Target cannot be below current. Year group is tagged (`bf-year-12`, `bf-year-13`, `bf-resitting-or-gap-year`) |
| 3 | When should support start | |
| 4 | In a position to invest | "Not right now" ends the form |
| 5 | Will parent and teen both attend | "No" ends the form |
| 6 | Pick a time | Next 48 hours, at least 2 hours ahead. If fewer than 3 times are free, it shows the next 72 hours instead |
| 7 | Confirm | Creates the appointment, then shows "You are booked" or sends them to the homework page |

If someone leaves and comes back within 3 days, the form picks up where they left off.

## Tags the form sets in GrowthPilot

| Tag | When | What it means for the workflow |
|---|---|---|
| `booking-form-started` | Step 1 submitted | Start the new lead workflow (wait 3 minutes first, then check they have not booked) |
| `booking-form-booked` | Call confirmed | `started` is removed. Take them out of the new lead workflow |
| `booking-form-dq` | Form ended early | `started` is removed. Take them out of the new lead workflow |

Answers are added to the contact as a note when they book or are ended early, so Neha can read them before calling.

## Pages

| Address | What it is |
|---|---|
| `/` | Landing page: headline, video, booking form, reviews |
| `/form/` | The booking form on its own |
| `/privacy/` | Privacy notice linked from the form |
| `/api/report` | Drop-off report (password) |

The landing page only loads the Meta pixel after the visitor accepts cookies.

## Setup

1. **Vercel**: sign in at vercel.com with GitHub, choose "Add New Project", and import `hsj-booking-form`. Leave every build setting as it is.
2. **Settings**: in the Vercel project, open Settings, then Environment Variables, and add the names from `.env.example`. Paste the values there yourself. Never put them in chat or in this repo.
   - `GHL_API_KEY`: GrowthPilot, Settings, Private Integrations, create one with contacts, calendars and calendar events permissions.
   - `GHL_LOCATION_ID` and `GHL_CALENDAR_ID`: already filled in `.env.example` (Discovery Call calendar).
   - `FORM_SECRET` and `REPORT_KEY`: any long random text.
   - `FIREBASE_SERVICE_ACCOUNT`: create a new Firebase project (keep it separate from ChemMastery), turn on Firestore, then Project settings, Service accounts, Generate new private key. Paste the whole file contents.
   - `META_PIXEL_ID` and `META_ACCESS_TOKEN`: from KST.
   - `THANK_YOU_URL`: the homework page, once it exists.
3. **Redeploy** after adding the settings (Deployments, the three dots, Redeploy).
4. **Calendar**: in GrowthPilot, set the Discovery Call calendar's minimum notice to 2 hours. The form only offers times the calendar says are free, so the calendar's own rules still apply.
5. **Embed**: on the new landing page, paste this where the form should sit:

   ```html
   <div id="hsj-booking"></div>
   <script src="https://YOUR-VERCEL-ADDRESS/embed.js" async></script>
   ```

   If the Meta pixel is on that page, the embed also fires the browser `Schedule` event with the same event ID as the server event, so Meta counts it once.

## Drop-off report

Open `/api/report` on the form's address and enter the `REPORT_KEY`. It shows how many people reached each step, how many were ended early, and bookings by year group. Needs Firebase connected.

## Testing

`npm test` runs the server logic against a fake GrowthPilot. No real contacts or appointments are created.

Before sending traffic, do one real run with your own details: check the contact and tags appear, the appointment lands on the calendar, the confirmation message arrives, then cancel the appointment. Set `META_TEST_EVENT_CODE` (from Events Manager, Test events) while doing this so the test booking does not count as a real conversion, and remove it after.

## To check before going live

- Read the privacy notice at `/privacy/` and correct anything that does not match how you handle data.
- The headline, call steps and reviews on the landing page are in `public/index.html`.
