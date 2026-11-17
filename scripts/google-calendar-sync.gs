// Paste into script.google.com (signed in with the Pratham account).
// Sends the next 14 days of your calendar to Dex every 30 minutes.

const DEX_URL = 'https://ak-desk-ten.vercel.app/api/cron/calendar';
const DEX_KEY = 'PUT-YOUR-CRON-SECRET-HERE';

function syncToDex() {
  const start = new Date(Date.now() - 24 * 3600 * 1000);
  const end = new Date(Date.now() + 14 * 24 * 3600 * 1000);
  const events = CalendarApp.getDefaultCalendar().getEvents(start, end)
    .filter(function (e) { return e.getMyStatus() !== CalendarApp.GuestStatus.NO; })
    .map(function (e) {
      return {
        title: e.getTitle(),
        start: e.getStartTime().toISOString(),
        end: e.getEndTime().toISOString(),
        allDay: e.isAllDayEvent(),
        location: e.getLocation() || '',
      };
    });
  const res = UrlFetchApp.fetch(DEX_URL, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-cron-key': DEX_KEY },
    payload: JSON.stringify({ calendar: 'Pratham', events: events }),
    muteHttpExceptions: true,
  });
  Logger.log(res.getContentText());
}

function setup() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('syncToDex').timeBased().everyMinutes(30).create();
  syncToDex();
}
