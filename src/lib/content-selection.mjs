import { dateKey } from './calendar/dates.mjs';

/** Keep event announcements out of public news lists without removing detail pages or newsletter content.
 * @template {{data: {category: string, publishDate: Date}}} T
 * @param {T[]} posts
 * @returns {T[]}
 */
export function newsPosts(posts) {
  return posts.filter((post) => post.data.category !== 'event')
    .sort((left, right) => +right.data.publishDate - +left.data.publishDate);
}

/** Select announcements independently of the live calendar so seasonal notices without a single date remain visible.
 * @template {{data: {category: string, eventDate?: Date, eventEndDate?: Date, newsletterDisplayUntil?: Date, relevantUntil?: Date}}} T
 * @param {T[]} posts
 * @param {Date} now
 * @returns {T[]}
 */
export function eventAnnouncements(posts, now = new Date()) {
  const today = dateKey(now);
  // CMS dates are date-only values, coerced to UTC midnight by the content schema.
  const day = (date) => new Date(date).toISOString().slice(0, 10);
  return posts.filter(({ data }) => {
    if (data.category !== 'event') return false;
    const lastDate = data.eventEndDate ?? data.eventDate ?? data.relevantUntil ?? data.newsletterDisplayUntil;
    return !lastDate || day(lastDate) >= today;
  }).sort((left, right) =>
    +(left.data.eventDate ?? new Date(8640000000000000)) - +(right.data.eventDate ?? new Date(8640000000000000)));
}
