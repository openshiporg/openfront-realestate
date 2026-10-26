# Real Estate (Juniper Realty): full redesign, platform and storefront (2026-10-26)

**Brief:** `Euler/state/briefs/batches-2-6-full-redesign-2026-10-25.md`. The owner ordered it with no approval round, so every impeccable decision point was taken unattended. That is recorded in `PRODUCT.md` and the surface briefs.

**Live:** https://openfront-real-estate-production.up.railway.app (real-estate.openship.org once DNS is in).

## What it is now

### Platform: "the call list"
- **Task first.** Every operator screen opens on who to contact, what to confirm and what is blocking a closing. Underline tabs carry counts (they wrap on desktop and scroll with a cue on phones). Tables are dense, with dot-plus-word status. Each row has one primary action; destructive actions come last, in a menu. Forms open in sheets behind header buttons.
- **Phones.** Rows fold status into the first cell and put the primary action on its own full-width line.
- **Radii.** Explicit 6px and 4px, because the dashboard's `--radius` is 10px. The shared shadcn button bevel is reset (`flatReset`).
- **Signature.** The Leads response clock: lead age grows heavier, then amber, then red the longer a lead waits.

### Storefront: "Built of the place"
- **Materials.** Hill Country modern: a galvalume standing-seam ground (cool silver, never cream), a charcoal roof band, cedar for actions (derived from the brokerage colour), and live-oak, rust and steel status plates. Type is Barlow and Barlow Condensed with tabular numerals. Corners are square; rules are 1px seams.
- **First viewport.** A sticky search rail with a live count, real results above the fold, and a featured home that never repeats a row.
- **Listings.** `/listings` is a real results page (filters in the URL, sort, paging, removable filter tags) instead of a redirect to `/#homes`. Listing detail leads with its photos and facts.
- **Fallbacks and account.** A missing photo gets a place plate with real counts. Account tabs are flat, with saved homes first, and saved homes carry a cedar flag.
- **Kept.** The Equal Housing Opportunity notice stays.

### Shared dashboard shell
Byte-identical to E-commerce (parity drift 0).

## Bugs fixed on the way
- **Lead Routing returned HTTP 500 live.** The server page imported option arrays from a `'use client'` module, which arrive as client references, so `.find()` threw. They now live in `routing/lib/options.ts`.
- **Tasks returned 500 once the list had rows.** Same cause, with `priorityOptions`; it is now in `tasks/lib/options.ts`. A scan of all four redesigned repos for server files importing non-component values from client modules now comes back clean.
- **Westlake Hills showed an empty neighbourhood tile.** The image pack mapped it to `''`, and `??` does not fall through on an empty string.
- **The lead tab counts query failed.** It passed enum values as quoted strings.
- **Tasks opened empty for an admin** while overdue work existed. It now opens on everyone's tasks when none are yours.

## Process (impeccable first)
1. **Before screenshots:** live, desktop 1440 and phone 390, in `before/` (39 files).
2. **Critique:** impeccable `critique` with isolated subagents A (design review) and B (`detect` plus a radius sweep), synthesized in `CRITIQUE.md` and persisted. Platform 17/36, storefront 24/36.
3. **Init:** impeccable `init` produced `PRODUCT.md`, inferred, with each inference labelled.
4. **Storefront direction:** `concept-seed` (`seed:6fb81313bf9e1eb3`) assigned grounded candidate 6 of 7 (Hill Country modern materials). The Japanese high-density challenger was competitive and kept as the results density. The others were declined, each with its discipline kept as a raise.
5. **Platform direction:** the structure is pinned by the owner's brief. A surface roll (`seed:a18917bc9e82feaf`) dealt structures 4 (a response queue sorted by waiting time), 1 (tables) and 3 (tables grouped by stage). The build carries all three.
6. **Build:**
   - I rewrote the shared kit (`styles.ts`, `PlatformUI.tsx`, `RecordForm.tsx`, `FilterTabs.tsx`) and fixed the routing 500.
   - Three parallel agents then rebuilt platform group A (leads, showings, pipeline, tasks), platform group B (listings, people, routing, reports, operations, store settings) and the storefront.
7. **Finish review:**
   - Round 1: 8 material fixes (`f89a076`, plus the Tasks 500 in `a8488e5`).
   - Round 2: 2 regressions and 3 partials (`4a79167`).
   - Round 3: date contrast (`f611780`) plus evidence of an open sheet.
   - Final disposition: **ship**, with every fix and both regressions scored resolved against a capture.
