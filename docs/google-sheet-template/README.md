# Google Sheets Multi-Tab Workflow (Legacy)

This workflow is now a fallback path.
Primary content editing is Decap CMS at `/admin`, writing directly to repo files under `/Users/almunday/SJP/src/content/cms/` and `/Users/almunday/SJP/src/content/news/`.

Use this document only if `CONTENT_SOURCE=sheets` is intentionally enabled.

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

## Validation

Validate the live runtime CSV:

```bash
npm run content:sheet-validate
```

Validate generated split tab CSV files:

```bash
npm run content:sheet-validate -- --tabs
```
