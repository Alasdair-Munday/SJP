import test from 'node:test';
import assert from 'node:assert/strict';
import { selectNewsletterIssue } from '../../src/lib/calendar/newsletter-issue.mjs';
const entry = (id, date, published = true, body = 'Approved reflection') => ({ id, data: { issueDate: new Date(date), published, body } });
const start = new Date('2026-10-11T23:00:00Z'), end = new Date('2026-10-18T23:00:00Z');
test('only approved non-empty thoughts in the selected week are eligible', () => {
  const approved = entry('approved', '2026-10-16');
  assert.equal(selectNewsletterIssue([
    entry('draft', '2026-10-18', false), entry('empty', '2026-10-18', true, '  '),
    entry('previous', '2026-10-10'), entry('next', '2026-10-19'), approved,
  ], start, end), approved);
  assert.equal(selectNewsletterIssue([entry('draft', '2026-10-18', false)], start, end), undefined);
});