8. **Documenter:** impeccable documenter wrote `DESIGN.md` plus `.impeccable/design.json`, derived from the shipped CSS and components.

## Skills used, per screen, and what each changed

| Screen | Skills | What changed |
|---|---|---|
| Platform kit | impeccable craft-floor and operate, minimalist-ui, emil-design-eng | The pill track became a plain row; the pill tabs became underline tabs. Pill buttons became flat 6px with `flatReset` over the shared bevel. Added `DataTable`/`Td`/`StatusCell` and phone row helpers. Press scale 0.98. |
| Leads, lead detail | impeccable operate (task first), hallmark (states) | A "needs response" table sorted by wait, with the response clock and one verbed next step per row. Contact and next step come first on detail. Log activity and Schedule showing open in sheets. ISO timestamps in notes render as local time. |
| Showings | impeccable operate | Tours to confirm, grouped by day. Underline status tabs plus a range select. Confirm is the row action. |
| Pipeline, deal detail | impeccable operate and clarify | Tables grouped by stage, with the last-change date and close or overdue. Moves are verbed. On deal detail the next step comes first, offer and commission appear once, and offers and checklist open in sheets. |
| Tasks | impeccable operate | Active work grouped by due date. Scope and status share one tab row. Opens on everyone's work when none is yours. |
| Listings | impeccable operate | Dense table with one primary action and status changes in a menu (Withdraw last). Attention counts show in the header. |
| People, routing, reports | impeccable operate and clarify | Agent workload table with View plus a menu holding a confirmed Suspend. Routing opens on whether new leads will reach an agent. Reports state their sample scope. |
| Operations | impeccable distill | One section per tab, opening on "Needs attention" (overdue or blocked first). Forms sit behind drawers. Anchors from old links still resolve. |
| Store settings | minimalist-ui | A neutral, square preview with square swatches. |
| Storefront home and results | impeccable new-work and mode-persuade, frontend-design (two-pass token plan), design-taste-frontend (design read; dials 4/3/7) | Metal header band, sticky search rail with live count, dense result rows and modules, a featured home that never duplicates a row, neighbourhood tiles with real photos or a place plate, and advisors. |
| Listing detail | hallmark (mobile, states), emil-design-eng (160–200ms, 0.97 press) | Photo-led gallery, facts strip with $/sq ft, advisor, and a showing request with a prefilled earliest time in ink. |
| Account | impeccable craft-floor (no eyebrows) | Flat tabs with saved homes first. Name and Sign out appear once. Empty states say how to fill them. |

## Checks (final state, `f611780`)
- `tsc --noEmit` through heavy-exec, non-incremental: exit 0, 0 errors.
- Unit tests: `family-security` 14/0, `shared-dashboard` 8/0, `storefront-password-reset` 2/0 (pass/fail).
- `parity-check.py openfront-real-estate`: drift 0, missing 0, sidebar ok.
- `impeccable detect --json features/platform features/storefront`: `[]`.
- Live: every captured route returns 200 with overflowX 0 at desktop and phone (`after/after-report.json`).

## Commits (master, auto-deployed)
- `a67c7fc` Full redesign: real estate platform as the call list, storefront built of the place
- `f89a076` Real estate finish-review fixes: phone rows keep status and action, flat buttons, forms behind actions, Westlake photo, tasks open on real work
- `a8488e5` Tasks: move the priority list out of the client form module so the task list stops returning 500
- `4a79167` Real estate review round 3: lead tab counts back, featured home without duplicates, readable date fields, pipeline rows fit phones
- `f611780` Showing request: open the preferred time on the earliest bookable half hour so the field reads in ink

## Screenshots
- `before/`: 39 captures (Playwright Chromium, live). Lead Routing shows the old 500.
- `after/`: 45 captures (Playwright WebKit, live), covering every platform and storefront route at desktop and phone. Also included:
  - an open Log activity sheet
  - a crop of the prefilled showing-time field

## Open items
- **Days on market:** not shown. There is no listing-date field, so listings show "Updated" instead. Pipeline shows days since the last change, not days in stage.
- **Two of three advisors are public.** The third advisor's only listing is pending, and the public listing statuses live in keystone, which is outside design scope.
- **Routing rules that assign only a team never match** during lead capture: keystone's `matchesRule` requires an agent. The routing summary flags this; the behaviour itself is unchanged.
- **Ceiling (not a material fix):** the storefront seam pitch is not aligned to the module grid.
- **Not opened in the verdict rounds:** the phone captures for tasks, listings, agents and operations.
