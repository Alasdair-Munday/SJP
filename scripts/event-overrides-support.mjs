import ICAL from "ical.js";

const DEFAULT_CALENDAR_URL =
  "https://calendar.google.com/calendar/ical/c_b253bc81383f7876a658ad71f516be079528043a755a7c79713cd2c4529b1a26%40group.calendar.google.com/public/basic.ics";
const DEFAULT_CALENDAR_TIME_ZONE = "Europe/London";

export const CALENDAR_URL =
  process.env.PUBLIC_CALENDAR_ICS_URL || DEFAULT_CALENDAR_URL;
export const CALENDAR_TIME_ZONE =
  process.env.PUBLIC_CALENDAR_TIME_ZONE || DEFAULT_CALENDAR_TIME_ZONE;

export const slugify = (value) =>
  (
    value
      .toLowerCase()
      .replace(/[\u2018\u2019']/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 80) || "event"
  );

const normalizeUid = (uid) =>
  (
    uid
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "uid"
  );

const buildEventSlug = (title, start, uid) => {
  const startKey = start
    .toISOString()
    .slice(0, 16)
    .replace(/[:-]/g, "")
    .replace("T", "-");
  const uidKey = normalizeUid(uid).slice(0, 24);
  return `${slugify(title)}-${startKey}-${uidKey}`;
};

const getDriveFileId = (url) => {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes("drive.google.com")) return undefined;

    const directId = parsed.searchParams.get("id");
    if (directId) return directId;

    const filePathMatch = parsed.pathname.match(/\/file\/d\/([^/]+)/);
    if (filePathMatch?.[1]) return filePathMatch[1];

    const genericMatch = parsed.pathname.match(/\/d\/([^/]+)/);
    if (genericMatch?.[1]) return genericMatch[1];

    return undefined;
  } catch {
    return undefined;
  }
};

const toDriveImage = (url, width) => {
  const driveId = getDriveFileId(url);
  if (!driveId) return url;
  return `https://drive.google.com/thumbnail?id=${driveId}&sz=w${width}`;
};

const looksLikeImageAttachment = (prop, attachValue) => {
  const formatType = String(prop.getParameter?.("fmttype") || "").toLowerCase();
  const fileName = String(prop.getParameter?.("filename") || "").toLowerCase();
  const imageExtPattern = /\.(avif|bmp|gif|heic|jpeg|jpg|png|svg|webp)(\?|$)/i;

  return (
    formatType.startsWith("image/") ||
    imageExtPattern.test(fileName) ||
    imageExtPattern.test(attachValue)
  );
};

const getImageAttachments = (component) => {
  if (!component?.getAllProperties) return [];

  const attachments = component.getAllProperties("attach") || [];
  const imageAttachments = [];

  for (const attachment of attachments) {
    const rawValue = attachment.getFirstValue?.();
    if (typeof rawValue !== "string" || !rawValue.trim()) continue;

    const value = rawValue.trim();
    if (!looksLikeImageAttachment(attachment, value)) continue;

    imageAttachments.push({
      url: toDriveImage(value, 2200),
      thumbnailUrl: toDriveImage(value, 900),
      fileName: String(attachment.getParameter?.("filename") || ""),
      mimeType: String(attachment.getParameter?.("fmttype") || ""),
    });
  }

  return imageAttachments;
};

const escapeHtml = (value) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const sanitizeRichHtml = (value) =>
  value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<(iframe|object|embed|link|meta)[\s\S]*?>[\s\S]*?<\/(iframe|object|embed|link|meta)>/gi, "")
    .replace(/<(iframe|object|embed|link|meta)[^>]*\/?\s*>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*"[^"]*"/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*'[^']*'/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*[^\s>]+/gi, "")
    .replace(/(href|src)\s*=\s*"\s*javascript:[^"]*"/gi, '$1="#"')
    .replace(/(href|src)\s*=\s*'\s*javascript:[^']*'/gi, "$1='#'");

export const descriptionToHtml = (description) => {
  if (!description) return undefined;

  const normalized = description.replace(/\r\n/g, "\n").trim();
  if (!normalized) return undefined;

  const hasHtml = /<\/?[a-z][\s\S]*?>/i.test(normalized);
  if (hasHtml) return sanitizeRichHtml(normalized);

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`)
    .join("");

  return paragraphs;
};

export const stripHtml = (value) =>
  value
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const resolveTimeZone = (startDate) => {
  const tzid = String(startDate?.zone?.tzid || "");
  if (!tzid || tzid === "floating" || tzid === "local") {
    return CALENDAR_TIME_ZONE;
  }

  return tzid;
};

const buildEventRecord = ({
  uid,
  title,
  startDate,
  endDate,
  location,
  description,
  imageAttachments,
}) => {
  const start = startDate.toJSDate();
  const normalizedUid = uid || `uid-${title}`;

  return {
    id: `${normalizedUid}::${start.toISOString()}`,
    uid: normalizedUid,
    slug: buildEventSlug(title, start, normalizedUid),
    title: title || "Untitled event",
    start,
    end: endDate.toJSDate(),
    timeZone: resolveTimeZone(startDate),
    location,
    description,
    descriptionHtml: descriptionToHtml(description),
    thumbnailUrl: imageAttachments[0]?.thumbnailUrl,
    imageAttachments,
  };
};

const fetchCalendarText = async () => {
  const response = await fetch(CALENDAR_URL);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch calendar feed: ${response.status} ${response.statusText}`,
    );
  }

  return response.text();
};

export async function getUpcomingCalendarEvents(limit = 180) {
  const calendarText = await fetchCalendarText();
  const jcalData = ICAL.parse(calendarText);
  const comp = new ICAL.Component(jcalData);
  const vevents = comp.getAllSubcomponents("vevent");
  const now = new Date();
  const rangeEnd = new Date(now.getTime() + 366 * 24 * 60 * 60 * 1000);
  const recurringPerEventLimit = Math.max(limit * 8, 24);
  const upcoming = [];

  for (const vevent of vevents) {
    const event = new ICAL.Event(vevent);
    const baseImages = getImageAttachments(vevent);
    const uid = event.uid || "";
    const title = event.summary || "Untitled event";

    if (!event.isRecurring()) {
      const startDate = event.startDate;
      const start = startDate.toJSDate();
      if (start >= now && start <= rangeEnd) {
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

    const iterator = event.iterator(event.startDate.clone());
    let matches = 0;
    let safetyCounter = 0;
    let next;

    while ((next = iterator.next())) {
      safetyCounter += 1;
      if (safetyCounter > 5000) break;

      const occurrence = event.getOccurrenceDetails(next);
      const start = occurrence.startDate.toJSDate();

      if (start < now) {
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

  const uniqueById = new Map();
  for (const item of upcoming) {
    if (!uniqueById.has(item.id)) {
      uniqueById.set(item.id, item);
    }
  }

  return Array.from(uniqueById.values())
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .slice(0, limit);
}
