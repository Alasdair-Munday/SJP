import ICAL from 'ical.js';
import { floatingDate, parseIssueDate } from './dates.mjs';
import { websiteLink } from './links.mjs';

/** @typedef {{id: string, uid: string, originalStart: string, title: string, start: string, end: string, allDay: boolean, location: string, website: string | undefined, linkIssue: string | undefined, recurring: boolean}} Occurrence */

const cancelled = (component) => component.getFirstPropertyValue('status') === 'CANCELLED';
function instant(time) {
  if (!time) throw new Error('Event is missing a start/end date');
  if (time.isDate) return parseIssueDate(time.toString());
  if (time.zone.tzid === 'floating') return floatingDate(time.toString());
  return time.toJSDate();
}
const originalKey = (time) => time.isDate ? time.toString() : instant(time).toISOString();

export function parseCalendar(text) {
  if (!text.trim().startsWith('BEGIN:VCALENDAR') || !text.trim().endsWith('END:VCALENDAR')) throw new Error('Incomplete or invalid calendar feed');
  const calendar = new ICAL.Component(ICAL.parse(text));
  if (calendar.name !== 'vcalendar') throw new Error('Invalid calendar component');
  // Parsing and expansion are synchronous: timezone registrations cannot interleave.
  ICAL.TimezoneService.reset();
  for (const component of calendar.getAllSubcomponents('vtimezone')) {
    const tzid = component.getFirstPropertyValue('tzid');
    ICAL.TimezoneService.register(tzid, new ICAL.Timezone({ component, tzid }));
  }
  const groups = new Map();
  for (const component of calendar.getAllSubcomponents('vevent')) {
    const uid = component.getFirstPropertyValue('uid');
    if (!uid) throw new Error('Calendar entry has no UID');
    for (const name of ['dtstart', 'dtend', 'recurrence-id', 'exdate', 'rdate']) {
      for (const prop of component.getAllProperties(name)) {
        const tzid = prop.getParameter('tzid');
        if (tzid && !ICAL.TimezoneService.has(tzid)) throw new Error(`Unknown timezone ${tzid} in ${uid}`);
      }
    }
    const group = groups.get(uid) ?? new Map();
    const recurrence = component.getFirstPropertyValue('recurrence-id');
    const key = recurrence ? originalKey(recurrence) : 'master';
    const previous = group.get(key);
    const revision = (item) => [Number(item.getFirstPropertyValue('sequence') ?? 0), String(item.getFirstPropertyValue('dtstamp') ?? '')];
    if (!previous || revision(component)[0] > revision(previous)[0] || (revision(component)[0] === revision(previous)[0] && revision(component)[1] >= revision(previous)[1])) group.set(key, component);
    groups.set(uid, group);
  }
  return groups;
}

/** Expand complete series, attaching only exceptions with the same UID. */
export function expandCalendar(text, rangeStart, rangeEnd, { maxIterations = 100000, maxOccurrences = 20000 } = {}) {
  const start = new Date(rangeStart);
  const end = new Date(rangeEnd);
  if (!Number.isFinite(+start) || !Number.isFinite(+end) || end <= start) throw new Error('Invalid calendar range');
  const groups = parseCalendar(text);
  /** @type {Map<string, Occurrence>} */
  const result = new Map();
  let iterations = 0;
  const deadline = Date.now() + 5000;
  function guard() {
    if (++iterations > maxIterations || result.size > maxOccurrences || Date.now() > deadline) throw new Error('Calendar expansion limit exceeded');
  }
  for (const [uid, group] of groups) {
    const master = group.get('master');
    if (master && cancelled(master)) continue;
    const exceptions = [...group.entries()].filter(([key]) => key !== 'master').map(([, component]) => component);
    const activeExceptions = exceptions.filter((component) => !cancelled(component));
    const cancellationKeys = new Set(exceptions.filter(cancelled).map((component) => originalKey(component.getFirstPropertyValue('recurrence-id'))));
    const cancelledRanges = exceptions.filter((component) => cancelled(component) && component.getFirstProperty('recurrence-id').getParameter('range') === 'THISANDFUTURE').map((component) => +instant(component.getFirstPropertyValue('recurrence-id')));
    const base = master ? new ICAL.Event(master, { exceptions: activeExceptions, strictExceptions: true }) : undefined;
    const baseLink = websiteLink(base?.description);

    function add(item, startTime, endTime, original) {
      guard();
      if (cancelled(item.component) || cancellationKeys.has(originalKey(original)) || cancelledRanges.some((from) => +instant(original) >= from)) return;
      const actualStart = instant(startTime);
      const actualEnd = instant(endTime);
      if (!Number.isFinite(+actualStart) || !Number.isFinite(+actualEnd) || actualEnd < actualStart) throw new Error(`Invalid dates in ${uid}`);
      if (actualStart >= end || (actualEnd > actualStart ? actualEnd <= start : actualStart < start)) return;
      const overrideLink = websiteLink(item.description);
      const link = overrideLink.explicit ? overrideLink : baseLink;
      const originalStart = originalKey(original);
      const id = `${uid}::${originalStart}`;
      result.set(id, {
        id, uid, originalStart,
        title: item.summary ?? base?.summary ?? 'Untitled event',
        start: actualStart.toISOString(), end: actualEnd.toISOString(), allDay: startTime.isDate,
        location: item.location ?? base?.location ?? '',
        website: link.value, linkIssue: link.issue,
        recurring: Boolean(base?.isRecurring() || original !== startTime),
      });
    }

    if (base) {
      if (!base.startDate) throw new Error(`Missing DTSTART in ${uid}`);
      if (!base.isRecurring()) add(base, base.startDate, base.endDate, base.startDate);
      else {
        // A range exception can move later original dates into this window.
        const shifts = activeExceptions.filter((component) => component.getFirstProperty('recurrence-id').getParameter('range') === 'THISANDFUTURE')
          .map((component) => +instant(component.getFirstPropertyValue('recurrence-id')) - +instant(component.getFirstPropertyValue('dtstart')));
        const originalEnd = +end + Math.max(0, ...shifts);
        const iterator = base.iterator();
        let next;
        while ((next = iterator.next())) {
          guard();
          if (+instant(next) >= originalEnd) break;
          if (cancellationKeys.has(originalKey(next))) continue;
          const details = base.getOccurrenceDetails(next);
          add(details.item, details.startDate, details.endDate, next);
        }
      }
    }
    // Include exceptions moved in from outside the window, including detached ones.
    for (const component of activeExceptions) {
      const item = new ICAL.Event(component, { exceptions: [] });
      add(item, item.startDate, item.endDate, item.recurrenceId);
    }
  }
  if (result.size > maxOccurrences) throw new Error('Calendar expansion limit exceeded');
  return [...result.values()].sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
}
