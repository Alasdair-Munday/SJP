import fallbackTalks from "../data/talks-fallback.json";

const DEFAULT_SERMONS_RSS_FEED_URL =
  "https://audio.com/rss/author/1864352901200967";
const AUDIO_COM_TITLE_PATTERN =
  /^(?<day>\d{2})\/(?<month>\d{2})\/(?<year>\d{2})\s*\/\/\s*(?<message>.+?)\s*\/\/\s*(?<speaker>.+)$/;

export type Talk = {
  title: string; speaker: string; date: string; series: string;
  passage: string; audioUrl: string; description: string; duration: number;
  imageUrl?: string; embedUrl?: string; sourceUrl?: string;
};
const AUDIO_COM_PROFILE_URL = "https://audio.com/stjohnsparksheffield";

const decodeXmlEntities = (value: string) =>
  value
    .replace(/&#(?:x([0-9a-f]+)|(\d+));/gi, (_, hex, decimal) =>
      String.fromCodePoint(Number.parseInt(hex || decimal, hex ? 16 : 10)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'");

const stripCdata = (value: string) =>
  value.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "");

const stripHtml = (value: string) =>
  decodeXmlEntities(stripCdata(value))
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getTagContent = (xml: string, tagName: string) => {
  const pattern = new RegExp(
    `<${escapeRegExp(tagName)}(?:\\s[^>]*)?>([\\s\\S]*?)</${escapeRegExp(tagName)}>`,
    "i",
  );

  return xml.match(pattern)?.[1]?.trim() ?? "";
};

const getTagAttribute = (xml: string, tagName: string, attributeName: string) => {
  const tagPattern = new RegExp(`<${escapeRegExp(tagName)}\\b([^>]*)\\/?>`, "i");
  const attributes = xml.match(tagPattern)?.[1] ?? "";
  const attributePattern = new RegExp(`${escapeRegExp(attributeName)}="([^"]*)"`, "i");

  return decodeXmlEntities(attributes.match(attributePattern)?.[1]?.trim() ?? "");
};

const toIsoDate = (value: string) => {
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  return parsedDate.toISOString().slice(0, 10);
};

const parseFeedTitle = (rawTitle: string, pubDate: string) => {
  const normalizedTitle = rawTitle.replace(/\s+/g, " ").trim();
  const match = normalizedTitle.match(AUDIO_COM_TITLE_PATTERN);

  if (!match?.groups) {
    return {
      date: toIsoDate(pubDate),
      title: normalizedTitle,
      speaker: "St John's Park",
      series: "Sunday Talks",
      description: normalizedTitle || "Sunday teaching from our church family.",
    };
  }

  const { day, month, year, message, speaker } = match.groups;
  const normalizedMessage = message.replace(/\s+/g, " ").trim();
  const series = normalizedMessage.includes(":")
    ? normalizedMessage.split(":")[0].trim()
    : "Sunday Talks";

  return {
    date: `20${year}-${month}-${day}`,
    title: normalizedMessage,
    speaker: speaker.replace(/\s+/g, " ").trim(),
    series,
    description:
      series && series !== normalizedMessage
        ? `Part of the ${series} series.`
        : "Sunday teaching from our church family.",
  };
};

const parseFeedItem = (itemXml: string, fallbackImageUrl = ""): Talk | null => {
  const title = stripHtml(getTagContent(itemXml, "title"));
  const pubDate = stripHtml(getTagContent(itemXml, "pubDate"));
  const summary =
    stripHtml(getTagContent(itemXml, "itunes:summary")) ||
    stripHtml(getTagContent(itemXml, "description"));
  const duration = Number.parseInt(
    stripHtml(getTagContent(itemXml, "itunes:duration")),
    10,
  );
  const audioUrl = getTagAttribute(itemXml, "enclosure", "url");
  const imageUrl =
    getTagAttribute(itemXml, "itunes:image", "href") ||
    getTagContent(itemXml, "itunes:image") ||
    getTagAttribute(itemXml, "media:thumbnail", "url") ||
    getTagAttribute(itemXml, "media:content", "url") ||
    fallbackImageUrl;

  if (!title || !audioUrl) {
    return null;
  }

  const parsedTitle = parseFeedTitle(title, pubDate);

  return {
    title: parsedTitle.title,
    speaker: parsedTitle.speaker,
    date: parsedTitle.date,
    series: parsedTitle.series,
    passage: "",
    audioUrl,
    imageUrl,
    description: summary || parsedTitle.description,
    duration: Number.isFinite(duration) ? duration : 0,
  };
};

const sortByDateDescending = (left: Talk, right: Talk) =>
  right.date.localeCompare(left.date) || left.title.localeCompare(right.title);

const getFeedImageUrl = (xml: string) => {
  const channelXml = getTagContent(xml, "channel") || xml;

  return (
    getTagAttribute(channelXml, "itunes:image", "href") ||
    getTagContent(getTagContent(channelXml, "image"), "url") ||
    getTagAttribute(channelXml, "media:thumbnail", "url") ||
    getTagAttribute(channelXml, "media:content", "url")
  );
};

export const parseFeed = (xml: string): Talk[] => {
  const feedImageUrl = getFeedImageUrl(xml);

  return Array.from(xml.matchAll(/<item\b[\s\S]*?<\/item>/gi))
    .map(([itemXml]) => parseFeedItem(itemXml, feedImageUrl))
    .filter((item): item is Talk => Boolean(item))
    .sort(sortByDateDescending);
};

export const getTalksRssFeedUrl = () =>
  import.meta.env.SERMONS_RSS_FEED_URL || DEFAULT_SERMONS_RSS_FEED_URL;

// Audio.com's RSS can be empty even while its public profile lists recordings.
// Keep only stable player IDs, never its short-lived signed MP3 URLs.
export const parseAudioComProfile = (html: string): Talk[] => {
  const store = html.match(/<div\b[^>]*class="js-store"[^>]*data-content="([^"]+)"/i)?.[1];
  if (!store) throw new Error("Audio.com profile data was not found.");
  const data = JSON.parse(decodeXmlEntities(store)).screen?.data;
  if (data?.author?.id !== "1864352901200967") throw new Error("Unexpected Audio.com author.");
  const items = data.audio?.items;
  if (!Array.isArray(items)) throw new Error("Audio.com recordings were not found.");
  return items.flatMap((item): Talk[] => {
    if (!/^\d+$/.test(item.id) || item.user !== data.author.id || !item.listed || !item.title || !item.play) return [];
    const title = stripHtml(item.title);
    const match = title.match(/^(\d{2})[/-](\d{2})[/-](\d{4})\s+(.+?)\s+-\s+([^-]+)$/);
    const uploadedDate = toIsoDate(new Date(item.created * 1000).toISOString());
    const titleDate = match ? `${match[3]}-${match[2]}-${match[1]}` : "";
    const date = titleDate && titleDate <= uploadedDate ? titleDate : uploadedDate;
    const sourceUrl = `${AUDIO_COM_PROFILE_URL}/audio/${encodeURIComponent(item.slug)}`;
    return [{
      title: match ? match[4].trim() : title,
      speaker: match ? match[5].trim() : "St John's Park",
      date, series: "Sunday Talks", passage: "", audioUrl: "",
      embedUrl: `https://audio.com/embed/audio/${item.id}`,
      sourceUrl, imageUrl: item.image || item.avatar || "",
      description: stripHtml(item.description || "") || "Sunday teaching from our church family.",
      duration: Math.round((Number(item.play.duration) || 0) / 1000),
    }];
  }).sort(sortByDateDescending);
};

