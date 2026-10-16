const DAY = 86_400_000;

export function socialPublicationDates(issueDate) {
  const date = new Date(`${issueDate}T12:00:00Z`);
  const day = date.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(date.getTime() + mondayOffset * DAY);
  const key = (offset) => new Date(monday.getTime() + offset * DAY).toISOString().slice(0, 10);
  return { tuesday: key(1), thursday: key(3), saturday: key(5), nextMonday: key(7) };
}

export function shortDesignTitle(value, limit = 12) {
  const words = String(value).trim().split(/\s+/).filter(Boolean);
  return words.length <= limit ? words.join(' ') : `${words.slice(0, limit).join(' ')}…`;
}

export function isSocialPostEligible(post, publicationDate) {
  if (!post.socialEnabled || !post.socialConsentConfirmed) return false;
  const publish = new Date(post.publishDate).toISOString().slice(0, 10);
  if (publish > publicationDate) return false;
  if (!post.socialDoNotUseAfter) return true;
  return new Date(post.socialDoNotUseAfter).toISOString().slice(0, 10) >= publicationDate;
}

export function captions({ intro, body, url, hashtags = '#StJohnsPark #SheffieldChurch' }) {
  const facebook = `${intro}\n\n${body}\n\nFind out more: ${url}`;
  return { facebook, instagram: `${facebook}\n\n${hashtags}` };
}
