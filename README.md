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

## Editing in the CMS

Open `/admin/` to edit content through Decap CMS. Publishing changes updates
`main` and triggers a Netlify production build.

- **Pages → Home Page:** edit the hero's Title Image and Bold Words, the
  Belong/Serve/Give cards, and the News section's background tone.
- **Pages → Get Involved Page:** edit the Celebrate and Will you partner with us?
  sections. The giving section keeps its anchor when saved.
- **News & Events:** edit the title, summary, full Markdown body, featured image,
  and buttons. The same content feeds the article page, print newsletter and
  email export. Use Display on Newsletter and Display Until to control inclusion;
  events use Event Date and the optional Event End Date.

## Newsletter Email Export

- Review the printable newsletter at `/newsletter/`.
- Open `/newsletter/email/` to preview and copy the email-safe HTML.
- Use `/newsletter/email/raw/` if an email platform can import a raw HTML URL.
- Paste the copied HTML into the email platform and send a test email before
  sending to the full list. Recipient lists, unsubscribe handling, and delivery
  remain managed by the email platform.

## Deployment

The site builds with Astro and deploys with the Netlify adapter. Set
`SERMONS_RSS_FEED_URL` in Netlify to override the default talks feed.
