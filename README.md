# St John's Park Site

## Commands

- `npm install`
- `npm run dev`
- `npm run build`
- `npm run preview`

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

## Content Source Switch

Content loading is controlled by `CONTENT_SOURCE`:

- `local` (default): reads `/Users/almunday/SJP/src/data/content.json`
- `api`: reads JSON from `CONTENT_API_URL`
- `sheets`: reads rows from Google Sheets API and reconstructs JSON by `path/type/value`

### Google Sheets Mode

Required env vars for `CONTENT_SOURCE=sheets`:

- `GOOGLE_SHEETS_SPREADSHEET_ID` (or `GOOGLE_SHEETS_ID`)
- `GOOGLE_SHEETS_API_KEY` (for public sheet) or `GOOGLE_SHEETS_ACCESS_TOKEN` (for private sheet)

Optional:

- `GOOGLE_SHEETS_RANGE` (default: `content!A:G`)

### CSV Template for Admins

Generate the Google Sheets import CSV from the current JSON:

- `npm run content:sheet-template`

Output files:

- `/Users/almunday/SJP/docs/google-sheet-template/admin-content.csv`
- `/Users/almunday/SJP/docs/google-sheet-template/content.csv`
