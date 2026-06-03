import rss from '@astrojs/rss';
import { getSiteConfig, getNewsletterPostsForWeek } from '../../lib/content';
import type { APIRoute } from 'astro';

export const GET: APIRoute = async (context) => {
  const site = await getSiteConfig();
  const posts = await getNewsletterPostsForWeek();

  return rss({
    title: `${site.shortTitle} - Weekly Newsletter`,
    description: 'Weekly news and updates from St James Park',
    site: context.site || site.siteUrl,
    items: posts.map((post) => ({
      title: post.data.title,
      pubDate: post.data.publishDate,
      description: post.data.summary,
      link: `/news/${post.slug}/`,
    })),
    customData: `<language>en-gb</language>`,
  });
};
