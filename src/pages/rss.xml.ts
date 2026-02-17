import rss from '@astrojs/rss';
import { getSiteContent } from '../data/site-content';

export async function GET(context: any) {
    const content = await getSiteContent();
    const sermons = content.sermons;

    return rss({
        title: `${content.site.title} Sermons`,
        description: content.site.subtitle,
        site: context.site || 'https://stjohnspark.church', // Fallback URL
        xmlns: {
            itunes: 'http://www.itunes.com/dtds/podcast-1.0.dtd',
        },
        items: sermons
            .filter((sermon) => sermon.audioUrl)
            .map((sermon) => ({
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
