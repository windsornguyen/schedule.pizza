# schedule.pizza — Design System

Brand reference for designers, developers, and agents.
Serve this at `/design.md` so anyone can `curl https://schedule.pizza/design.md`.

## Identity

- **Name:** schedule.pizza
- **Tagline:** The easiest way to find some time.
- **Tone:** Casual, functional, unpretentious. Early Google energy.
- **Mascot:** Pizza. Appears in backgrounds and brand surfaces, never inside the logo.

## Logo

Rounded-square calendar icon. White **67** on tomato red. 67 is nonsensical.

- Favicon only: ghost pizza slice behind the 67
- All other contexts: 67 calendar icon alone, no pizza

## Colors

### Brand (pizza-themed, warm)

| Token     | Hex       | Role                           |
| --------- | --------- | ------------------------------ |
| `crust`   | `#F5E6D0` | OG backgrounds, warm surfaces  |
| `tomato`  | `#D32F2F` | Logo, accents, CTAs            |
| `cheese`  | `#F5A623` | Highlights, hover states       |
| `basil`   | `#4A7C59` | Success states, confirmations  |

### Site (neutral, clean)

| Token                | Value              | Role              |
| -------------------- | ------------------ | ----------------- |
| `--background`       | `oklch(1 0 0)`     | Page background   |
| `--foreground`       | `oklch(0.145 0 0)` | Primary text      |
| `--muted`            | `oklch(0.97 0 0)`  | Raised surfaces   |
| `--muted-foreground` | `oklch(0.556 0 0)` | Secondary text    |
| `--border`           | `oklch(0.922 0 0)` | Borders           |
| `--input`            | `oklch(0.922 0 0)` | Input borders     |
| `--ring`             | `oklch(0.708 0 0)` | Focus rings       |
| `--destructive`      | `#D32F2F`          | Error / danger    |

Brand colors appear in logos, OG images, favicons, and accent
elements. Never as page backgrounds.

## Typography

| Utility      | Family                                 | Use            |
| ------------ | -------------------------------------- | -------------- |
| `font-sans`  | Geist, system-ui, sans-serif           | UI and prose   |
| `font-mono`  | Geist Mono, ui-monospace, monospace    | Code, API refs |

Body: antialiased, `font-feature-settings: "rlig" 1, "calt" 1`.
Headings: `font-semibold`, `tracking-tight`.
Secondary text: `text-sm`, `text-muted-foreground`.

## Spacing & Radius

Base radius: `0.625rem` (10px). Derived:

| Token        | Value                      |
| ------------ | -------------------------- |
| `--radius-sm`| `calc(var(--radius) - 4px)`|
| `--radius-md`| `calc(var(--radius) - 2px)`|
| `--radius-lg`| `var(--radius)`            |
| `--radius-xl`| `calc(var(--radius) + 4px)`|

## OG Image (1200x630)

- Background: Crust (`#F5E6D0`)
- Ghost pizza illustration, right side, low opacity
- 67 calendar logo top-left, tomato red, standalone (no pizza)
- Headline left-aligned, dark text (`#1A1A1A`)
- Byline in muted warm brown

## Don'ts

- Don't use dark/black backgrounds for brand surfaces
- Don't put the pizza behind the logo (except favicon)
- Don't use gradients
- Don't make it look polished — functional is the goal
- Don't use brand colors as page backgrounds
