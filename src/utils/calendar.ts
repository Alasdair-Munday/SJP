import ICAL from 'ical.js';

const DEFAULT_CALENDAR_URL =
  "https://calendar.google.com/calendar/ical/c_b253bc81383f7876a658ad71f516be079528043a755a7c79713cd2c4529b1a26%40group.calendar.google.com/public/basic.ics";

export const CALENDAR_URL = import.meta.env.PUBLIC_CALENDAR_ICS_URL || DEFAULT_CALENDAR_URL;

export interface CalendarEvent {
  title: string;
  start: Date;
  end: Date;
  location?: string;
  description?: string;
  thumbnailUrl?: string;
}

function getDriveFileId(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes('drive.google.com')) return undefined;

    const directId = parsed.searchParams.get('id');
    if (directId) return directId;

    const filePathMatch = parsed.pathname.match(/\/file\/d\/([^/]+)/);
    if (filePathMatch?.[1]) return filePathMatch[1];

    return undefined;
  } catch {
    return undefined;
  }
}

function toThumbnailUrl(url: string): string {
  const driveId = getDriveFileId(url);
  if (!driveId) return url;
  // Public Drive images render more reliably via thumbnail endpoint.
  return `https://drive.google.com/thumbnail?id=${driveId}&sz=w1200`;
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

function getFirstImageAttachmentUrl(component: any): string | undefined {
  if (!component?.getAllProperties) return undefined;

  const attachments = component.getAllProperties('attach') || [];
  for (const attach of attachments) {
    const raw = attach.getFirstValue?.();
    if (typeof raw !== 'string' || !raw.trim()) continue;
    if (!looksLikeImageAttachment(attach, raw)) continue;
    return toThumbnailUrl(raw.trim());
  }

  return undefined;
}

async function getExpandedEventsBetween(
  rangeStart: Date,
  rangeEnd: Date,
  recurringPerEventLimit = 120
): Promise<CalendarEvent[]> {
  try {
    const response = await fetch(CALENDAR_URL);
    if (!response.ok) {
      console.error('Failed to fetch calendar');
      return [];
    }
    const data = await response.text();
    const jcalData = ICAL.parse(data);
    const comp = new ICAL.Component(jcalData);
    const vevents = comp.getAllSubcomponents('vevent');

    const upcoming: CalendarEvent[] = [];

    for (const vevent of vevents) {
      const event = new ICAL.Event(vevent);

      if (!event.isRecurring()) {
        const start = event.startDate.toJSDate();
        if (start >= rangeStart && start <= rangeEnd) {
          upcoming.push({
            title: event.summary || 'Untitled event',
            start,
            end: event.endDate.toJSDate(),
            location: event.location,
            description: event.description,
            thumbnailUrl: getFirstImageAttachmentUrl(vevent)
          });
        }
        continue;
      }

      // Expand recurring events so weekly/monthly church events appear as upcoming.
      const iterator = event.iterator(ICAL.Time.fromJSDate(rangeStart, true));
      let count = 0;
      let next: ICAL.Time | null;

      while ((next = iterator.next())) {
        const occurrence = event.getOccurrenceDetails(next);
        const start = occurrence.startDate.toJSDate();
        if (start > rangeEnd) break;

        upcoming.push({
          title: event.summary || 'Untitled event',
          start,
          end: occurrence.endDate.toJSDate(),
          location: occurrence.item?.location || event.location,
          description: occurrence.item?.description || event.description,
          thumbnailUrl:
            getFirstImageAttachmentUrl(occurrence.item?.component) ||
            getFirstImageAttachmentUrl(vevent)
        });

        count += 1;
        if (count >= recurringPerEventLimit) break;
      }
    }

    return upcoming.sort((a, b) => a.start.getTime() - b.start.getTime());
  } catch (e) {
    console.error('Error parsing calendar:', e);
    return [];
  }
}

export async function getUpcomingEvents(limit = 3, filterDuplicates = false): Promise<CalendarEvent[]> {
  const now = new Date();
  const horizon = new Date(now.getTime() + 366 * 24 * 60 * 60 * 1000);
  const events = await getExpandedEventsBetween(now, horizon, Math.max(limit * 6, 20));

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
  const end = new Date(now.getFullYear(), now.getMonth() + months, 0, 23, 59, 59, 999);
  return getExpandedEventsBetween(now, end, 200);
}
