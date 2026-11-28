import { addDays, dateKey, parseIssueDate } from './dates.mjs';

// An issue looks back for recent news and forward for event announcements.
export function relevantToIssue(data, issueDate) {
  if (!data.displayOnNewsletter) return false;
  const key = dateKey(issueDate);
  const start = parseIssueDate(key);
  const nextDay = parseIssueDate(addDays(key, 1));
  const recentStart = parseIssueDate(addDays(key, -6));
  if (data.publishDate >= nextDay) return false;
  const displayUntil = data.newsletterDisplayUntil ?? data.relevantUntil;
  if (displayUntil && displayUntil < start) return false;
  if (data.publishDate >= recentStart) return true;
  if (displayUntil && displayUntil >= start) return true;
  return data.category === 'event' && Boolean(data.eventDate && (data.eventDate >= start || (data.eventEndDate && data.eventEndDate >= start)));
}

/** A custom selection is scoped to the issue in the URL, not the CMS content. */
export function filterNewsletterItems(items, params, key) {
  if (params.get('selection') !== 'custom') return items;
  const selected = new Set(params.getAll(key));
  return items.filter(item => selected.has(item.id));
}

export function newsletterSelectionQuery(params) {
  const query = new URLSearchParams();
  if (params.get('date')) query.set('date', params.get('date'));
  if (params.get('selection') === 'custom') {
    query.set('selection', 'custom');
    for (const key of ['post', 'event']) {
      for (const id of params.getAll(key)) query.append(key, id);
    }
  }
  return query;
}
