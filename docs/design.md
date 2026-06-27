# schedule.pizza — Design System

## Philosophy

This product looks like it was built by someone who cares about
function, not aesthetics. Think early Google, Gmail circa 2004,
Craigslist. The design is intentionally minimal — even slightly
ugly — but in the way that signals confidence and taste. Every
pixel exists because it earns its keep, not because a designer
needed to justify their time.

No hero sections. No gradients. No illustrations that don't
communicate information. If a user lands on the page and
immediately knows what to do, the design worked.

The site should feel like it was made by an engineer who has
strong opinions about type and spacing but zero interest in
making things "pop."

## Logo

Rounded-square yellow mark. Black lowercase **p**. Black border.

- Favicon: the same **p** mark, no alternate mascot
- Product surfaces: **p** mark next to `schedule.pizza`
- Browser install surfaces: same mark via `favicon.svg`, `favicon.ico`,
  `favicon-32x32.png`, `apple-touch-icon.png`, `icon-192.png`,
  `icon-512.png`, and `site.webmanifest`
- No pizza slice in the logo. Pizza is in the name.

## Colors

### Brand

Warm. Pizza-themed. Used sparingly — logos, OG images, favicons,
accent elements. Never as page backgrounds.

| Name     | Hex       | Use                          |
| -------- | --------- | ---------------------------- |
| Crust    | `#F5E6D0` | OG backgrounds, warm fills   |
| Tomato   | `#D32F2F` | Primary accent, CTAs         |
| Cheese   | `#F5A623` | Highlights, hover states     |
| Basil    | `#4A7C59` | Success, confirmations       |
| Mark     | `#F1C34B` | Logo fill                    |

### Site

Neutral. The product wears a white shirt and dark jeans.
Brand colors appear only in the logo mark and rare state accents.

| Token                | Value              | Role            |
| -------------------- | ------------------ | --------------- |
| `--background`       | `oklch(0.995 0.002 90)` | Page background (warm off-white) |
| `--foreground`       | `oklch(0.145 0 0)` | Primary text    |
| `--muted`            | `oklch(0.97 0 0)`  | Raised surfaces |
| `--muted-foreground` | `oklch(0.556 0 0)` | Secondary text  |
| `--border`           | `oklch(0.922 0 0)` | Borders         |
| `--input`            | `oklch(0.922 0 0)` | Input borders   |
| `--ring`             | `oklch(0.708 0 0)` | Focus rings     |
| `--destructive`      | `#D32F2F`          | Errors          |

## Typography

| Utility      | Family                              | Use          |
| ------------ | ----------------------------------- | ------------ |
| `font-sans`  | Inter, ui-sans-serif, system-ui, sans-serif | UI and prose |
| `font-mono`  | Geist Mono, ui-monospace, monospace          | Code, API    |

All text is `text-sm` (14px). Headings are the same size as body —
differentiated by `font-semibold` (600) vs `font-normal` (400).
No font size hierarchy. Weight does the work. Antialiased everywhere.

## Radius

Base: `0.625rem`. Everything rounds the same amount.

| Token        | Value                       |
| ------------ | --------------------------- |
| `--radius-sm`| `calc(var(--radius) - 4px)` |
| `--radius-md`| `calc(var(--radius) - 2px)` |
| `--radius-lg`| `var(--radius)`             |
| `--radius-xl`| `calc(var(--radius) + 4px)` |

## OG Image

1200x630. Warm off-white background. **p** logo top-left with
`schedule.pizza` next to it. Left-aligned headline in dark text.
One supporting line. One dark red rule. That's it.

## Rules

- No dark backgrounds on brand surfaces.
- No gradients.
- No animations unless they communicate state (loading, transition).
- No illustrations. If you need to explain something, use text.
- No marketing language. Say what it does. Stop.
- Pizza is the mascot, not the brand. It shows up in the background,
  never as the centerpiece.
- If you're debating whether to add something, don't add it.
- Content max-width: 550px. Generous whitespace around everything.

## Influences

**benji.org/liveline** — same-size text throughout, weight-based
hierarchy, warm off-white background (`rgb(253, 253, 252)`), Inter
font, 550px content column. Everything is 14px. Headings are just
bolder. The whole page reads like a document, not a marketing site.
