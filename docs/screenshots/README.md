# Screenshots

This folder contains the visual assets referenced in the root `README.md` and `README.it.md`.

## Current state

The files here are **stylized SVG placeholders** that match the project's design system (OKLCH palette, Fraunces + Inter, editorial layout). They are intentionally lightweight (no rasterized photos, no fake user data) and rendered to look like real interface previews.

When a public live demo is ready, these placeholders will be replaced by real PNG screenshots captured from the running app.

## File map

| File | Surface | Viewport | Used in |
| --- | --- | --- | --- |
| `hero-banner.svg` | OG / README hero banner | 1280×640 | Top of `README.md` and `README.it.md` |
| `landing-1280.svg` | Landing page (`/`) | 1280×800 | Demo grid |
| `landing-mobile.svg` | Landing page (`/`) | 375×812 | Demo grid (mobile column) |
| `pricing-1280.svg` | Pricing page (`/pricing`) | 1280×800 | Demo grid |
| `dental-1280.svg` | Vertical page (`/verticali/dental`) | 1280×800 | Demo grid |
| `dashboard-1280.svg` | Tenant dashboard (`/dashboard`) | 1280×800 | Demo grid |
| `admin-1280.svg` | Super-admin panel (`/admin`) | 1280×800 | Demo grid |
| `onboarding-1280.svg` | Onboarding wizard (`/onboarding`) | 1280×800 | Demo grid |

## Capturing real screenshots (when the dev server is running)

Once the app is running locally on `localhost:3000` (or another port), real screenshots can be captured via Playwright. Save the script as `scripts/capture-screenshots.mjs`:

```js
import { chromium } from 'playwright';

const targets = [
  { path: '/', name: 'landing', viewport: { width: 1280, height: 800 } },
  { path: '/', name: 'landing-mobile', viewport: { width: 375, height: 812 } },
  { path: '/pricing', name: 'pricing', viewport: { width: 1280, height: 800 } },
  { path: '/verticali/dental', name: 'dental', viewport: { width: 1280, height: 800 } },
  { path: '/dashboard', name: 'dashboard', viewport: { width: 1280, height: 800 } },
  { path: '/admin', name: 'admin', viewport: { width: 1280, height: 800 } },
  { path: '/onboarding', name: 'onboarding', viewport: { width: 1280, height: 800 } },
];

const browser = await chromium.launch();
for (const target of targets) {
  const context = await browser.newContext({ viewport: target.viewport });
  const page = await context.newPage();
  await page.goto(`http://localhost:3000${target.path}`);
  await page.waitForLoadState('networkidle');
  const suffix = target.name === 'landing-mobile' ? 'mobile' : `${target.viewport.width}`;
  await page.screenshot({
    path: `docs/screenshots/${target.name === 'landing-mobile' ? target.name : `${target.name}-${suffix}`}.png`,
    fullPage: false,
  });
  await context.close();
}
await browser.close();
```

Run with:

```bash
npx playwright install chromium
node scripts/capture-screenshots.mjs
```

Then update the README image references from `.svg` to `.png` (or keep both — the SVGs make great fallback art).

## OG image strategy

The repo also exposes a dynamic Open Graph image at `/opengraph-image` (Next.js convention) — see `src/app/opengraph-image.tsx`. The hero-banner SVG in this folder is a static fallback for the GitHub README and social previews where dynamic generation isn't available.

## Design tokens used

The placeholders pull from the project tokens:

- `--color-accent` `oklch(45% 0.12 175)` — deep teal (primary brand)
- `--color-bg` `oklch(98% 0.005 150)` — warm off-white
- `--color-accent-warm` `oklch(78% 0.07 80)` — sand / gold accent (used on the AI bubble)
- `--font-display` Fraunces — display + italic emphasis
- `--font-body` Inter — body + UI

## Contributing real screenshots

PRs welcome. Please use 1280×800 (desktop) and 375×812 (mobile) viewports, capture in light theme (the design has only one canonical theme for now), and commit PNGs at 1× — no Retina 2× to keep the repo light.
