import { createHash } from 'node:crypto';
import { getStore } from '@netlify/blobs';
import { expandCalendar } from './core.mjs';
import { sixMonthsFrom, weekRange } from './dates.mjs';

export const DEFAULT_CALENDAR_URL = 'https://calendar.google.com/calendar/ical/c_b253bc81383f7876a658ad71f516be079528043a755a7c79713cd2c4529b1a26%40group.calendar.google.com/public/basic.ics';
export const REFRESH_MS = 5 * 60 * 1000;
export const MAX_STALE_MS = 24 * 60 * 60 * 1000;
/** @typedef {{text?: string, verifiedAt?: string, attemptedAt: string, error?: string, etag?: string, lastModified?: string}} Snapshot */

export function calendarUrl() {
  return globalThis.Netlify?.env?.get('PUBLIC_CALENDAR_ICS_URL') || process.env.PUBLIC_CALENDAR_ICS_URL || DEFAULT_CALENDAR_URL;
}

/** Pure refresh operation, also used by the scheduled job and fixture tests. */
export async function refreshSnapshot(previous, { url = calendarUrl(), now = new Date(), fetcher = fetch } = {}) {
  const attemptedAt = now.toISOString();
  try {
    const headers = {};
    if (previous?.etag) headers['If-None-Match'] = previous.etag;
    if (previous?.lastModified) headers['If-Modified-Since'] = previous.lastModified;
    const response = await fetcher(url, { headers, signal: AbortSignal.timeout(10000) });
    if (response.status === 304 && previous?.text) return { ...previous, attemptedAt, verifiedAt: attemptedAt, error: undefined };
    if (!response.ok) throw new Error(`Calendar fetch returned HTTP ${response.status}`);
    const text = await response.text();
    if (text.length > 5_000_000) throw new Error('Calendar feed exceeds size limit');
    expandCalendar(text, weekRange(now).start, sixMonthsFrom(now));
    return { text, attemptedAt, verifiedAt: attemptedAt, etag: response.headers.get('etag') || undefined, lastModified: response.headers.get('last-modified') || undefined, error: undefined };
  } catch (error) {
    return { ...previous, attemptedAt, error: error instanceof Error ? error.message : 'Calendar refresh failed' };
  }
}

export function snapshotStatus(snapshot, now = new Date()) {
  const age = snapshot?.verifiedAt ? +now - +new Date(snapshot.verifiedAt) : Infinity;
  if (!snapshot?.text || !Number.isFinite(age) || age >= MAX_STALE_MS) return 'unavailable';
  if (snapshot.error || age >= REFRESH_MS * 2) return 'stale';
  return 'fresh';
}

let memory;
let memorySource;
let pending;
let memoryUntil = 0;

/** Netlify has durable storage; plain Astro dev uses a short-lived in-memory cache. */
export async function getSnapshot({ force = false, url = calendarUrl() } = {}) {
  if (memorySource !== url) { memory = undefined; memoryUntil = 0; memorySource = url; }
  if (!force && memory && Date.now() < memoryUntil) return memory;
  if (pending) return pending;
  pending = (async () => {
    let store;
    let storageError;
    const key = createHash('sha256').update(url).digest('hex');
    try {
      store = getStore({ name: 'calendar-snapshots-v1', consistency: 'strong' });
      const saved = await store.get(key, { type: 'json' });
      if (saved && (!memory || saved.attemptedAt > memory.attemptedAt)) memory = saved;
    } catch (error) {
      // No Blobs context in plain `astro dev`. In production record the failure.
      if (process.env.NETLIFY || globalThis.Netlify) storageError = 'Calendar snapshot storage is unavailable';
    }
    if (force || !memory || Date.now() - +new Date(memory.attemptedAt) >= REFRESH_MS) {
      memory = await refreshSnapshot(memory, { url });
      if (store) {
        try { await store.setJSON(key, memory); }
        catch { storageError = 'Calendar snapshot could not be saved'; }
      }
    }
    if (storageError) memory = { ...memory, error: storageError };
    if (memory.error) console.error('[calendar]', memory.error);
    // Re-read shared storage after a minute, so a scheduled cancellation update is seen.
    memoryUntil = Math.min(Date.now() + 60_000, +new Date(memory.attemptedAt) + REFRESH_MS);
    return memory;
  })();
  try { return await pending; } finally { pending = undefined; }
}
