import { addDays, dateKey, timeLabel } from './dates.mjs';

const shortWeekday = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  weekday: 'short',
});

const singleDay = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

const signature = (event) => [
  event.title,
  event.href ?? '',
  event.location ?? '',
  event.allDay ? 'all-day' : timeLabel(event),
].join('\u001f');

const consecutive = (previous, next) =>
  dateKey(new Date(next.start)) === addDays(dateKey(new Date(previous.start)), 1);

const dateLabel = (events) => {
  const first = events[0];
  const last = events.at(-1);
  if (events.length === 1) return singleDay.format(new Date(first.start));
  return `${shortWeekday.format(new Date(first.start))}–${shortWeekday.format(new Date(last.start))}`;
};

/**
 * Collapses consecutive daily occurrences from the same recurring series.
 * One-off events and any changed occurrence retain their own row.
 */
export function compactSchedule(events) {
  const runs = [];
  const latestRunBySignature = new Map();
  for (const event of events) {
    const key = signature(event);
    const previous = latestRunBySignature.get(key);
    if (previous && previous.signature === signature(event) && consecutive(previous.events.at(-1), event)) {
      previous.events.push(event);
      continue;
    }
    const run = { signature: key, events: [event] };
    runs.push(run);
    latestRunBySignature.set(key, run);
  }
  return runs.sort((left, right) => left.events[0].start.localeCompare(right.events[0].start)).map((run) => ({
    ...run,
    dayLabel: dateLabel(run.events),
    timeLabel: timeLabel(run.events[0]),
    first: run.events[0],
  }));
}
