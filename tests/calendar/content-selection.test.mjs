import test from 'node:test';
import assert from 'node:assert/strict';
import { newsPosts, eventAnnouncements } from '../../src/lib/content-selection.mjs';

const post = (id, category, extra = {}) => ({ id, data: { category, publishDate: new Date('2026-10-01'), ...extra } });
const now = new Date('2026-10-27T22:00:00Z');
test('news excludes past and future events, retaining updates and reflections in publication order', () => {
  const posts = [post('event', 'event', { eventDate: new Date('2026-12-04') }),
    post('update', 'update'), post('blog', 'blog', { publishDate: new Date('2026-10-25') }),
    post('thought', 'thought'), post('past-event', 'event', { eventDate: new Date('2025-08-23') })];
  assert.deepEqual(newsPosts(posts).map(p => p.id), ['blog', 'update', 'thought']);
  assert.equal(posts.length, 5, 'Filtering must not remove events from the source used by newsletters and detail pages');
});
test('announcements include upcoming and ongoing events, and seasonal notices without a single date', () => {
  const posts = [post('christmas', 'event', { newsletterDisplayUntil: new Date('2026-12-26') }),
    post('tomorrow', 'event', { eventDate: new Date('2026-10-28') }),
    post('ongoing', 'event', { eventDate: new Date('2026-10-24'), eventEndDate: new Date('2026-10-27') }),
    post('expired', 'event', { eventDate: new Date('2026-10-26') }),
    post('expired-season', 'event', { newsletterDisplayUntil: new Date('2026-10-26') }),
    post('undated', 'event'), post('update', 'update')];
  assert.deepEqual(eventAnnouncements(posts, now).map(p => p.id), ['ongoing', 'tomorrow', 'christmas', 'undated']);
});
test('a date-only event remains visible through its last day in British Summer Time', () => {
  const event = post('today', 'event', { eventDate: new Date('2026-06-03') });
  assert.equal(eventAnnouncements([event], new Date('2026-06-03T22:59:00Z')).length, 1);
  assert.equal(eventAnnouncements([event], new Date('2026-06-03T23:01:00Z')).length, 0);
});
