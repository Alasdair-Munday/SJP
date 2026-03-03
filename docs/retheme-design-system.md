# Retheme Design & Branding Rules (Image-led)

## 1) Brand direction
This retheme translates the provided references into a **bold, hand-crafted, urban-welcome** visual system:
- bright poster-like colour blocking
- deep ink navy for contrast and graphical shapes
- high-energy uppercase display typography
- hand-drawn accent voice for highlights and labels
- chunky outlines, offset shadows, and imperfect corner radii to keep the look human, not polished

The implementation intentionally keeps all existing copy and page structure unchanged while replacing visual language globally.

## 2) Core colour system
Colour values are sampled/derived from the supplied visuals and mapped to existing mission semantics.

### Mission colours
- **Belong (green):** `#28C76F`
- **Serve (blue):** `#1AAFE8`
- **Give (gold):** `#D8B07A`

### Supporting colours
- **Primary ink/navy:** `#20475F`
- **Soft paper background:** `#F7F8F6`
- **Muted panel tone:** `#E4ECEF`
- **Rule/border line:** `#BFD0D8`

### Usage rules
1. Belong/Serve/Give must always remain semantically mapped to green/blue/gold.
2. Ink should provide type and border contrast over light surfaces.
3. Large fills should use vivid mission tones; body surfaces should stay soft/light for readability.
4. Layering can use subtle gradients but avoid glossy effects.

## 3) Typography

### Font roles
- **Display/headlines:** `Oswald` (uppercase, condensed poster style)
- **Body/UI:** `Manrope`
- **Handwritten accent:** `Permanent Marker`

### Rules
1. Headings are uppercase with slight positive tracking for poster impact.
2. Body text remains sentence case for accessibility/readability.
3. Handwritten font is limited to short emphasis elements (chips, notes, labels), not long paragraphs.

## 4) Graphic language

### Motifs from references
- directional/striped overlays (repeating linear gradients)
- hand-cut block feel via asymmetric corner radii
- offset shadow “print” effect (hard shadow + soft ambient layer)

### Rules
1. Decorative layers must never obscure content legibility.
2. Use striping and texture in bars/footer/background, not on dense reading blocks.
3. Keep motion minimal and tactile (small translate/tilt interactions only).

## 5) UI component rules

### Panels/Cards
- 3px ink-tinted borders
- asymmetrical rounded corners
- offset hard shadow for tactile depth

### Chips (Belong/Serve/Give)
- mission colour tints as background
- stronger ink border contrast
- subtle tilt/raise on hover

### Calls to action
- gold primary CTA with irregular pill radius
- high-contrast text and border
- glowy hover retained but restrained

### Navigation & utility bars
- utility bar uses serve-blue gradient family
- nav gets a rough dashed/striped baseline treatment
- uppercase heading language carries through nav branding tone

### Footer
- layered diagonal stripe motif over dark ink/green gradient
- maintain legible link contrast and hierarchy

## 6) Accessibility & consistency guardrails
1. Keep text contrast AA+ on all primary surfaces.
2. Use the existing token model (`--ink`, `--eden`, `--teal`, `--gold`) so all pages update consistently.
3. Do not alter copy, IA, content hierarchy, or page structure.
4. Prefer global tokens and shared component classes over page-specific overrides.

## 7) Implementation mapping
- `--eden` (belong) updated to vivid reference green.
- `--teal` (serve) updated to bright reference blue.
- `--gold` (give) updated to warm muted gold from palette image.
- Display/body/hand fonts updated globally.
- Card, panel, chip, nav, hero, and footer primitives retuned to match the new brand language.

## 8) Reviewer follow-up refinements
- Follow-up adjustment: cards/panels now use green/blue backgrounds, while parent blocks around them remain very pale and low-contrast (no saturated section backdrops).
- Shifted shared UI surfaces to sharp-corner geometry (cards, panels, chips, and CTAs) to better match the hard-edged poster references.
- Big headings and logo now use a heavier poster display face (`Anton`) while smaller section headings remain handwritten (`Permanent Marker`) to match the reference hierarchy.
- `theme-drench` sections now use stronger colour density plus directional stripe overlays to increase the amount of bold colour-backed text areas across pages while preserving structure.
- Mission chips and utility-bar labels now lean handwritten (uppercase marker style) to carry the rough, hand-made tone into navigation and global chrome.
