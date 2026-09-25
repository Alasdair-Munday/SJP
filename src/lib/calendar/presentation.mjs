import { dateKey } from './dates.mjs';

export function sundayServiceTitle(event) {
  const start = new Date(event.start);
  const key = dateKey(start);
  const local = new Date(`${key}T12:00:00Z`);
  const clock = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(start);
  if (local.getUTCDay() !== 0 || clock !== '10:45' || !/^(Sunday Service|St John's Holy Communion)$/i.test(event.title)) return event.title;
  const week = Math.ceil(local.getUTCDate() / 7);
  return `10:45 Service · ${week === 1 ? 'All In Communion' : week === 3 ? 'Holy Communion' : 'Service of the Word'}`;
}

export const legacyTargets = {
  '/visit#sundays': '/events/sunday-service',
  '/community#foodbank': '/events/foodbank',
  '/community#lunch-club': '/events/lunch-club',
  '/park-youth#cornerstone': '/events/cornerstone',
};

export function normalizeTarget(target) {
  return legacyTargets[target] ?? target;
}
