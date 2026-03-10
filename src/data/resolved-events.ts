import { getSiteContent, type SiteEventOverrideImage } from "./site-content";
import {
  getUpcomingEvents,
  type CalendarEvent,
  type CalendarImageAttachment,
} from "../utils/calendar";

export interface ResolvedEventImage {
  src: string;
  thumbnailSrc: string;
  alt: string;
  fileName?: string;
  mimeType?: string;
  source: "cms" | "calendar";
}

export interface ResolvedCalendarEvent extends CalendarEvent {
  title: string;
  summary: string;
  descriptionHtml?: string;
  images: ResolvedEventImage[];
  thumbnailUrl?: string;
  source: "cms" | "calendar";
}

const stripHtml = (value: string) =>
  value
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const dateKey = (date: Date) => date.toISOString().slice(0, 10);

const mapCmsImages = (images: SiteEventOverrideImage[] | undefined): ResolvedEventImage[] =>
  (images || []).map((image) => ({
    src: image.src,
    thumbnailSrc: image.src,
    alt: image.alt,
    source: "cms",
  }));

const mapCalendarImages = (
  images: CalendarImageAttachment[],
  eventTitle: string,
): ResolvedEventImage[] =>
  images.map((image, index) => ({
    src: image.url,
    thumbnailSrc: image.thumbnailUrl || image.url,
    alt: image.fileName || `${eventTitle} image ${index + 1}`,
    fileName: image.fileName,
    mimeType: image.mimeType,
    source: "calendar",
  }));

const buildSummary = (event: CalendarEvent, descriptionHtml?: string) => {
  if (descriptionHtml) {
    return stripHtml(descriptionHtml);
  }

  if (event.description) {
    return stripHtml(event.description);
  }

  return "";
};

export async function resolveCalendarEvent(
  event: CalendarEvent,
): Promise<ResolvedCalendarEvent> {
  const content = await getSiteContent();
  const seriesByUid = new Map(
    content.event_overrides.series.map((override) => [override.uid, override]),
  );
  const occurrencesByUidAndDate = new Map(
    content.event_overrides.occurrences.map((override) => [
      `${override.uid}::${override.date}`,
      override,
    ]),
  );

  const seriesOverride = seriesByUid.get(event.uid);
  const occurrenceOverride = occurrencesByUidAndDate.get(
    `${event.uid}::${dateKey(event.start)}`,
  );

  const title = occurrenceOverride?.title || seriesOverride?.title || event.title;
  const descriptionHtml =
    occurrenceOverride?.description_html ||
    seriesOverride?.description_html ||
    event.descriptionHtml;
  const summary =
    occurrenceOverride?.summary ||
    seriesOverride?.summary ||
    buildSummary(event, descriptionHtml);
  const images = mapCmsImages(occurrenceOverride?.images?.length
    ? occurrenceOverride.images
    : seriesOverride?.images?.length
      ? seriesOverride.images
      : undefined);
  const resolvedImages =
    images.length > 0 ? images : mapCalendarImages(event.imageAttachments, title);

  return {
    ...event,
    title,
    summary,
    descriptionHtml,
    images: resolvedImages,
    thumbnailUrl: resolvedImages[0]?.thumbnailSrc,
    source: resolvedImages[0]?.source || "calendar",
  };
}

export async function getResolvedUpcomingEvents(
  limit = 3,
  filterDuplicates = false,
): Promise<ResolvedCalendarEvent[]> {
  const events = await getUpcomingEvents(limit, filterDuplicates);
  return Promise.all(events.map((event) => resolveCalendarEvent(event)));
}
