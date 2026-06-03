import rss from "@astrojs/rss";
import { getSiteConfig } from "../lib/content";
import { getTalks } from "../lib/talks";

export async function GET(context: { site?: string }) {
  const site = await getSiteConfig();
  const talks = await getTalks();
  const baseSite = context.site || site.siteUrl;

  return rss({
    title: `${site.shortTitle} Talks`,
    description: "Recent Sunday teaching from St John's Park.",
    site: baseSite,
    xmlns: {
      itunes: "http://www.itunes.com/dtds/podcast-1.0.dtd",
    },
    items: talks
      .filter((talk) => talk.audioUrl)
      .map((talk) => ({
        title: talk.title,
        pubDate: new Date(talk.date),
        description: talk.description,
        link: `/talks#latest-talk`,
        customData: `
          <enclosure url="${talk.audioUrl}" length="${talk.duration * 10000}" type="audio/mpeg" />
          <itunes:duration>${talk.duration}</itunes:duration>
          <itunes:author>${talk.speaker}</itunes:author>
          <itunes:summary>${talk.description}</itunes:summary>
        `,
      })),
    customData: "<language>en-gb</language>",
  });
}
