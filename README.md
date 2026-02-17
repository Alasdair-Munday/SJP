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
