import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

dayjs.extend(utc);
dayjs.extend(timezone);
export const TIME_ZONE = 'Europe/London';

export function dateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function parseIssueDate(value, now = new Date()) {
  const key = value ?? dateKey(now);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || new Date(`${key}T12:00:00Z`).toISOString().slice(0, 10) !== key) {
    throw new Error('Please choose a valid issue date (YYYY-MM-DD).');
  }
  return dayjs.tz(`${key}T00:00:00`, TIME_ZONE).toDate();
}

export function addDays(key, days) {
  const date = new Date(`${key}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function weekRange(date = new Date()) {
  const key = dateKey(date);
  return { start: parseIssueDate(key), end: parseIssueDate(addDays(key, 7)) };
}

export function sixMonthsFrom(date) {
  const key = dateKey(date);
  return dayjs.tz(dayjs(key).add(6, 'month').format('YYYY-MM-DD'), TIME_ZONE).toDate();
}

export function floatingDate(value) {
  return dayjs.tz(value, TIME_ZONE).toDate();
}

export function formatDay(date) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(date));
}

export function formatTime(date) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(date));
}

export function timeLabel(event) {
  if (event.allDay) return 'All day';
  const start = formatTime(event.start);
  if (event.start === event.end) return start;
  const end = dateKey(new Date(event.start)) === dateKey(new Date(event.end))
    ? formatTime(event.end) : `${formatDay(event.end)}, ${formatTime(event.end)}`;
  return `${start}–${end}`;
}
