import ICAL from 'ical.js';

const DEFAULT_CALENDAR_URL =
  'https://calendar.google.com/calendar/ical/c_b253bc81383f7876a658ad71f516be079528043a755a7c79713cd2c4529b1a26%40group.calendar.google.com/public/basic.ics';
const DEFAULT_CALENDAR_TIME_ZONE = 'Europe/London';

export const CALENDAR_URL =
  import.meta.env.PUBLIC_CALENDAR_ICS_URL || DEFAULT_CALENDAR_URL;
export const CALENDAR_TIME_ZONE =
  import.meta.env.PUBLIC_CALENDAR_TIME_ZONE || DEFAULT_CALENDAR_TIME_ZONE;

export interface CalendarImageAttachment {
  url: string;
  thumbnailUrl: string;
  fileName?: string;
  mimeType?: string;
}

export interface CalendarEvent {
  id: string;
  uid: string;
  slug: string;
  title: string;
  start: Date;
  end: Date;
  timeZone: string;
  location?: string;
  description?: string;
  descriptionHtml?: string;
  thumbnailUrl?: string;
  imageAttachments: CalendarImageAttachment[];
}

let calendarTextPromise: Promise<string | null> | null = null;

async function getCalendarText(): Promise<string | null> {
  if (!calendarTextPromise) {
    calendarTextPromise = (async () => {
      try {
        const response = await fetch(CALENDAR_URL);
        if (!response.ok) {
          console.error('Failed to fetch calendar');
          return null;
        }
        return await response.text();
      } catch (error) {
        console.error('Error fetching calendar:', error);
        return null;
      }
    })();
  }

  return calendarTextPromise;
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[\u2018\u2019']/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 80) || 'event'
  );
}

function normalizeUid(uid: string): string {
  return (
    uid
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'uid'
  );
}

function buildEventSlug(title: string, start: Date, uid: string): string {
  const startKey = start.toISOString().slice(0, 16).replace(/[:-]/g, '').replace('T', '-');
  const uidKey = normalizeUid(uid).slice(0, 24);
  return `${slugify(title)}-${startKey}-${uidKey}`;
}

function getDriveFileId(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes('drive.google.com')) return undefined;

    const directId = parsed.searchParams.get('id');
    if (directId) return directId;

    const filePathMatch = parsed.pathname.match(/\/file\/d\/([^/]+)/);
    if (filePathMatch?.[1]) return filePathMatch[1];

    const genericMatch = parsed.pathname.match(/\/d\/([^/]+)/);
    if (genericMatch?.[1]) return genericMatch[1];

    return undefined;
  } catch {
    return undefined;
  }
}

function toDriveImage(url: string, width: number): string {
  const driveId = getDriveFileId(url);
  if (!driveId) return url;
  return `https://drive.google.com/thumbnail?id=${driveId}&sz=w${width}`;
}

function looksLikeImageAttachment(prop: any, attachValue: string): boolean {
  const formatType = String(prop.getParameter?.('fmttype') || '').toLowerCase();
  const fileName = String(prop.getParameter?.('filename') || '').toLowerCase();
  const imageExtPattern = /\.(avif|bmp|gif|heic|jpeg|jpg|png|svg|webp)(\?|$)/i;

  return (
    formatType.startsWith('image/') ||
    imageExtPattern.test(fileName) ||
    imageExtPattern.test(attachValue)
  );
}

function getImageAttachments(component: any): CalendarImageAttachment[] {
  if (!component?.getAllProperties) return [];

  const attachments = component.getAllProperties('attach') || [];
  const imageAttachments: CalendarImageAttachment[] = [];

  for (const attachment of attachments) {
    const rawValue = attachment.getFirstValue?.();
    if (typeof rawValue !== 'string' || !rawValue.trim()) continue;

    const value = rawValue.trim();
    if (!looksLikeImageAttachment(attachment, value)) continue;

    imageAttachments.push({
      url: toDriveImage(value, 2200),
      thumbnailUrl: toDriveImage(value, 900),
      fileName: String(attachment.getParameter?.('filename') || ''),
      mimeType: String(attachment.getParameter?.('fmttype') || ''),
    });
  }

  return imageAttachments;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeRichHtml(value: string): string {
  return value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/<(iframe|object|embed|link|meta)[\s\S]*?>[\s\S]*?<\/(iframe|object|embed|link|meta)>/gi, '')
    .replace(/<(iframe|object|embed|link|meta)[^>]*\/?\s*>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*'[^']*'/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*[^\s>]+/gi, '')
    .replace(/(href|src)\s*=\s*"\s*javascript:[^"]*"/gi, '$1="#"')
    .replace(/(href|src)\s*=\s*'\s*javascript:[^']*'/gi, "$1='#'");
}

function descriptionToHtml(description?: string): string | undefined {
  if (!description) return undefined;

  const normalized = description.replace(/\r\n/g, '\n').trim();
  if (!normalized) return undefined;

  const hasHtml = /<\/?[a-z][\s\S]*?>/i.test(normalized);
  if (hasHtml) return sanitizeRichHtml(normalized);

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br />')}</p>`)
    .join('');

  return paragraphs;
}

function resolveTimeZone(startDate: any): string {
  const tzid = String(startDate?.zone?.tzid || '');
  if (!tzid || tzid === 'floating' || tzid === 'local') return CALENDAR_TIME_ZONE;
  return tzid;
}

