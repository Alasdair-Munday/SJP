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
