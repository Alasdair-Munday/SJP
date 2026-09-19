import { getCollection } from 'astro:content';
import { expandCalendar, type Occurrence } from './calendar/core.mjs';
import { getSnapshot, snapshotStatus, calendarUrl } from './calendar/store.mjs';
import { canonicalTarget, resolveTarget } from './calendar/links.mjs';
import { dateKey, formatDay, formatTime, parseIssueDate, sixMonthsFrom, timeLabel, weekRange, addDays } from './calendar/dates.mjs';
import { mappedPageRoutes } from './pageRoutes';

export { dateKey, formatDay, formatTime, parseIssueDate, timeLabel, weekRange };
export type EventItem = Occurrence & { href?: string };
export type Schedule = {
  events: EventItem[];
  status: 'fresh' | 'stale' | 'unavailable';
  verifiedAt?: string;
  message: string;
  diagnostics: { uid: string; title: string; issue: string }[];
};

export async function getCalendarTargets() {
  const [pages, posts] = await Promise.all([getCollection('pages'), getCollection('posts')]);
  const targets = new Set<string>();
  for (const page of pages) {
    const path = page.id === 'home' ? '/' : `/${mappedPageRoutes.find((route) => route.pageId === page.id)?.slug ?? page.id}`;
    targets.add(path);
    for (const section of page.data.sections) {
      if (section.id) targets.add(`${path}#${section.id}`);
      if (section.type === 'cards') for (const card of section.cards) if (card.id) targets.add(`${path}#${card.id}`);
    }
  }
  for (const post of posts) targets.add(`/news/${post.slug}`);
  return targets;
}

export async function getSchedule(start: Date, end: Date): Promise<Schedule> {
  const [snapshot, targets] = await Promise.all([getSnapshot({ url: import.meta.env.PUBLIC_CALENDAR_ICS_URL || calendarUrl() }), getCalendarTargets()]);
  const status = snapshotStatus(snapshot);
  const verifiedAt = snapshot.verifiedAt;
  const unavailable: Schedule = { events: [], status: 'unavailable', verifiedAt, message: 'Schedule temporarily unavailable. Please contact us to confirm dates.', diagnostics: [] };
  if (status === 'unavailable') return unavailable;
  try {
    const diagnostics: Schedule['diagnostics'] = [];
    const seen = new Set<string>();
    const events = expandCalendar(snapshot.text!, start, end).map((event: Occurrence) => {
      const href = resolveTarget(event.website, targets);
      if (!href && !seen.has(event.uid)) {
        diagnostics.push({ uid: event.uid, title: event.title, issue: event.linkIssue || 'Website link does not match a published page or section' });
        seen.add(event.uid);
      }
      return { ...event, href };
    });
    return { events, status, verifiedAt, diagnostics, message: status === 'stale' ? `Calendar updates are delayed. Last checked ${formatDay(verifiedAt!)}, ${formatTime(verifiedAt!)}. Please confirm changes with us.` : '' };
  } catch (error) {
    console.error('[calendar] Could not expand schedule', error);
    return unavailable;
  }
}

export async function getThisWeek(date = new Date()) {
  const { start, end } = weekRange(date);
  return { ...await getSchedule(start, end), start, end, label: `${formatDay(start)} – ${formatDay(parseIssueDate(addDays(dateKey(start), 6)))}` };
}

export async function getTargetSchedule(target: string, from = new Date(), limit = 6) {
  const schedule = await getSchedule(from, sixMonthsFrom(from));
  const canonical = canonicalTarget(target);
  return { ...schedule, events: schedule.events.filter((event) => Boolean(canonical) && event.href === canonical).slice(0, limit) };
}

export function groupSchedule(events: EventItem[], start?: Date, end?: Date) {
  const groups = new Map<string, EventItem[]>();
  for (const event of events) {
    let day = dateKey(new Date(event.start));
    const last = dateKey(new Date(Math.max(+new Date(event.start), +new Date(event.end) - 1)));
    if (start && day < dateKey(start)) day = dateKey(start);
    while (day <= last && (!end || day < dateKey(end))) {
      groups.set(day, [...(groups.get(day) ?? []), event]);
      day = addDays(day, 1);
    }
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, items]) => ({ day, label: formatDay(parseIssueDate(day)), events: items }));
}
