# Google Sheets Datasource Design

This template is designed for non-technical admins to edit site content safely in Google Sheets.

## Recommended Workbook Setup

Use a sheet tab called `content` and import:

- `/Users/almunday/SJP/docs/google-sheet-template/admin-content.csv`

The CSV loader reads these required columns:

- `path`
- `type`
- `value`

It ignores extra helper columns (`group`, `section`, `label`, `notes`), which are there to make editing easier.

## Column Guide

- `group`: top-level content group (`site`, `navigation`, `pages`, `sermons`, etc.)
- `section`: quick grouping key for filters
- `label`: human-friendly label
- `path`: canonical JSON path (example: `pages.home.hero.title`, `sermons[0].speaker`)
- `type`: value type (`string`, `html`, `url`, `path`, `number`, `boolean`, `null`)
- `value`: editable content value
- `notes`: editing guidance

## Admin Editing Rules

- Do not change `path` unless you are intentionally remapping content.
- Keep array indexes contiguous (`[0]`, `[1]`, `[2]`, ...).
- For `html` values, keep valid HTML (e.g. links).
- For `number`, only numeric values.
- For `boolean`, use `TRUE` or `FALSE`.

## Regenerate CSV from JSON

```bash
npm run content:sheet-template
```

This writes:

- `/Users/almunday/SJP/docs/google-sheet-template/admin-content.csv` (admin-friendly)
- `/Users/almunday/SJP/docs/google-sheet-template/content.csv` (minimal machine format)

Both include all current values from `/Users/almunday/SJP/src/data/content.json`.

## Runtime/Build Integration

The site can load content from Google Sheets CSV via `/Users/almunday/SJP/src/data/site-content.ts` when `CONTENT_SOURCE=sheets`.

By default it reads spreadsheet `1Ay1kS_--qmW9x0gSi5zSUQvkdQoeiGVQvu30PY6XUxM`, tab `content`, via CSV export.

Optional overrides:

- `GOOGLE_SHEETS_CSV_URL` (or `CONTENT_CSV_URL`) for a full CSV URL
- `GOOGLE_SHEETS_SPREADSHEET_ID` (or `GOOGLE_SHEETS_ID`) for spreadsheet ID
- `GOOGLE_SHEETS_GID` for a specific tab gid when not using `GOOGLE_SHEETS_CSV_URL`
