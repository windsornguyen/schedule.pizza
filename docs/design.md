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

Rounded-square calendar icon. White **67** on tomato red.
67 is not a date. It means nothing. That's the point.

- Favicon: ghost pizza slice behind the 67 (only place pizza touches the logo)
- Everywhere else: 67 stands alone

## Colors

### Brand

Warm. Pizza-themed. Used sparingly — logos, OG images, favicons,
accent elements. Never as page backgrounds.

| Name     | Hex       | Use                          |
| -------- | --------- | ---------------------------- |
| Crust    | `#F5E6D0` | OG backgrounds, warm fills   |
| Tomato   | `#D32F2F` | Logo, primary accent, CTAs   |
| Cheese   | `#F5A623` | Highlights, hover states     |
| Basil    | `#4A7C59` | Success, confirmations       |

### Site

Neutral. The product wears a white shirt and dark jeans.
Brand colors don't appear on the site itself.

| Token                | Value              | Role            |
| -------------------- | ------------------ | --------------- |
| `--background`       | `oklch(1 0 0)`     | Page background |
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
| `font-sans`  | Geist, system-ui, sans-serif        | UI and prose |
| `font-mono`  | Geist Mono, ui-monospace, monospace | Code, API    |

Headings: `font-semibold`, `tracking-tight`. No font above 36px
on the site. Body: `text-sm`. Antialiased everywhere.

## Radius

Base: `0.625rem`. Everything rounds the same amount.

| Token        | Value                       |
| ------------ | --------------------------- |
| `--radius-sm`| `calc(var(--radius) - 4px)` |
| `--radius-md`| `calc(var(--radius) - 2px)` |
| `--radius-lg`| `var(--radius)`             |
| `--radius-xl`| `calc(var(--radius) + 4px)` |

## OG Image

1200x630. Crust background. Ghost pizza right side, low opacity.
67 logo top-left (no pizza behind it). Left-aligned headline in
dark text. Byline in muted warm brown. That's it.

## Rules

- No dark backgrounds on brand surfaces.
- No gradients.
- No animations unless they communicate state (loading, transition).
- No illustrations. If you need to explain something, use text.
- No marketing language. Say what it does. Stop.
- Pizza is the mascot, not the brand. It shows up in the background,
  never as the centerpiece.
- If you're debating whether to add something, don't add it.
