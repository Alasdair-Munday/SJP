import rss from "@astrojs/rss";
import { getSiteConfig } from "../lib/content";
import { getTalks } from "../lib/talks";

export const prerender = false;

export async function GET(context: { site?: string }) {
  const site = await getSiteConfig();
  const talks = await getTalks();
  const baseSite = context.site || site.siteUrl;
  const escapeXml = (value: string) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");

  return rss({
    title: `${site.shortTitle} Talks`,
    description: "Recent Sunday teaching from St John's Park.",
    site: baseSite,
    xmlns: {
      itunes: "http://www.itunes.com/dtds/podcast-1.0.dtd",
    },
    items: talks
      .filter((talk) => talk.audioUrl)
      .map((talk) => {
        const audioUrl = new URL(talk.audioUrl, baseSite).href;
        return {
          title: talk.title,
          pubDate: new Date(talk.date),
          description: talk.description,
          link: `/talks#latest-talk`,
          customData: `
            <guid isPermaLink="false">${escapeXml(talk.id || audioUrl)}</guid>
            <enclosure url="${escapeXml(audioUrl)}" length="0" type="${escapeXml(talk.audioType || "audio/mpeg")}" />
            <itunes:duration>${talk.duration}</itunes:duration>
            <itunes:author>${escapeXml(talk.speaker)}</itunes:author>
            <itunes:summary>${escapeXml(talk.description)}</itunes:summary>
          `,
        };
      }),
    customData: "<language>en-gb</language>",
  });
}
