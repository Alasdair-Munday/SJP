import { getCollection } from 'astro:content';
import { expandCalendar, type Occurrence } from './calendar/core.mjs';
import { getSnapshot, snapshotStatus, calendarUrl } from './calendar/store.mjs';
import { canonicalTarget, resolveTarget } from './calendar/links.mjs';
import { compactSchedule } from './calendar/compact.mjs';
import { dateKey, formatDay, formatTime, parseIssueDate, sixMonthsFrom, timeLabel, weekRange, addDays } from './calendar/dates.mjs';
import { mappedPageRoutes } from './pageRoutes';

export { dateKey, formatDay, formatTime, parseIssueDate, timeLabel, weekRange, compactSchedule };
export type EventItem = Occurrence & { href?: string };
export type Schedule = {
  events: EventItem[];
  status: 'fresh' | 'stale' | 'unavailable';
  verifiedAt?: string;
  message: string;
  diagnostics: { uid: string; title: string; issue: string }[];
};

function sundayServiceTitle(event: Occurrence) {
  const start = new Date(event.start);
  const isTenFortyFiveSunday = start.getDay() === 0 && start.getHours() === 10 && start.getMinutes() === 45
    && /^(Sunday Service|St John's Holy Communion)$/i.test(event.title);
  if (!isTenFortyFiveSunday) return event.title;

  const sundayNumber = Math.ceil(start.getDate() / 7);
  if (sundayNumber === 1) return '10:45 Service · All In Communion';
  if (sundayNumber === 3) return '10:45 Service · Holy Communion';
  return '10:45 Service · Service of the Word';
}

function eventPageTarget(event: Occurrence, target?: string) {
  const byTitle: Record<string, string> = {
    'Morning Prayers': '/events/morning-prayers',
    'Midweek Online Prayers': '/events/morning-prayers',
    'Midweek Communion, Lunch & Bible Study': '/events/midweek-communion',
    Foodbank: '/events/foodbank',
    'Lunch Club': '/events/lunch-club',
    Cornerstone: '/events/cornerstone',
    'Simplicity: Traditional Holy Communion': '/events/simplicity',
    'Sunday Service': '/events/sunday-service',
    "St John's Holy Communion": '/events/sunday-service',
  };
  return byTitle[event.title] ?? target;
}

export async function getCalendarTargets() {
  const [pages, posts, eventPages] = await Promise.all([getCollection('pages'), getCollection('posts'), getCollection('events')]);
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
  for (const eventPage of eventPages) targets.add(`/events/${eventPage.slug}`);
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
      const href = eventPageTarget(event, resolveTarget(event.website, targets));
      if (!href && !seen.has(event.uid)) {
        diagnostics.push({ uid: event.uid, title: event.title, issue: event.linkIssue || 'Website link does not match a published page or section' });
        seen.add(event.uid);
      }
      return { ...event, title: sundayServiceTitle(event), href };
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

export async function getTargetSchedule(target: string | string[], from = new Date(), limit = 2) {
  const schedule = await getSchedule(from, sixMonthsFrom(from));
  const canonicals = (Array.isArray(target) ? target : [target]).map((value) => canonicalTarget(value)).filter(Boolean);
  return { ...schedule, events: schedule.events.filter((event) => canonicals.includes(event.href ?? '')).slice(0, limit) };
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
