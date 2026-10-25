# Real Estate (Juniper Realty): storefront redesign (2026-10-25)

Brief: `Euler/state/briefs/design-skills-redesign-2026-10-25.md` (Openfront Batch 2, storefront only).

**Live:** https://openfront-real-estate-production.up.railway.app (real-estate.openship.org once DNS is added)

## The world
**Lights on at dusk.**
- **Ground:** a juniper-night page that follows the brokerage logo hue.
- **Ink:** limestone.
- **Accent:** the brokerage colour, lifted.
- **Type:** Instrument Serif display at poster size.
- **Hero:** the featured home is the full-bleed backdrop, with the search and the featured listing's card set into it.

## What changed
- `styles/tokens.css`: dark tokens; status, error and success colours re-tuned for dark; dark shadows; tighter radii.
- `styles/storefront.css`: full-bleed featured-home hero with the search set into it and a compact featured-listing card; prices in the serif; advisors band, neighbourhood tiles and the hero card use ink, not paper, as text; deeper footer.
- `screens/HomePage.tsx`: hero markup.

Every route, state and workflow is unchanged: no route, data loader, server action, form field or test was removed or renamed. The shared dashboard shell and platform pages were not touched.

## Skills used, and how
- **impeccable**: read SKILL.md and set the surface modes: Persuade for the home page, Operate for booking, cart, checkout and account. Its "redesign replaces, it doesn't polish the old look" rule set the scope: a new world (ground, type, shape, signature motif), with every route, state and workflow kept. Its design hook scanned each stylesheet as it was written and reported no deterministic issues. I did **not** run `/impeccable init`, `critique` or `polish` as separate commands.
- **frontend-design**: the two-pass plan (palette of named tokens, type roles, layout sketch, principles), then a review of that plan against its list of generated-design defaults. That review removed the single italic accent word in headlines (salon), dropped 01/02 numbering on a list that isn't a sequence (vape) and kept the "near-black plus one acid accent" look out of every palette: accents are the merchant's own hue, lifted for dark and softened.
- **design-taste-frontend (tasteskill v2)**: the "idea comes from the subject" inventory. Each world comes from a physical object in the business. I didn't run its `draw.mjs` or `inspect.mjs` scripts; the live Playwright check below did that job.
- **high-end-visual-design / emil-design-eng**: custom ease-out curves only; transform and opacity motion; grain and blur kept to fixed layers; reduced motion respected (the existing guards were kept).
- **mobile-native**: 44px+ targets, `100svh`/`dvh` instead of `100vh` for heroes, no horizontal scroll at 390px (measured: overflowX=0 on every captured page).
- **Tessier as the bar**: near-black but never flat grey, off-white ink, one restrained accent, few radii, product and photography carrying the colour.

## Checks
- `tsc --noEmit`: exit 0, 0 errors.
- `node --test tests/storefront-password-reset.test.cjs`: 2 pass, 0 fail.
- `parity-check.py`: drift 0.

## Commits (pushed to `master`, auto-deployed)
- `09f4e19` Storefront redesign: lights on at dusk

## Screenshots (Playwright 1.62, 1440x900 desktop and 390x844 phone, full page)
Before, in `design/before-20261025/`:
- `before-home-desktop.jpg`
- `before-home-phone.jpg`
- `before-listings-desktop.jpg`
- `before-listings-phone.jpg`

After (live), in `design/after-20261025/`:
- `after-home-desktop.jpg`
- `after-home-phone.jpg`

## Notes
A parallel session (`demo-data-reset-2026-10-25.md`) reset this demo's database and is re-onboarding it with the full seed while this redesign shipped. The before shots were taken during or after that reset, so they may show an empty or not-configured store rather than the old design with data. The old design is in git (the parent of the first commit below). **At capture time (21:2x UTC) this store had not been re-seeded yet**, so the after shots show the redesigned shell, hero and empty states rather than the demo catalogue. Re-capture once onboarding finishes: `node shot.cjs <url> design/after-20261025 after <paths> --full`.
