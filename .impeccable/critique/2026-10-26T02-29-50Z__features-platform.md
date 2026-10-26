---
target: real-estate platform + storefront
total_score: 41
max_score: 72
na_heuristics: platform 10, storefront 9
p0_count: 1
p1_count: 6
target_identity: "file:/Users/junaid/Code/openfronts/openfront-real-estate/features/platform"
timestamp: 2026-10-26T02-29-50Z
slug: features-platform
---
Method: dual-agent (A: design review subagent · B: detector subagent)

# Real estate critique, before the 2026-10-25 full redesign

Evidence: live screenshots in `design/2026-10-25-full/before/` (desktop 1440, phone 390); source in `features/platform/**` and `features/storefront/**`.

## Scores (Nielsen, 0–4)
Platform 17/36 (help n/a): status 3 · real world 2 · control 3 · consistency 1 · error prevention 2 · recognition 2 · efficiency 1 · minimalist 2 · error recovery 1.
Storefront 24/36 (error recovery n/a): status 3 · real world 3 · control 2 · consistency 3 · error prevention 3 · recognition 3 · efficiency 2 · minimalist 3 · help 2.

## Design specificity
- Platform: generic shadcn admin with real-estate nouns. Kit `features/platform/components/styles.ts:4-15` (pill track, pill tabs, pill buttons) and `PlatformUI.tsx` (`<Track>` wraps every action group; `:79` pill search; `:87,:101,:109,:114` rounded-xl panels/empty/error/stats; `:129-130` pager pills); `listings/components/FilterTabs.tsx:8-10` status pill tabs on Listings, Leads, Showings, Tasks. The same pill track carries filters and record actions (Mark lost / Open, Mark sold / Withdraw).
- Storefront: partly specific (Juniper Realty, Austin; condensed serif, evergreen; named neighbourhoods and advisors; Equal Housing footer) but a stock structure (hero search → card grid → neighbourhoods → advisors → contact) and pill-heavy (`storefront.css:33,:50,:54,:88,:121,:151,:158`).
## Detector (impeccable detect)
- platform: clean ([]). storefront: clean ([]).
- Radius sweep (features/platform): rounded-full 42 in 24 files (28 banned, 14 legit dots/avatars/swatches/meter), rounded-xl 25 in 14 files, rounded-lg 20 in 10 files, 2xl/3xl 0.
- Banned sources: `features/platform/components/styles.ts` L4 trackClass (recessed pill track), L8 trackItemClass (pill tabs), L14 pillClass, L15 pillPrimaryClass (used in 13 files); pill search input `PlatformUI.tsx:79`; 23 `<Button className="rounded-full">` overrides (PipelinePage:61, DealActionForms:81/101, LeadActivityForm:55, PendingShowingForms:96, DuplicateLeadResolver:72, ListingListPage:107/119, StoreSettingsPageClient:218, ShowingListPage:54, ShowingActionForms:62, FormFields:142, ControlledEvidenceForms:50, TaskForms:72/87/106/159/189, RecordForm:50, PeoplePage:35/36, MemberForms:80, ReportsPage:39).
- Container radii xl/lg concentrated in OperationsPage (empty state, article card, table wrapper, details, deal rows).
- Browser overlay skipped (no mutable browser automation).

## Priority issues: platform
- P0 Lead Routing returns HTTP 500. Likely cause: `RoutingPage.tsx:2` (server) imports option arrays from the `'use client'` module `RoutingForms.tsx:7-8`; they arrive as client-reference proxies and `.find()` throws. Move the arrays to a shared non-client module.
- P1 pill/rounded kit (owner complaint); filters and record actions look identical.
- P1 Leads list is not a triage queue: tall cards with an always-open schedule form per lead (`LeadListPage.tsx:77-111`); needs a dense table (name, status, intent, listing, agent, age, next action) with scheduling on demand.
- P1 Listings list: cards with 3–4 equal-weight action pills (`ListingListPage.tsx:47,116`); needs a table with status, price, days on market, leads/showings counts, one primary action.
- P2 Operations is a 4,900px dumping ground with a 15-anchor pill nav; lead with what is overdue or blocking a closing.
- P2 Tasks defaults to an empty "open" tab while one is in progress; default to my active tasks by due date.
- P2 Deal detail repeats offer/commission; next step sits below empty panels; stage buttons have no verb.
- Raw ISO timestamps in lead/showing notes (`features/keystone/mutations/requestPropertyShowing.ts:142`, keystone side, out of design scope).

## Priority issues: storefront
- P1 no real search page: `/listings` redirects to `/#homes`; buyers need results with filters in the URL, sort, more than three results.
- P1 listing detail is thin: single photo, no price per sq ft, no days on market, no open house above the fold.
- P2 empty dark neighbourhood tile when no image (`HomePage.tsx:168`); three cards in a four-column grid; only two advisors shown.
- P2 account: pill tabs, a name eyebrow, duplicate "Browse homes" and "Sign out"; saved homes not the landing tab.
- P3 low-contrast hero eyebrow.

## Per-route main task (first 10 seconds)
listings: which listings need attention (partial) · listings/[id]: change status, see activity (mostly) · listings/new: enter a listing (served) · leads: who to contact next by age (not served) · leads/[id]: contact or advance (partial) · showings: which tours to confirm today (partial) · showings/[id]: confirm or cancel (served) · pipeline: which deals are stuck or closing soon (partial) · pipeline/[id]: next step to closing (partial) · tasks: what is due for me (not served) · people: agent workload (mostly) · routing: will new leads reach the right agent (500) · reports: funnel and agent performance (served) · operations: what blocks closings/compliance (not served) · store-settings: brand and contact (served; preview does not match the dark storefront).

## Persona red flags
- Broker (power user): no tables, bulk actions or keyboard path; one-at-a-time pill actions.
- New coordinator: "Open" and "Mark lost" look alike; stage buttons lack "Move to".
- Agent on phone: Leads is 3,800px tall; pipeline columns swipe with no cue; FAB overlaps right-column forms.
- Relocating buyer: no map or shareable search; renter: no rent results page.

Questions skipped: the owner ordered the redesign directly with no approval stops; all P0–P2 issues are in scope.
