import test from 'node:test';
import assert from 'node:assert/strict';
import { compactSchedule } from '../../src/lib/calendar/compact.mjs';

const event = (day, overrides = {}) => ({
  id: `morning::${day}`,
  uid: `morning-${day}`,
  title: 'Morning Prayer',
  start: `${day}T07:00:00.000Z`,
  end: `${day}T07:30:00.000Z`,
  allDay: false,
  location: 'Zoom',
  href: '/get-involved',
  ...overrides,
});

test('consecutive daily occurrences are represented by one concise schedule row', () => {
  const rows = compactSchedule([
    event('2026-09-21'),
    event('2026-09-21', { id: 'other::2026-09-21', uid: 'other', title: 'Coffee morning', start: '2026-09-21T09:00:00.000Z', end: '2026-09-21T10:00:00.000Z', location: "St John's Park" }),
    event('2026-09-22'), event('2026-09-23'), event('2026-09-24'), event('2026-09-25'),
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].dayLabel, 'Mon–Fri');
  assert.equal(rows[0].events.length, 5);
});

test('a changed occurrence stays visible as its own row', () => {
  const rows = compactSchedule([
    event('2026-09-21'), event('2026-09-22', { title: 'Morning Prayer at church', location: "St John's Park" }), event('2026-09-23'),
  ]);
  assert.equal(rows.length, 3);
  assert.match(rows[1].dayLabel, /Tue.*22 Sept/);
});
