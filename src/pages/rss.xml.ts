import rss from "@astrojs/rss";
import { getSiteConfig } from "../lib/content";
import { getTalks, talkAnchorId } from "../lib/talks";

export const prerender = false;

export async function GET(context: { site?: string }) {
  const site = await getSiteConfig();
  const talks = await getTalks();
  const baseSite = String(context.site || site.siteUrl).replace(/\/$/, "");
  const coverArtSource = talks.find((talk) => talk.imageUrl)?.imageUrl || "/images/podcast-cover.png";
  const coverArt = new URL(coverArtSource, baseSite).toString();
  const escapeXml = (value: string) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  const formatItunesDuration = (durationInSeconds: number) => {
    const totalSeconds = Math.max(0, Math.round(durationInSeconds));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return [hours, minutes, seconds]
      .map((value) => String(value).padStart(2, "0"))
      .join(":");
  };

  return rss({
    title: `${site.shortTitle} Talks`,
    description: "Recent Sunday teaching from St John's Park.",
    site: baseSite,
    trailingSlash: false,
    xmlns: {
      itunes: "http://www.itunes.com/dtds/podcast-1.0.dtd",
    },
    items: talks
      .filter((talk) => talk.audioUrl)
      .map((talk) => ({
          title: talk.title,
          pubDate: new Date(talk.date),
          description: talk.description,
          link: `/talks#${talkAnchorId(talk)}`,
          enclosure: {
            url: talk.audioUrl,
            length: 0,
            type: talk.audioType || "audio/mpeg",
          },
          customData: `
            <itunes:duration>${formatItunesDuration(talk.duration)}</itunes:duration>
            <itunes:author>${escapeXml(talk.speaker)}</itunes:author>
            <itunes:summary>${escapeXml(talk.description)}</itunes:summary>
          `,
        })),
    customData: `
      <language>en-gb</language>
      <author>${escapeXml(site.contact.email)}</author>
      <itunes:author>${escapeXml(site.title)}</itunes:author>
      <itunes:owner>
        <itunes:name>${escapeXml(site.title)}</itunes:name>
        <itunes:email>${escapeXml(site.contact.email)}</itunes:email>
      </itunes:owner>
      <itunes:image href="${escapeXml(coverArt)}" />
      <image>
        <url>${escapeXml(coverArt)}</url>
        <title>${escapeXml(`${site.shortTitle} Talks`)}</title>
        <link>${escapeXml(baseSite)}</link>
      </image>
    `,
  });
}