function buildEventRecord(params: {
  uid: string;
  title: string;
  startDate: any;
  endDate: any;
  location?: string;
  description?: string;
  imageAttachments: CalendarImageAttachment[];
}): CalendarEvent {
  const start = params.startDate.toJSDate();
  const uid = params.uid || `uid-${params.title}`;
  const slug = buildEventSlug(params.title, start, uid);
  const descriptionHtml = descriptionToHtml(params.description);

  return {
    id: `${uid}::${start.toISOString()}`,
    uid,
    slug,
    title: params.title || 'Untitled event',
    start,
    end: params.endDate.toJSDate(),
    timeZone: resolveTimeZone(params.startDate),
    location: params.location,
    description: params.description,
    descriptionHtml,
    thumbnailUrl: params.imageAttachments[0]?.thumbnailUrl,
    imageAttachments: params.imageAttachments,
  };
}

async function getExpandedEventsBetween(
  rangeStart: Date,
  rangeEnd: Date,
  recurringPerEventLimit = 120,
): Promise<CalendarEvent[]> {
  const calendarText = await getCalendarText();
  if (!calendarText) return [];

  try {
    const jcalData = ICAL.parse(calendarText);
    const comp = new ICAL.Component(jcalData);
    const vevents = comp.getAllSubcomponents('vevent');

    const upcoming: CalendarEvent[] = [];

    for (const vevent of vevents) {
      const event = new ICAL.Event(vevent);
      const baseImages = getImageAttachments(vevent);
      const uid = event.uid || '';
      const title = event.summary || 'Untitled event';

      if (!event.isRecurring()) {
        const startDate = event.startDate;
        const start = startDate.toJSDate();
        if (start >= rangeStart && start <= rangeEnd) {
          upcoming.push(
            buildEventRecord({
              uid,
              title,
              startDate,
              endDate: event.endDate,
              location: event.location,
              description: event.description,
              imageAttachments: baseImages,
            }),
          );
        }
        continue;
      }

      // Start from DTSTART to preserve the event's original time-of-day.
      const iterator = event.iterator(event.startDate.clone());
      let matches = 0;
      let safetyCounter = 0;
      let next: any;

      while ((next = iterator.next())) {
        safetyCounter += 1;
        if (safetyCounter > 5000) break;

        const occurrence = event.getOccurrenceDetails(next);
        const start = occurrence.startDate.toJSDate();

        if (start < rangeStart) {
          continue;
        }

        if (start > rangeEnd) {
          break;
        }

        const occurrenceImages = getImageAttachments(occurrence.item?.component);

        upcoming.push(
          buildEventRecord({
            uid,
            title,
            startDate: occurrence.startDate,
            endDate: occurrence.endDate,
            location: occurrence.item?.location || event.location,
            description: occurrence.item?.description || event.description,
            imageAttachments: occurrenceImages.length > 0 ? occurrenceImages : baseImages,
          }),
        );

        matches += 1;
        if (matches >= recurringPerEventLimit) break;
      }
    }

    const uniqueById = new Map<string, CalendarEvent>();
    for (const item of upcoming) {
      if (!uniqueById.has(item.id)) uniqueById.set(item.id, item);
    }

    return Array.from(uniqueById.values()).sort(
      (a, b) => a.start.getTime() - b.start.getTime(),
    );
  } catch (error) {
    console.error('Error parsing calendar:', error);
    return [];
  }
}

export async function getUpcomingEvents(
  limit = 3,
  filterDuplicates = false,
): Promise<CalendarEvent[]> {
  const now = new Date();
  const horizon = new Date(now.getTime() + 366 * 24 * 60 * 60 * 1000);
  const events = await getExpandedEventsBetween(
    now,
    horizon,
    Math.max(limit * 8, 24),
  );

  if (filterDuplicates) {
    const uniqueEvents: CalendarEvent[] = [];
    const seenTitles = new Set<string>();

    for (const event of events) {
      if (!seenTitles.has(event.title)) {
        uniqueEvents.push(event);
        seenTitles.add(event.title);
      }
      if (uniqueEvents.length >= limit) break;
    }

    return uniqueEvents;
  }

  return events.slice(0, limit);
}

export async function getEventsForNextMonths(months = 2): Promise<CalendarEvent[]> {
  const now = new Date();
  const end = new Date(
    now.getFullYear(),
    now.getMonth() + months,
    0,
    23,
    59,
    59,
    999,
  );

  return getExpandedEventsBetween(now, end, 300);
}

function formatInTimeZone(
  date: Date,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone, ...options }).format(date);
}

export function formatEventMonthShort(
  date: Date,
  timeZone = CALENDAR_TIME_ZONE,
): string {
  return formatInTimeZone(date, timeZone, { month: 'short' });
}

export function formatEventDayOfMonth(
  date: Date,
  timeZone = CALENDAR_TIME_ZONE,
): string {
  return formatInTimeZone(date, timeZone, { day: 'numeric' });
}

export function formatEventTime(
  date: Date,
  timeZone = CALENDAR_TIME_ZONE,
): string {
  return formatInTimeZone(date, timeZone, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatEventDateTimeShort(
  date: Date,
  timeZone = CALENDAR_TIME_ZONE,
): string {
  return formatInTimeZone(date, timeZone, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatEventDateLong(
  date: Date,
  timeZone = CALENDAR_TIME_ZONE,
): string {
  return formatInTimeZone(date, timeZone, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
