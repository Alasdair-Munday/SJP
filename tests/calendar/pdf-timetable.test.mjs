import test from 'node:test';
import assert from 'node:assert/strict';
import { pdfTimetable } from '../../src/lib/calendar/pdf-timetable.mjs';

const event = (id, date, title, href) => ({ id, title, href, start: `${date}T09:00:00Z`, end: `${date}T10:00:00Z` });
const schedule = (events) => ({ start: new Date('2026-10-11T23:00:00Z'), end: new Date('2026-10-18T23:00:00Z'), events });

test('PDF timetable separates Sunday and prayer sessions and omits empty weekdays', () => {
  const data = pdfTimetable(schedule([
    event('prayer-mon', '2026-10-12', 'Morning Prayers'),
    event('foodbank', '2026-10-12', 'Foodbank'),
    event('prayer-tue', '2026-10-13', 'Midweek Online Prayers'),
    event('prayer-renamed', '2026-10-14', 'Prayer together', '/events/morning-prayers/'),
    event('communion', '2026-10-14', 'Midweek Communion'),
    event('oneoff', '2026-10-16', 'Special Friday event'),
    event('simplicity', '2026-10-18', 'Simplicity'),
    event('sunday', '2026-10-18', 'Sunday Service'),
  ]));
  assert.deepEqual(data.prayers.map((item) => item.id), ['prayer-mon', 'prayer-tue', 'prayer-renamed']);
  assert.deepEqual(data.sunday.events.map((item) => item.id), ['simplicity', 'sunday']);
  assert.deepEqual(data.days.map((day) => day.key), ['2026-10-12', '2026-10-14', '2026-10-16']);
  assert.deepEqual(data.days.flatMap((day) => day.events.map((item) => item.id)), ['foodbank', 'communion', 'oneoff']);
});

test('multi-day events appear on every relevant occupied day; no dates are invented', () => {
  const data = pdfTimetable(schedule([{ id: 'weekend', title: 'Weekend event', start: '2026-10-16T09:00:00Z', end: '2026-10-18T15:00:00Z' }]));
  assert.deepEqual(data.days.map((day) => day.key), ['2026-10-16', '2026-10-17']);
  assert.deepEqual(data.sunday.events.map((item) => item.id), ['weekend']);
  assert.equal(pdfTimetable(schedule([])).days.length, 0);
});
