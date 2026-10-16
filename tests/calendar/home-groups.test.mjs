import test from 'node:test';
import assert from 'node:assert/strict';
import { groupHomeRecurrences } from '../../src/lib/calendar/home-groups.mjs';
const occurrence = (day, extra = {}) => ({id: `prayer-${day}`, uid: 'prayer', recurring: true, title: 'Morning Prayer', start: `2026-10-${day}T07:00:00Z`, end: `2026-10-${day}T07:30:00Z`, allDay: false, location: 'Zoom', ...extra});
test('recurring dates are grouped without assuming consecutive days', () => {
 const events = [occurrence('19'), occurrence('21'), occurrence('23')];
 const [group] = groupHomeRecurrences(events);
 assert.deepEqual(group.events, events);
});
test('one-offs and unrelated series remain separate', () => {
 assert.equal(groupHomeRecurrences([occurrence('19'), occurrence('20', {recurring:false}), occurrence('21', {uid:'other'})]).length, 0);
});
test('changed times and locations stay visible separately', () => {
 const groups = groupHomeRecurrences([occurrence('19'), occurrence('20'), occurrence('21', {location:'Church'}), occurrence('22', {start:'2026-10-22T08:00:00Z'})]);
 assert.equal(groups.length, 1);
 assert.equal(groups[0].events.length, 2);
});
