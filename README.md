# St John's Park Site

## Commands

- `npm install`
- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run content:cms:migrate`
- `npm run content:cms:decap-config`
- `npm run content:sheet-template` (legacy)
- `npm run content:sheet-validate` (legacy)

## Theme Switching

The site theme is controlled at build/runtime by `PUBLIC_SITE_THEME`.

- `current` (default)
- `garden-city`
- `line-drawing`

Local examples:

- `PUBLIC_SITE_THEME=current npm run dev`
- `PUBLIC_SITE_THEME=garden-city npm run dev`
- `PUBLIC_SITE_THEME=line-drawing npm run dev`

## Netlify Branch Previews

`netlify.toml` pins branch-specific preview themes:

- `codex/theme-garden-city` -> `garden-city`
- `codex/theme-line-drawing` -> `line-drawing`

Any other branch (including production/deploy previews) uses `current` unless overridden in Netlify UI.

## Content Editing (Primary): Decap CMS

Admins edit repo-backed content at `/admin`.

- CMS config: `/Users/almunday/SJP/public/admin/config.yml`
- Admin shell: `/Users/almunday/SJP/public/admin/index.html`
- Global content files: `/Users/almunday/SJP/src/content/cms/*.json`
- Page content files: `/Users/almunday/SJP/src/content/cms/pages/*.json`
- News posts: `/Users/almunday/SJP/src/content/news/*.md`
- Uploaded media: `/Users/almunday/SJP/public/images/uploads`

### Netlify + GitHub OAuth Setup

The site uses an external OAuth provider function for Decap:

- Function file: `/Users/almunday/SJP/netlify/functions/auth.ts`
- Function URL: `/.netlify/functions/auth`
- Callback URL: `/.netlify/functions/auth/callback`

Set these Netlify environment variables:

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `OAUTH_CALLBACK_URL` (recommended explicit value, e.g. `https://stjohnspark.church/.netlify/functions/auth/callback`)
- `OAUTH_ORIGIN` (optional override; defaults to site URL)

GitHub OAuth app callback must exactly match your callback URL.

## Content Source Switch

Content loading is controlled by `CONTENT_SOURCE`:

- `local` (default): reads split JSON files in `/Users/almunday/SJP/src/content/cms/`
- `api`: reads JSON from `CONTENT_API_URL`
- `sheets`: reads rows from a Google Sheets CSV export and reconstructs JSON by `path/type/value` (legacy fallback)

## Google Sheets Workflow (Legacy Fallback)

The Google Sheets tooling is still available for fallback/migration purposes:

- `npm run content:sheet-template`
- `npm run content:sheet-validate`

Reference docs:

- `/Users/almunday/SJP/docs/google-sheet-template/README.md`
