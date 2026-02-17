# St John's Park Site

## Commands

- `npm install`
- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run content:sheet-template`
- `npm run content:sheet-validate`

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
- `sheets`: reads rows from a Google Sheets CSV export and reconstructs JSON by `path/type/value`

### Google Sheets Mode

Default behavior for `CONTENT_SOURCE=sheets`:

- Reads from spreadsheet `1Ay1kS_--qmW9x0gSi5zSUQvkdQoeiGVQvu30PY6XUxM`, tab `content`
- Uses CSV export URL format (`/export?format=csv`)
- No Google Cloud API key or access token is required

Optional:

- `GOOGLE_SHEETS_CSV_URL` (or `CONTENT_CSV_URL`) to provide a full CSV URL directly
- `GOOGLE_SHEETS_SPREADSHEET_ID` (or `GOOGLE_SHEETS_ID`) to override the default spreadsheet ID
- `GOOGLE_SHEETS_GID` to target a specific sheet tab by gid when not using `GOOGLE_SHEETS_CSV_URL`

### CSV Template for Admins

Generate Google Sheets CSV templates from the current JSON:

- `npm run content:sheet-template`

Output files:

- `/Users/almunday/SJP/docs/google-sheet-template/admin-content.csv`
- `/Users/almunday/SJP/docs/google-sheet-template/content.csv`
- `/Users/almunday/SJP/docs/google-sheet-template/tabs/*.csv` (one tab file per page key, plus shared tabs)
- `/Users/almunday/SJP/docs/google-sheet-template/content-formula.txt`

Validate CSV content before publishing:

- `npm run content:sheet-validate` (validates runtime sheet CSV)
- `npm run content:sheet-validate -- --tabs` (validates split tab CSV files)
