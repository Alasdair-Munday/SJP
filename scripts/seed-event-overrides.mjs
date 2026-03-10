import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  descriptionToHtml,
  getUpcomingCalendarEvents,
  slugify,
  stripHtml,
} from "./event-overrides-support.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const overridesPath = path.join(repoRoot, "src", "content", "cms", "event_overrides.json");
const uploadsRoot = path.join(repoRoot, "public", "images", "uploads", "events");

const readJson = async (filePath) =>
  JSON.parse(await fs.readFile(filePath, "utf8"));

const summarizeDescription = (event) => {
  const raw = stripHtml(event.descriptionHtml || event.description || "");
  if (!raw) return "More details for this event will be added soon.";
  return raw.length > 220 ? `${raw.slice(0, 217).trimEnd()}...` : raw;
};

const extensionForContentType = (contentType) => {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("gif")) return "gif";
  if (contentType.includes("svg")) return "svg";
  return "jpg";
};

const sanitizeFileStem = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const downloadEventImage = async (event, image, index) => {
  const response = await fetch(image.url);
  if (!response.ok) {
    throw new Error(
      `Failed to download event image for ${event.title}: ${response.status} ${response.statusText}`,
    );
  }

  const contentType = response.headers.get("content-type") || image.mimeType || "image/jpeg";
  const extension = extensionForContentType(contentType.toLowerCase());
  const uidStem = sanitizeFileStem(event.uid).slice(0, 18) || "event";
  const fileName = `${slugify(event.title)}-${uidStem}-${index + 1}.${extension}`;
  const targetPath = path.join(uploadsRoot, fileName);

  await fs.mkdir(uploadsRoot, { recursive: true });
  await fs.writeFile(targetPath, Buffer.from(await response.arrayBuffer()));

  return {
    src: `/images/uploads/events/${fileName}`,
    alt: `${event.title} event image ${index + 1}`,
  };
};

const existing = await readJson(overridesPath);
const existingSeriesByUid = new Map(existing.series.map((entry) => [entry.uid, entry]));
const uniqueUpcomingEvents = [];
const seenUids = new Set();

for (const event of await getUpcomingCalendarEvents(180)) {
  if (seenUids.has(event.uid)) continue;
  seenUids.add(event.uid);
  uniqueUpcomingEvents.push(event);
}

for (const event of uniqueUpcomingEvents) {
  if (existingSeriesByUid.has(event.uid)) continue;

  const images = [];
  for (const [index, image] of event.imageAttachments.entries()) {
    try {
      images.push(await downloadEventImage(event, image, index));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(message);
      break;
    }
  }

  existing.series.push({
    uid: event.uid,
    title: event.title,
    summary: summarizeDescription(event),
    description_html:
      event.descriptionHtml ||
      descriptionToHtml(event.description) ||
      "<p>More details for this event will be added soon.</p>",
    images,
  });
}

existing.series.sort((a, b) => a.title.localeCompare(b.title));
await fs.writeFile(overridesPath, `${JSON.stringify(existing, null, 2)}\n`);

console.log(
  `Seeded event overrides for ${uniqueUpcomingEvents.length} event series (${existing.series.length} total records).`,
);
