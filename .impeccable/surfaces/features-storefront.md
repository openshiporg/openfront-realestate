---
version: 1
slug: "features-storefront"
primary_target: "features/storefront"
related_targets: ["app/(storefront)"]
---

# Storefront (features/storefront, app/(storefront))

Mode: Persuade on home; Operate on listing search/results, listing detail, account (saved, showings, questions, profile).
Audience: a buyer or renter on a phone or laptop in daylight, comparing homes in one market. Action in working form: search listings (filters that change results) from the first viewport, then request a showing from a listing.
Constraints: keep every route, state, workflow, loader, server action, form field and query param; the Equal Housing Opportunity notice stays; brokerage name/logo/colours/market label/images from settings; no invented claims (no sales volume, awards, ratings, market stats). /listings may become a real results page if the existing loaders support it (presentation of existing data and query params only).
Decision: owner ordered the redesign with no approval round (2026-10-25); assigned direction taken unattended, code-led (no image generation).

## Direction contract

THESIS: Built of the place. The houses this brokerage sells are Hill Country modern: standing-seam metal roofs, cedar, limestone and live oak. The site is built from those materials and their joinery, so browsing feels like walking a street of real houses, not a luxury magazine. It refuses the dark luxury-editorial brokerage (night ground, serif display, gold hairlines) and the generic hero-search-over-photo template.

OWN-WORLD: Ground of galvalume standing-seam metal: a cool light silver with a faint vertical seam rhythm, never cream. Cedar (deep red-brown) as the one warm accent and primary action colour, derived from the brokerage's colour where possible. Live-oak green for available/active state, a muted roof-rust for pending/under contract. Limestone appears only in photography. Type: a sturdy grotesk with a condensed cut for prices and facts (Google Fonts, not Inter/DM/Space/Plex/Instrument), set like stamped metal signage; numerals tabular. Square corners, 1px seam rules, no pills.

STORY: See homes right away with real facts; narrow by area, price, beds and buy/rent; open a listing that leads with its photos and facts; save it or request a showing; find it again in the account.

FIRST VIEWPORT: A metal header band (brokerage name, market label, Buy/Rent as square segmented control, account/saved). Directly below, a compact working search rail (area, price, beds, buy/rent) and the first row of results with photo, price, beds/baths/sq ft and status, so a buyer sees actual homes above the fold. One large featured photo may anchor the right side on desktop; on phones results start within the first viewport.

FORM: Candidate 6 of 7 (Hill Country modern materials), seed: seed:6fb81313bf9e1eb3. Japanese high-density site (challenger 3): competitive (wins product clarity, loses audience identification); kept as the results page's density: boxed modules packing price, $/sq ft when computable, beds, baths, sq ft, status and neighbourhood into each result, more results per screen. Ligne claire album: declined; raise: one unvarying line weight (1px seam) across rules, cards and icons. Cutting-bench select rail: declined; raise: state as a mark, a saved home carries a cedar flag tab. Streetwear quote grammar, paper menagerie, algorave: declined; raise: literal labels ("Homes for sale in Austin", "Under contract"). Signature interaction: the search rail stays sticky under the header as a metal rail; changing a filter updates the result count on the rail before results reload.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
