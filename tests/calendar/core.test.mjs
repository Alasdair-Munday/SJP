import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { expandCalendar } from '../../src/lib/calendar/core.mjs';
import { parseIssueDate, weekRange, dateKey, timeLabel } from '../../src/lib/calendar/dates.mjs';
import { canonicalTarget, websiteLink, resolveTarget } from '../../src/lib/calendar/links.mjs';
import { refreshSnapshot, snapshotStatus, MAX_STALE_MS } from '../../src/lib/calendar/store.mjs';

const timezone = readFileSync(new URL('../../calendar_debug.ics', import.meta.url), 'utf8').match(/BEGIN:VTIMEZONE[\s\S]*?END:VTIMEZONE/)[0];
const event = (lines) => `BEGIN:VEVENT\n${lines}\nEND:VEVENT`;
const calendar = (...events) => `BEGIN:VCALENDAR\nVERSION:2.0\n${timezone}\n${events.join('\n')}\nEND:VCALENDAR`;
const recurring = (extra = '') => event(`UID:weekly\nSUMMARY:Group\nDTSTART;TZID=Europe/London:20260916T180000\nDTEND;TZID=Europe/London:20260916T190000\nRRULE:FREQ=WEEKLY\nDESCRIPTION:Website: https://stjohnspark.org/park-youth#cornerstone\n${extra}`);
const range = (text, start = '2026-09-19', end = '2026-09-26', options) => expandCalendar(text, parseIssueDate(start), parseIssueDate(end), options);
const changed = (lines) => event(`UID:weekly\nRECURRENCE-ID;TZID=Europe/London:20260923T180000\n${lines}`);

