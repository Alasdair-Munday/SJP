import rss from '@astrojs/rss';
import { sermons } from '../data/sermons';
import content from '../data/content.json';

export async function GET(context: any) {
    return rss({
        title: `${content.site.title} Sermons`,
        description: content.site.subtitle,
        site: context.site || 'https://stjohnspark.church', // Fallback URL
        items: sermons.map((sermon) => ({
            title: sermon.title,
            pubDate: new Date(sermon.date),
            description: sermon.description,
            link: `/sermons/#${sermon.date}`, // Deep link to the sermon on the page (could be its own page)
            customData: `
        <enclosure url="${sermon.audioUrl}" length="${sermon.duration * 10000}" type="audio/mpeg" />
        <itunes:duration>${sermon.duration}</itunes:duration>
        <itunes:author>${sermon.speaker}</itunes:author>
        <itunes:summary>${sermon.description}</itunes:summary>
      `,
        })),
        customData: `<language>en-us</language>`,
    });
}
