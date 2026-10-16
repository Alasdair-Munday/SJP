import { addDays, dateKey, formatDay, parseIssueDate } from './dates.mjs';

/** @param {import('../events').EventItem} event */
export const isMorningPrayer = (event) => event.href?.replace(/\/$/, '') === '/events/morning-prayers'
  || /^(morning prayers|midweek online prayers)$/i.test(event.title.trim());

/** @param {import('../events').Schedule & { start: Date; end: Date }} schedule */
export function pdfTimetable(schedule) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const key = addDays(dateKey(schedule.start), index);
    const date = parseIssueDate(key);
    const events = schedule.events.filter((event) => dateKey(new Date(event.start)) <= key
      && dateKey(new Date(Math.max(+new Date(event.start), +new Date(event.end) - 1))) >= key);
    return { key, label: formatDay(date), weekday: new Date(`${key}T12:00:00Z`).getUTCDay(), events };
  });
  return {
    sunday: days.find((day) => day.weekday === 0),
    prayers: schedule.events.filter(isMorningPrayer),
    days: days.filter((day) => day.weekday !== 0).map((day) => ({ ...day, events: day.events.filter((event) => !isMorningPrayer(event)) })).filter((day) => day.events.length),
  };
}