let cachedTalksPromise: Promise<Talk[]> | null = null;
let cacheExpiresAt = 0;

export async function getTalks(): Promise<Talk[]> {
  if (!cachedTalksPromise || Date.now() >= cacheExpiresAt) {
    cacheExpiresAt = Date.now() + 5 * 60 * 1000;
    cachedTalksPromise = (async () => {
      const feedUrl = getTalksRssFeedUrl();
      try {
        const response = await fetch(feedUrl, {
          headers: { Accept: "application/rss+xml, application/xml, text/xml;q=0.9" },
          signal: AbortSignal.timeout(8000),
        });
        if (!response.ok) throw new Error(`Feed request failed: ${response.status}`);
        const items = parseFeed(await response.text());
        if (!items.length) throw new Error("Feed returned no talk items.");
        return items;
      } catch (error) {
        console.warn("[talks] RSS unavailable; trying the public Audio.com profile.", error);
      }
      // Only use this author's profile for the default feed, not a custom source.
      if (feedUrl === DEFAULT_SERMONS_RSS_FEED_URL) {
        try {
          const response = await fetch(AUDIO_COM_PROFILE_URL, { signal: AbortSignal.timeout(8000) });
          if (!response.ok) throw new Error(`Profile request failed: ${response.status}`);
          const items = parseAudioComProfile(await response.text());
          if (!items.length) throw new Error("Profile returned no recordings.");
          return items;
        } catch (error) {
          console.warn("[talks] Using saved recordings because Audio.com is unavailable.", error);
        }
      }
      return fallbackTalks.items;
    })();
  }
  return cachedTalksPromise;
}
