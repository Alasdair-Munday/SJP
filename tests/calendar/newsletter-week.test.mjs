import test from 'node:test';
import assert from 'node:assert/strict';
import { newsletterWeekRange, weekRange, dateKey, parseIssueDate } from '../../src/lib/calendar/dates.mjs';

test('newsletter anchors every issue date to its Monday–Sunday week; homepage remains rolling', () => {
  for (const key of ['2026-10-12', '2026-10-14', '2026-10-18']) {
    const range = newsletterWeekRange(parseIssueDate(key));
    assert.equal(dateKey(range.start), '2026-10-12');
    assert.equal(dateKey(range.end), '2026-10-19');
  }
  assert.equal(dateKey(weekRange(parseIssueDate('2026-10-14')).start), '2026-10-14');
  assert.equal(dateKey(weekRange(parseIssueDate('2026-10-14')).end), '2026-10-21');
});

test('newsletter weeks preserve local Monday boundaries across DST and year rollover', () => {
  for (const [key, start, end, hours] of [
    ['2026-03-29', '2026-03-23', '2026-03-30', 167],
    ['2026-10-25', '2026-10-19', '2026-10-26', 169],
    ['2027-01-01', '2026-12-28', '2027-01-04', 168],
  ]) {
    const range = newsletterWeekRange(parseIssueDate(key));
    assert.equal(dateKey(range.start), start);
    assert.equal(dateKey(range.end), end);
    assert.equal((range.end - range.start) / 3600000, hours);
  }
});
