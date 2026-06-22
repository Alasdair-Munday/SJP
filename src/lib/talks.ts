import fallbackTalks from "../data/talks-fallback.json";

const DEFAULT_SERMONS_RSS_FEED_URL =
  "https://audio.com/rss/author/1864352901200967";
const AUDIO_COM_TITLE_PATTERN =
  /^(?<day>\d{2})\/(?<month>\d{2})\/(?<year>\d{2})\s*\/\/\s*(?<message>.+?)\s*\/\/\s*(?<speaker>.+)$/;

export type Talk = (typeof fallbackTalks.items)[number] & {
  imageUrl?: string;
};

const decodeXmlEntities = (value: string) =>
  value
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

const parseFeed = (xml: string): Talk[] => {
  const feedImageUrl = getFeedImageUrl(xml);

  return Array.from(xml.matchAll(/<item\b[\s\S]*?<\/item>/gi))
    .map(([itemXml]) => parseFeedItem(itemXml, feedImageUrl))
    .filter((item): item is Talk => Boolean(item))
    .sort(sortByDateDescending);
};

export const getTalksRssFeedUrl = () =>
  import.meta.env.SERMONS_RSS_FEED_URL || DEFAULT_SERMONS_RSS_FEED_URL;

let cachedTalksPromise: Promise<Talk[]> | null = null;

export async function getTalks(): Promise<Talk[]> {
  if (!cachedTalksPromise) {
    cachedTalksPromise = (async () => {
      const feedUrl = getTalksRssFeedUrl();

      if (!feedUrl) {
        return fallbackTalks.items;
      }

      try {
        const response = await fetch(feedUrl, {
          headers: {
            Accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
          },
        });

        if (!response.ok) {
          throw new Error(`Feed request failed: ${response.status} ${response.statusText}`);
        }

        const feedItems = parseFeed(await response.text());

        if (feedItems.length === 0) {
          throw new Error("Feed returned no talk items.");
        }

        return feedItems;
      } catch (error) {
        console.warn(
          `[talks] Falling back to local talk content because the RSS feed could not be loaded from ${feedUrl}.`,
          error,
        );
        return fallbackTalks.items;
      }
    })();
  }

  return cachedTalksPromise;
}