test('weekly recurrence uses British Summer Time and a stable original identity', () => {
  const [item] = range(calendar(recurring()));
  assert.equal(item.start, '2026-09-23T17:00:00.000Z');
  assert.equal(item.id, 'weekly::2026-09-23T17:00:00.000Z');
  assert.equal(item.website, 'https://stjohnspark.org/park-youth#cornerstone');
});
test('renaming and moving a session replace the original and inherit the series link', () => {
  const [item] = range(calendar(recurring(), changed('DTSTART;TZID=Europe/London:20260924T190000\nDTEND;TZID=Europe/London:20260924T200000\nSUMMARY:Special session')));
  assert.equal(item.title, 'Special session');
  assert.equal(item.start, '2026-09-24T18:00:00.000Z');
  assert.equal(item.id, 'weekly::2026-09-23T17:00:00.000Z');
  assert.equal(item.website, 'https://stjohnspark.org/park-youth#cornerstone');
});
test('cancelled instances need no DTSTART and are not resurrected', () => {
  assert.deepEqual(range(calendar(recurring(), changed('STATUS:CANCELLED'))), []);
  assert.deepEqual(range(calendar(recurring('STATUS:CANCELLED'), changed('DTSTART:20260924T180000Z\nDTEND:20260924T190000Z'))), []);
});
test('EXDATE removes term-time gaps and RDATE adds a date', () => {
  const text = calendar(recurring('EXDATE;TZID=Europe/London:20260923T180000\nRDATE;TZID=Europe/London:20260925T180000'));
  assert.deepEqual(range(text).map((item) => item.start), ['2026-09-25T17:00:00.000Z']);
});
test('a moved instance outside the window is removed; an instance moved in is included', () => {
  assert.equal(range(calendar(recurring(), changed('DTSTART:20261001T170000Z\nDTEND:20261001T180000Z'))).length, 0);
  const text = calendar(recurring(), event('UID:weekly\nRECURRENCE-ID;TZID=Europe/London:20260930T180000\nDTSTART:20260925T170000Z\nDTEND:20260925T180000Z'));
  assert.equal(range(text).length, 2);
});
test('exceptions never attach to another series at the same time', () => {
  const text = calendar(recurring(), recurring().replace('UID:weekly', 'UID:second'), changed('DTSTART:20260924T180000Z\nDTEND:20260924T190000Z'));
  assert.deepEqual(range(text).map((item) => item.start), ['2026-09-23T17:00:00.000Z', '2026-09-24T18:00:00.000Z']);
});
test('duplicate component revisions use the highest sequence', () => {
  const text = calendar(recurring(), changed('SEQUENCE:2\nSTATUS:CANCELLED'), changed('SEQUENCE:1\nDTSTART:20260923T170000Z\nDTEND:20260923T180000Z'));
  assert.equal(range(text).length, 0);
});
test('spring and autumn DST preserve local meeting time', () => {
  for (const [start, end, first, second] of [['2026-03-23', '2026-04-06', '18:00', '17:00'], ['2026-10-19', '2026-11-02', '17:00', '18:00']]) {
    const text = calendar(recurring().replace('20260916', '20260107').replace('20260916', '20260107'));
    const items = range(text, start, end);
    assert.equal(items[0].start.slice(11, 16), first);
    assert.equal(items[1].start.slice(11, 16), second);
  }
});
test('all-day exclusive end and overlapping multi-day events are included', () => {
  const items = range(calendar(event('UID:all\nDTSTART;VALUE=DATE:20260918\nDTEND;VALUE=DATE:20260921')));
  assert.equal(items.length, 1);
  assert.equal(items[0].allDay, true);
  assert.equal(timeLabel(items[0]), 'All day');
  assert.equal(items[0].end, '2026-09-20T23:00:00.000Z');
});
test('floating local times and events with no end are supported', () => {
  const [item] = range(calendar(event('UID:float\nDTSTART:20260923T180000')));
  assert.equal(item.start, '2026-09-23T17:00:00.000Z');
  assert.equal(item.end, item.start);
});
test('empty is valid, malformed and unknown timezone feeds fail explicitly', () => {
  assert.deepEqual(range(calendar()), []);
  assert.throws(() => range('<html>Error</html>'), /Invalid|invalid/);
  assert.throws(() => range(calendar(event('UID:bad\nDTSTART;TZID=Unknown:20260923T180000'))), /Unknown timezone/);
});
test('iteration exhaustion fails instead of quietly omitting dates', () => {
  assert.throws(() => range(calendar(recurring()), undefined, undefined, { maxIterations: 1 }), /limit exceeded/);
});
test('old daily series and more than eight weekly entries are not truncated', () => {
  const text = calendar(event('UID:old\nDTSTART;TZID=Europe/London:20000101T080000\nDTEND;TZID=Europe/London:20000101T090000\nRRULE:FREQ=DAILY'), recurring(), event('UID:another\nDTSTART:20260924T180000Z'));
  assert.equal(range(text).length, 9);
});
test('range changes apply to future dates and shifted boundary dates', () => {
  const text = calendar(recurring(), event('UID:weekly\nRECURRENCE-ID;TZID=Europe/London;RANGE=THISANDFUTURE:20260923T180000\nDTSTART;TZID=Europe/London:20260921T180000\nDTEND;TZID=Europe/London:20260921T190000'));
  assert.equal(range(text, '2026-09-28', '2026-09-29')[0].start, '2026-09-28T17:00:00.000Z');
});
test('UTC recurrence IDs match local series occurrence identity', () => {
  const text = calendar(recurring(), event('UID:weekly\nRECURRENCE-ID:20260923T170000Z\nSTATUS:CANCELLED'));
  assert.equal(range(text).length, 0);
});
test('week ranges are exactly seven London dates across DST', () => {
  for (const [key, hours] of [['2026-03-23', 167], ['2026-10-19', 169]]) {
    const { start, end } = weekRange(parseIssueDate(key));
    assert.equal((end - start) / 3600000, hours);
  }
  const { start, end } = weekRange(parseIssueDate('2026-09-19'));
  const text = calendar(event('UID:first\nDTSTART:20260918T230000Z'), event('UID:excluded\nDTSTART:20260925T230000Z'));
  assert.deepEqual(expandCalendar(text, start, end).map((item) => item.uid), ['first']);
});
test('issue dates validate, default to London today, and reject rollover dates', () => {
  assert.equal(dateKey(parseIssueDate(null, new Date('2026-09-19T23:30:00Z'))), '2026-09-20');
  assert.throws(() => parseIssueDate('2026-02-30'));
  assert.throws(() => parseIssueDate('2026-13-01'));
  assert.throws(() => parseIssueDate('not-a-date'));
});
test('explicit Website line accepts Google HTML and ignores unrelated URLs', () => {
  assert.equal(websiteLink('<p>Website: <a href="https://stjohnspark.org/community#foodbank">More info</a></p>').value, 'https://stjohnspark.org/community#foodbank');
  assert.equal(websiteLink('Website: /community#foodbank').value, '/community#foodbank');
  assert.equal(websiteLink('https://stjohnspark.org/community').explicit, false);
  assert.equal(websiteLink(null).explicit, false);
  assert.equal(websiteLink('Website: /visit\nWebsite: /community').value, undefined);
});
test('only recognised site destinations become links', () => {
  const targets = new Set(['/community#foodbank']);
  assert.equal(resolveTarget('https://stjohnspark.org/community/#foodbank', targets), '/community#foodbank');
  assert.equal(resolveTarget('/community#missing', targets), undefined);
  assert.equal(canonicalTarget('https://evil.example/community'), undefined);
  assert.equal(canonicalTarget('javascript:alert(1)'), undefined);
});
test('exception with a new Website line overrides the master; invalid overrides do not inherit', () => {
  for (const [line, expected] of [['Website: /community#foodbank', '/community#foodbank'], ['Website: invalid', undefined]]) {
    const [item] = range(calendar(recurring(), changed(`DTSTART:20260923T170000Z\nDTEND:20260923T180000Z\nDESCRIPTION:${line}`)));
    assert.equal(item.website, expected);
  }
});
const now = new Date('2026-09-19T12:00:00Z');
const snapshot = { text: calendar(recurring()), verifiedAt: now.toISOString(), attemptedAt: now.toISOString(), etag: 'v1' };
test('failed refresh retains valid data and timestamps but exposes stale state', async () => {
  const value = await refreshSnapshot(snapshot, { now, fetcher: async () => { throw new Error('offline'); } });
  assert.equal(value.text, snapshot.text);
  assert.equal(value.verifiedAt, snapshot.verifiedAt);
  assert.equal(snapshotStatus(value, now), 'stale');
  assert.equal(snapshotStatus(value, new Date(+now + MAX_STALE_MS)), 'unavailable');
  const empty = await refreshSnapshot(undefined, { now, fetcher: async () => new Response('No', { status: 503 }) });
  assert.equal(snapshotStatus(empty, now), 'unavailable');
});
test('invalid new feed cannot replace last good snapshot; valid empty feed can', async () => {
  const bad = await refreshSnapshot(snapshot, { now, fetcher: async () => new Response('broken') });
  assert.equal(bad.text, snapshot.text);
  const empty = await refreshSnapshot(snapshot, { now, fetcher: async () => new Response(calendar()) });
  assert.equal(snapshotStatus(empty, now), 'fresh');
  assert.equal(range(empty.text).length, 0);
});
test('304 revalidates the retained snapshot and uses conditional request headers', async () => {
  const value = await refreshSnapshot({ ...snapshot, error: 'old error' }, { now, fetcher: async (_url, options) => {
    assert.equal(options.headers['If-None-Match'], 'v1');
    return new Response(null, { status: 304 });
  } });
  assert.equal(value.error, undefined);
  assert.equal(snapshotStatus(value, now), 'fresh');
});

import { relevantToIssue } from '../../src/lib/calendar/newsletter-selection.mjs';
test('newsletter includes recent news, excludes future/unpublished posts, and honours expiry', () => {
  const issue = parseIssueDate('2026-09-19');
  const base = { publishDate: new Date('2026-09-18'), displayOnNewsletter: true, category: 'update' };
  assert.equal(relevantToIssue(base, issue), true);
  assert.equal(relevantToIssue({ ...base, publishDate: new Date('2026-09-20') }, issue), false);
  assert.equal(relevantToIssue({ ...base, displayOnNewsletter: false }, issue), false);
  assert.equal(relevantToIssue({ ...base, newsletterDisplayUntil: new Date('2026-09-18') }, issue), false);
  assert.equal(relevantToIssue({ ...base, publishDate: new Date('2026-08-01'), newsletterDisplayUntil: new Date('2026-09-19') }, issue), true);
  assert.equal(relevantToIssue({ ...base, publishDate: new Date('2026-08-01'), newsletterDisplayUntil: new Date('2026-09-18') }, issue), false);
});
