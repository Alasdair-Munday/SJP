# Google Sheets Multi-Tab Workflow

This template lets admins edit content in many tabs while runtime still reads one
`content` tab.

## Runtime Contract

The loader in `/Users/almunday/SJP/src/data/site-content.ts` reads one CSV tab and requires:

- `path`
- `type`
- `value`

Extra columns are allowed and ignored (`group`, `section`, `label`, `notes`).

## Generate Templates

```bash
npm run content:sheet-template
```

This writes:

- `/Users/almunday/SJP/docs/google-sheet-template/admin-content.csv`
- `/Users/almunday/SJP/docs/google-sheet-template/content.csv`
- `/Users/almunday/SJP/docs/google-sheet-template/content-formula.txt`
- `/Users/almunday/SJP/docs/google-sheet-template/tabs/*.csv`

Generated tab routing:

- one tab per page key: `pages.<page_key>.*` -> `<page_key>`
- shared non-page content (`site`, `navigation`, `utility_navigation`, `footer`, `components`) -> `shared`
- sermon list entries (`sermons.*`) -> `sermons_data`

## Workbook Setup (No Runtime Code Changes)

1. Open spreadsheet `1Ay1kS_--qmW9x0gSi5zSUQvkdQoeiGVQvu30PY6XUxM`.
2. Create a tab for each generated CSV in `tabs/` (same names as files).
3. Keep (or create) one runtime tab named `content`.
4. Import each generated CSV into its matching tab.
5. In `content!A1`, paste the formula from `content-formula.txt`.
6. Protect `content` as read-only.
7. Allow admins to edit split tabs.
8. Set `GOOGLE_SHEETS_GID` to the `content` tab gid in deploy settings.

## How To Find `GOOGLE_SHEETS_GID`

1. Open the `content` tab in Google Sheets.
2. In the URL, copy the number after `#gid=`.
3. Set that value as `GOOGLE_SHEETS_GID`.

## Validation

Validate the live runtime CSV (default behavior):

```bash
npm run content:sheet-validate
```

Validate generated split tab CSV files (cross-tab duplicate checks):

```bash
npm run content:sheet-validate -- --tabs
```

Validate a specific source:

```bash
npm run content:sheet-validate -- --file docs/google-sheet-template/content.csv
npm run content:sheet-validate -- --url "https://docs.google.com/spreadsheets/d/<id>/export?format=csv&gid=<gid>"
```

## Admin Editing Rules

- Do not change `path` unless intentionally remapping content.
- Keep array indexes contiguous (`[0]`, `[1]`, `[2]`, ...).
- For `number`, use numeric values only.
- For `boolean`, use `TRUE`/`FALSE`.
- For `html`, keep valid HTML.
