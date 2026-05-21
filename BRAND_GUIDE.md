# MerchantSpring Brand Guide

Source: extracted from merchantspring.io CSS, assets, and copy (2026-05-21).

## Color Palette

### Primary — Navy
Anchors backgrounds, headings, dark-theme surfaces.

| Hex | Usage |
|---|---|
| `#000f36` | Primary navy. Also used as rgba overlays at 0.1–0.7 opacity. |
| `#020610` | Near-black for deepest backgrounds. |
| `#2c2c2c` | Body text on light backgrounds. |

### Accent — Orange / Amber
CTAs, highlights, branded gradients and glows.

| Hex | Usage |
|---|---|
| `#f89c1c` | Primary orange. |
| `#ffb446` | Golden orange. Used as rgba glow at 0.1–0.6 opacity. |
| `#ffc042` | Yellow-gold. |

### Secondary — Blue
Links and interactive states.

| Hex | Usage |
|---|---|
| `#3c81e0` | Link blue. |
| `#8fc9ff` | Light blue tint. |
| `#1155cc` | Deep link blue (CSS shorthand `#15c`). |

### Neutrals

| Hex | Usage |
|---|---|
| `#545454`, `#6a6a6a`, `#636d87`, `#717fa5` | Secondary text (last is slate). |
| `#b3b7c3`, `#cacaca`, `#d9dbe1`, `#f1f1f1` | Borders, dividers, subtle backgrounds. |
| `#ffffff` | Light background. |

## Typography

- **Font family**: Open Sans (Google Fonts)
- **Weights loaded**: 300–800, italic + roman
- **Scale**: bold large hero headings → regular body copy

```html
<link href="https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,300..800;1,300..800&display=swap" rel="stylesheet">
```

## Logo

Hosted at `https://merchantspring.io/hubfs/`. Dual light/dark variants are required — the brand actively supports both themes.

| Asset | Use |
|---|---|
| `logo_light-1.svg` | Full horizontal logo on light backgrounds. |
| `for_dark_theme.svg` | Full horizontal logo on dark backgrounds. |
| `logo_m_for_light_them.svg` | Compact "M" monogram on light backgrounds. |
| `logo_m_for_dark_theme.svg` | Compact "M" monogram on dark backgrounds. |
| `footer_logo_dark.svg` | Footer variant for light pages. |
| `footer_light_logo.svg` | Footer variant for dark pages. |

## Voice & Positioning

- **Primary tagline**: *"See every marketplace. Grow every brand"*
- **Positioning statement**: "The leading SaaS Analytics and Reporting solution for Enterprise Brands and their Agencies"
- **Tone**: Professional, data-driven, solution-oriented. Approachable but enterprise-credible.
- **Key themes**: unified marketplace insights, multichannel, scalability, AI-powered, 120+ channels, 35,000+ brands & agencies.

## Visual Style

- Clean, minimalist, high-contrast layouts
- Card-based content blocks with generous spacing
- Rounded buttons with hover states
- Heavy use of data visualization (charts, dashboards) in product imagery
- Animated GIF icons for interactive UI elements
- Partner logo carousels (Amazon SPN, Walmart Connect, Otto, etc.)

## Mintlify `docs.json` mapping

```json
"colors": {
  "primary": "#000f36",
  "light":   "#ffb446",
  "dark":    "#000f36"
}
```

Use `#3c81e0` for link/accent overrides where supported. Open Sans should be the preferred font where the platform allows a font override.
