import { timeLabel } from './dates.mjs';

// Keep changed times, locations and links separate, even within one series.
/**
 * @template {{id: string, uid: string, recurring: boolean, title: string, href?: string, location?: string, allDay: boolean, start: string, end: string}} T
 * @param {T[]} events
 * @returns {{first: T, events: T[]}[]}
 */
export function groupHomeRecurrences(events) {
  /** @type {Map<string, {first: T, events: T[]}>} */
  const groups = new Map();
  for (const event of events) {
    if (!event.recurring || !event.uid) continue;
    const key = JSON.stringify([event.uid, event.title, event.href ?? '', event.location ?? '', event.allDay, timeLabel(event)]);
    const group = groups.get(key) ?? { first: event, events: [] };
    group.events.push(event);
    groups.set(key, group);
  }
  return [...groups.values()].filter((group) => group.events.length > 1);
}
