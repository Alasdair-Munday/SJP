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

Set `PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN` to the site token from Cloudflare Web
Analytics to load its privacy-first beacon in production. Leave it unset locally.

## Facebook and Instagram workflow

The weekly review page is `/newsletter/social/`. Choose any date and it prepares
the Tuesday people/story, Thursday explore-faith and Saturday Sunday-invitation
slots for that calendar week. Each card has short Canva text, Facebook and
Instagram captions, the authoritative website link, copy buttons and a final
checklist. Calendar details come from the same public Google Calendar used by the
site and newsletter.

The zero-budget administrator routine is:

1. Open the review page from the printable newsletter.
2. Check facts, consent and the linked website page.
3. Open the relevant Canva starter, make a copy, replace the text/photo, and keep
   the Brand Kit styles.
4. Use Canva Content Planner to schedule the finished design and caption for both
   Facebook and Instagram.
5. Check both platform previews, then mark the design as scheduled in Canva.

The Canva workspace is [SJP Social Media](https://www.canva.com/folder/FAHVpElMjv8).
It contains numbered folders for starters, current work, scheduled work, the
published archive and approved media. The existing Baptisms and Pre-Sunday brand
templates are the safe starting points; a 1080×1920 story version is also in the
Brand Templates folder.

In CMS → Global Settings → Social Media, add the exact Facebook and Instagram
profile URLs, maintain the Canva links and update the consent guidance. Social
links appear in the website and newsletter footers only after these URLs are set.

For a website post to be offered in the Tuesday slot, turn on **Available for
Social Media** and **Photo Consent Confirmed**. Add an optional caption or social
image override, and use **Do Not Use on Social After** when consent or relevance
expires. The system deliberately shows an administrator prompt instead of using
an unapproved story. For children or vulnerable people, follow the safeguarding
process and do not use the CMS checkbox as a substitute for recorded consent.

## Google Calendar and “This week”

Google Calendar owns dates, times, locations and cancellations. The website owns
activity descriptions. The homepage, printable newsletter and email newsletter
share one calendar service. The agenda covers **today plus the next six days** in
Europe/London, including every public event and any overlapping multi-day events.

### Managing regular events

Google Calendar owns public dates, times, locations and cancellations. Site Admin
owns the information pages for regular activities and the wording on the
**What’s on** page.

To add a new regular activity:

1. In Site Admin, open **Regular Events**, create its page and submit it for
   review. The page address is `https://stjohnspark.org/events/<page-name>`.
2. When the page is published, create or update its recurring entry in the
   Public Events Google Calendar and add a separate line to its description:

```text
Website: https://stjohnspark.org/events/<page-name>
```

The calendar link connects the timetable entry to its information page and lets
that page display its next date. Google’s formatted links are supported. Edit the
entire series for a recurring activity, and retain the Website line when using
“this and following” to split it. A changed occurrence inherits the master link
unless it supplies its own Website line. Missing or invalid links do not hide
events from the agenda; they simply appear without a website link.

To cancel one date, delete **this event only** in Google Calendar. To stop an
activity from a given date, delete **this and following**; deleting the whole
series removes all its dates. The timetable and newsletters update on the next
calendar refresh.

In Site Admin → **What’s on Page**, editors can change the title and introduction
and optionally choose a manually ordered list of featured events. The rest appear
automatically by their next date, then alphabetically when no date is scheduled.

These links were added to the public calendar series on 19 September 2026:

| Calendar series | Website destination |
| --- | --- |
| Foodbank | `https://stjohnspark.org/events/foodbank` |
| Lunch Club | `https://stjohnspark.org/events/lunch-club` |
| Cornerstone | `https://stjohnspark.org/events/cornerstone` |
| Sunday Service / St John's Holy Communion | `https://stjohnspark.org/events/sunday-service` |
| Simplicity: Traditional Holy Communion | `https://stjohnspark.org/events/simplicity` |
| Morning Prayers | `https://stjohnspark.org/events/morning-prayers` |
| Midweek Communion, Lunch & Bible Study | `https://stjohnspark.org/events/midweek-communion` |

Each public recurring event has its own `/events/…` page, which displays the next date from the calendar. Building bookings and private prayer gatherings are kept off the public calendar.
They show the next two upcoming sessions within six months. Add descriptions on the
site, and use the calendar for exact times. For a news-post destination, use
`https://stjohnspark.org/news/POST-SLUG`; matching posts automatically show dates.
Only existing site paths and registered section/card anchors are accepted. Avoid
changing an anchor without also updating calendar links.

Tentative special Christmas events are not entered until their dates are confirmed.
The general Community Hub is also omitted because the site does not give a complete
start and end time. Morning Prayers remains visible in the agenda without
a website destination; its existing description includes the online joining details.

### Newsletter issue dates

Choose an issue date at `/newsletter/` or `/newsletter/email/`. The `?date=YYYY-MM-DD`
parameter carries through print, email preview and raw HTML export. All three
views use the same seven-day agenda. Recent news looks back seven calendar days
through the issue date; explicit newsletter expiry dates and upcoming event
announcements remain supported. Posts published after the issue date are excluded.
These are current previews, not archived snapshots of previously issued newsletters.

### Refresh and failure behaviour

`netlify/functions/calendar-refresh.mts` refreshes every five minutes on published
Netlify deploys. It validates the complete ICS feed and its next six months before
saving a site-scoped Netlify Blobs snapshot. First requests can also populate or
refresh the snapshot. No Google Cloud project, API key or OAuth token is required.
The public feed URL defaults to the church calendar; override with
`PUBLIC_CALENDAR_ICS_URL` in Netlify (Functions scope, and Build scope for Astro).
Google's own feed publishing may delay changes beyond the polling interval.

The homepage, Visit, Community, Park Youth, news detail pages and newsletter exports
render on the server with `Cache-Control: no-store`. Other pages remain static.
If adding calendar blocks to another static page, give it an on-demand route as
for Visit, and exclude that route from the static `[slug]` route's paths.

On a failed refresh, the last successful snapshot is shown with a warning and its
verification time. After 24 hours without successful verification, dates are hidden
and an unavailable message is shown. A valid empty calendar is an empty schedule,
not an error. Cancelled/removed events disappear after the next successful refresh.
Failures and expansion limits are logged with a `[calendar]` prefix. Scheduled
refresh failures are surfaced as failed function invocations in Netlify.

Plain Astro development uses an in-memory fallback if Blobs is unavailable. The
Netlify adapter/dev environment may supply its own isolated local Blobs store.
Production snapshots are not committed to the repository and are never generated
into CMS content files. There is no build-time fallback to old event JSON.

### Checks and deployment

```sh
npm test
npm run check
npm run build
npm run calendar:check
# Optional reproducible diagnostic from a local ICS file:
npm run calendar:check -- --file calendar_debug.ics --date 2026-09-19
# With the local site running and network access:
CALENDAR_TEST_BASE_URL=http://127.0.0.1:4321 npm test
```

The diagnostic is read-only. It reports unresolved calendar links, page blocks
without matching dates, and freshness. Exit codes: 0 = all linked, 1 = fetch/parse
failure, 2 = unresolved links or unmatched blocks. Unlinked public events are valid
for display, so code 2 is an editorial report rather than a build failure.

After deploying, confirm `calendar-refresh` appears as a scheduled function, verify
one successful invocation, and open the homepage, activity pages and both newsletter
formats. Check that the first snapshot persists across a deploy. Verify a calendar
edit appears after the next successful refresh. A preview deploy does not run the
schedule; requests still refresh the snapshot as needed. Production scheduling and
cross-deploy persistence require verification on the deployed Netlify site.
