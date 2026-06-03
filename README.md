# St John's Park Site

## Commands

- `npm install`
- `npm run dev`
- `npm run build`
- `npm run preview`

## Content

The redesigned site uses Astro content collections:

- Site settings: `src/content/site/global.json`
- Page content: `src/content/pages/*.json`
- News posts: `src/content/posts/*.md`
- Local talks fallback: `src/data/talks-fallback.json`
- Uploaded media: `public/images/uploads`

Talk entries are sourced at build time from `SERMONS_RSS_FEED_URL`, which
defaults to `https://audio.com/rss/author/1864352901200967`. If the feed cannot
be loaded during the build, the site falls back to `src/data/talks-fallback.json`.

## Deployment

The site builds with Astro and deploys with the Netlify adapter. Set
`SERMONS_RSS_FEED_URL` in Netlify to override the default talks feed.
