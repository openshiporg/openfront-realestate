---
name: Openfront Real Estate
description: A brokerage's listings site built of Hill Country materials, and the agents' call list behind it.
colors:
  galvalume: "oklch(90.5% 0.006 240)"
  galvalume-hi: "oklch(95.8% 0.004 240)"
  galvalume-lo: "oklch(86.5% 0.007 240)"
  seam: "oklch(77% 0.008 245)"
  seam-strong: "oklch(58% 0.01 245)"
  seam-light: "oklch(100% 0 0 / 0.42)"
  seam-dark: "oklch(30% 0.01 250 / 0.06)"
  roof: "oklch(29.5% 0.01 250)"
  roof-2: "oklch(36% 0.011 250)"
  roof-ink: "oklch(95% 0.004 240)"
  roof-muted: "oklch(79% 0.008 245)"
  ink: "oklch(23% 0.012 250)"
  ink-2: "oklch(37% 0.012 250)"
  muted: "oklch(44% 0.012 250)"
  cedar: "oklch(44% 0.11 38)"
  cedar-deep: "oklch(37% 0.1 38)"
  cedar-ink: "oklch(98.5% 0.004 60)"
  live-oak: "oklch(44% 0.085 145)"
  roof-rust: "oklch(49% 0.11 48)"
  steel: "oklch(44% 0.055 245)"
  closed: "oklch(44% 0.01 250)"
  cancelled: "oklch(47% 0.13 25)"
  error: "oklch(47% 0.15 27)"
typography:
  display:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "clamp(1.875rem, 3.4vw, 2.875rem)"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.005em"
  price:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "clamp(2.25rem, 4vw, 3rem)"
    fontWeight: 700
    lineHeight: 1
    fontFeature: "\"tnum\", \"lnum\""
  headline:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "clamp(1.5rem, 2.6vw, 2.125rem)"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.005em"
  title:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "1.625rem"
    fontWeight: 700
    lineHeight: 1
    fontFeature: "\"tnum\", \"lnum\""
  plate:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.02em"
  body:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.3
  platform-title:
    fontFamily: "dashboard shell sans"
    fontSize: "1.375rem"
    fontWeight: 600
    letterSpacing: "-0.025em"
  platform-body:
    fontFamily: "dashboard shell sans"
    fontSize: "0.875rem"
    fontWeight: 400
    fontFeature: "\"tnum\""
  platform-label:
    fontFamily: "dashboard shell sans"
    fontSize: "0.75rem"
    fontWeight: 500
rounded:
  none: "0px"
  platform-item: "4px"
  platform: "6px"
spacing:
  seam: "1px"
  control: "2.75rem"
  gutter: "clamp(1rem, 3.2vw, 2rem)"
  seam-gap: "3.25rem"
  header: "3.5rem"
  header-lg: "4rem"
  rail: "4.75rem"
  rail-lg: "4.5rem"
  container: "84rem"
  section: "clamp(3rem, 6vw, 4.5rem)"
  platform-control: "2rem"
  platform-row: "0.625rem 0.75rem"
components:
  button-primary:
    backgroundColor: "{colors.cedar}"
    textColor: "{colors.cedar-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "0 1.125rem"
    height: "{spacing.control}"
  button-primary-hover:
    backgroundColor: "{colors.cedar-deep}"
    textColor: "{colors.cedar-ink}"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "0 1.125rem"
    height: "{spacing.control}"
  button-quiet-hover:
    backgroundColor: "{colors.galvalume-hi}"
  field:
    backgroundColor: "{colors.galvalume-hi}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "0 0.75rem"
    height: "{spacing.control}"
  segment-item:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.none}"
    padding: "0 1rem"
    height: "{spacing.control}"
  segment-item-active:
    backgroundColor: "{colors.roof}"
    textColor: "{colors.roof-ink}"
  plate-active:
    backgroundColor: "{colors.live-oak}"
    textColor: "{colors.roof-ink}"
    typography: "{typography.plate}"
    rounded: "{rounded.none}"
    padding: "0.125rem 0.5rem"
  plate-pending:
    backgroundColor: "{colors.roof-rust}"
    textColor: "{colors.roof-ink}"
    typography: "{typography.plate}"
    rounded: "{rounded.none}"
    padding: "0.125rem 0.5rem"
  plate-soon:
    backgroundColor: "{colors.steel}"
    textColor: "{colors.roof-ink}"
    typography: "{typography.plate}"
    rounded: "{rounded.none}"
    padding: "0.125rem 0.5rem"
  plate-closed:
    backgroundColor: "{colors.closed}"
    textColor: "{colors.roof-ink}"
    typography: "{typography.plate}"
    rounded: "{rounded.none}"
    padding: "0.125rem 0.5rem"
  save-flag:
    backgroundColor: "{colors.galvalume-hi}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    size: "2.75rem"
  save-flag-saved:
    backgroundColor: "{colors.cedar}"
    textColor: "{colors.cedar-ink}"
    height: "3.25rem"
    width: "2.75rem"
  result-module:
    backgroundColor: "{colors.galvalume-hi}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "0.75rem 0.875rem 0.875rem"
  roof-band:
    backgroundColor: "{colors.roof}"
    textColor: "{colors.roof-ink}"
    height: "{spacing.header}"
  search-rail:
    backgroundColor: "{colors.galvalume-lo}"
    textColor: "{colors.ink}"
    padding: "0.625rem 0"
  platform-button:
    rounded: "{rounded.platform}"
    padding: "0 0.75rem"
    height: "{spacing.platform-control}"
  platform-menu-item:
    rounded: "{rounded.platform-item}"
---

# Design System: Openfront Real Estate

## Overview

**Creative North Star: "Built of the place"**

Two worlds share one product. The storefront is built from the materials of the houses it sells: standing-seam galvalume for the ground, a charcoal metal roof band for the header and footer, cedar for the one warm action, live oak and roof rust for the state of a home. Limestone appears only in photography. Type is set like stamped metal signage: Barlow for reading, Barlow Condensed for prices, facts and plates, every numeral tabular. Corners are square and every rule, module edge and icon stroke is one 1px seam. The site refuses the dark luxury-editorial brokerage (night ground, serif display, gold hairlines) and the hero-search-over-photo template; a buyer sees real homes with real facts in the first viewport.

The platform is "the call list". It lives inside the shared dashboard shell, which is untouched and byte-identical to Openfront E-commerce, and takes the shell's neutral palette as its own. Each screen opens on who to contact, what to confirm and what is blocking a closing: a title with one truthful status, underline tabs with counts, then a dense work table. Colour appears only where it carries meaning, as a dot beside a word. Controls are flat 6px pieces with a filled ink primary.

The two worlds never borrow from each other. Galvalume, cedar and Barlow stay inside `.storefront-root`; the platform never reaches for them.

**Key Characteristics:**
- Cool silver galvalume ground with a faint vertical standing-seam rhythm (storefront).
- Charcoal roof band at the top and bottom of every storefront page.
- Cedar is the only warm accent and the only primary action colour; it follows the brokerage's hue within a narrow red-brown band.
- Status is a coloured plate bound to the listing's state, never to position.
- Square corners and one 1px seam weight across the storefront.
- Barlow / Barlow Condensed with tabular lining numerals for every price, count and fact.
- Platform: shell neutrals, explicit 6px and 4px radii, underline tabs, dense tables, dot plus word.

## Colors

A cool, near-neutral metal palette with one warm wood accent and three muted state colours; all values are OKLCH and the frontmatter is canonical.

### Primary
- **Cedar** (default hue 38): the primary action fill (Request a showing, submit), the saved flag, focus outlines, text selection, the active tab underline, the selected gallery thumbnail ring, and the count badges on Saved and More filters. Its hue is derived from the brokerage: `38 + (brandHue - 151) * 0.1`, where `brandHue` comes from the brokerage's logo colour, so a green brokerage and a blue brokerage get slightly different cedars but both stay red-brown. Lightness and chroma never move.
- **Cedar Deep**: hover of the primary, and the colour of inline text links and link hovers on metal.
- **Cedar Ink**: text on cedar.

### Secondary
- **Live Oak**: the Active / available plate, open-house lines, success messages.
- **Roof Rust**: the Pending / under-contract plate.
- **Steel**: the Coming soon plate.
- **Closed** and **Cancelled**: sold or off-market plates and cancelled showings. **Error** is reserved for form messages.

### Neutral
- **Galvalume**: the page ground, painted with the standing-seam gradient (a lit edge then a shadow edge every seam-gap).
- **Galvalume Hi**: modules, panels, fields, segmented tracks: the lighter sheet laid on the ground.
- **Galvalume Lo**: the sticky search rail and the place plate.
- **Seam** / **Seam Strong**: 1px module joints and fact dividers / control borders, the rail's bottom edge, account tab rule.
- **Roof** / **Roof 2**: header band, footer, sticky showing bar, gallery plaque, open-house date block, photo windows before they load; Roof 2 is the hover and divider on the roof. **Roof Ink** / **Roof Muted** are text on the roof.
- **Ink** / **Ink 2** / **Muted**: primary text, secondary text and labels, tertiary text (place lines, per-foot prices).
- **Platform**: the dashboard shell's own tokens (`foreground`, `background`, `muted`, `border`, `destructive`); the platform defines no colours of its own except Tailwind status dot hues (emerald, sky, blue, amber, indigo, violet, fuchsia, rose, zinc at 500 / zinc 400).

### Named Rules
**The One Warm Material Rule.** Cedar is the only warm colour that acts. Rust and oak describe a state; they are never buttons, links or highlights.

**The State-Bound Plate Rule.** A plate's colour comes from the listing's status (active, pending, soon, closed, cancelled) and nothing else; a featured or first result gets the same plate as any other.

**The Shell Palette Rule.** Platform screens use the dashboard shell's neutrals; colour appears only where it carries meaning, as a status dot or a response clock past its threshold.

## Typography

**Display Font:** Barlow Condensed (with Arial Narrow, sans-serif), weights 500/600/700
**Body Font:** Barlow (with system-ui, sans-serif), weights 400/500/600
**Platform Font:** the dashboard shell's sans, unchanged

**Character:** Barlow was drawn from highway and rail signage; the regular cut reads like a sturdy grotesk, the condensed cut packs prices and facts like stamped metal plates.

### Hierarchy
- **Display** (Barlow Condensed 700, clamp(1.875rem, 3.4vw, 2.875rem), 1): the literal results heading, e.g. "Homes for sale in Austin".
- **Price** (Barlow Condensed 700, clamp(2.25rem, 4vw, 3rem), 1): the listing detail price on the sign plate; the listing title above it runs clamp(1.75rem, 3vw, 2.375rem).
- **Headline** (Barlow Condensed 700, clamp(1.5rem, 2.6vw, 2.125rem), 1.05): section titles.
- **Title** (Barlow Condensed 700, 1.625rem, 1): result module price and key-fact values; 1.375rem in a phone row, 1.75rem in a row from 40rem. Fact numbers inside a module are 1.0625rem condensed bold with the unit in Barlow.
- **Plate** (Barlow Condensed 600, 0.9375rem, +0.02em): status plates, the Buy/Rent segment (1.0625rem), the rail count, the gallery plaque, account tabs (1.125rem).
- **Body** (Barlow 400, 1rem, 1.5): running text; listing description at 1.0625rem / 1.6 capped at 68ch. Module titles are Barlow 600 1rem / 1.3.
- **Label** (Barlow 600, 0.75rem): rail field labels and key-fact terms; form labels are 0.875rem 600 in Ink 2.
- **Platform** (shell sans): page title 600 at 1.25rem rising to 1.375rem at md; body and tables 0.875rem; column heads 0.75rem 500 in muted on a muted/40 band; response clock and ages 13px.

### Named Rules
**The Tabular Rule.** Every price, $/sq ft, bed/bath/sq ft count, result count, date and age is set with tabular lining numerals (`.sf-num` on the storefront, `tabular-nums` on the platform) so columns of figures align.

**The Stamped Figures Rule.** On the storefront, numbers are condensed and bold, their units are not: "**3** bd", "$1,250,000 $412/sq ft" with the per-foot figure in 500 Muted.

## Layout

Storefront: a centred container of 84rem with a fluid gutter (clamp(1rem, 3.2vw, 2rem)). The roof band is sticky at the top (3.5rem, 4rem from 64rem). The search rail is sticky directly beneath it. Breakpoints are 30rem, 40rem, 56rem and 64rem; 64rem is the desktop switch (header nav, full rail, featured panel, sticky detail aside). Sections open with clamp(3rem, 6vw, 4.5rem) of space.

Results come in two arrangements. **Rows** (home page) put a fixed photo bay (8.5rem, 15rem from 40rem) beside the body in a stack joined by 1px seams. **Modules** (/listings, saved homes) are an auto-fit grid of minimum 16.5rem with 1px gaps, each module outlined in Seam so joints are shared and a short row never leaves an empty bay; the grid's width is capped at `count x 28rem` so one or two results do not become billboards. Without a featured panel, rows hold a 60rem measure.

On the home page at 64rem the rows sit beside a featured panel (1.6fr : minmax(19rem, 1fr)); the panel stretches exactly as tall as the rows, its photo filling the bay, so the section ends with its last row. On phones, results start inside the first viewport.

Listing detail opens on a seam-joined pair at 64rem (gallery 1.7fr, sign plate minmax(21rem, 1fr)); below, the description and facts sit beside a sticky aside of panels. On phones a sticky roof-coloured showing bar holds the price and the action at the bottom and slides away when the in-page form is in view.

The standing seams repeat every 3.25rem across the full viewport, independent of the container and the module grid, so seams and module joints do not line up. This is the built state, left open at the finish review as a ceiling note; it is not a rule that future surfaces should copy or must fix.

Platform: the shell's page frame (px-4, md:px-6, py-5); header with title, meta and actions, then a toolbar row of tabs and search (max 24rem), then the table. Narrow rows wrap rather than clip.

### Named Rules
**The Shared Seam Rule.** Panels of modules share their 1px seams (1px gap over a Seam background, or a Seam outline per module); two adjacent borders never double up into a 2px line.

**The Featured Panel Rule.** The featured panel never repeats a row beside it. It shows a photographed home from outside the visible rows; with a short inventory it takes the first photographed home out of the rows instead, so no home appears twice in one viewport.

## Elevation & Depth

The storefront is flat sheet metal. Depth comes from tone (Galvalume Lo rail, Galvalume ground, Galvalume Hi sheets, Roof bands) and from the seam rhythm, not from lifted cards. Exactly one ambient shadow exists: a soft underside on the sticky search rail so results visibly pass beneath it. Photos may scale very slightly on hover (1.02 in modules, 1.015 on the featured panel). The selected gallery thumbnail carries an inset 2px cedar ring.

The platform is flat: `flatReset` strips the shared Button's gradient, bottom bevel, inset ring, drop shadow and brightness filters, so every control reads as a flat bordered or filled 6px piece. Sheets and menus keep the shell's own overlay treatment.

### Shadow Vocabulary
- **Rail underside** (`box-shadow: 0 6px 12px -10px oklch(23% 0.012 250 / 0.35)`): the sticky search rail only.
- **Selected thumbnail** (`box-shadow: inset 0 0 0 2px var(--sf-cedar)`): the current photo in the gallery strip.

### Named Rules
**The Flat Sheet Rule.** Storefront modules, panels and buttons carry no drop shadow; stacking is shown by tone and by the sticky rail's single underside.

## Shapes

Storefront corners are square everywhere (0px): buttons, fields, segmented tracks, plates, modules, panels, photo windows, the sign plate. One line weight, 1px, draws every rule, module joint, control border and fact divider; Lucide icons are drawn at stroke 1.25 with non-scaling strokes so they match the seam. The only non-rectangular silhouette is the saved flag: a square that, once saved, lengthens and gets a notched tail (a cedar tab hanging from the module's top edge). Focus is a 2px cedar outline at 2px offset (inset by 1px on fields).

Platform radii are explicit pixels because the dashboard's `--radius` is 10px: 6px on buttons, link-tabs-as-buttons, search and form fields, tables, section cards, notices and empty states; 4px on dropdown menu items and checkboxes. Status dots and people avatars are circles; nothing else is.

### Named Rules
**The Explicit Radius Rule.** Platform code always writes `rounded-[6px]` or `rounded-[4px]`; it never relies on `rounded-md`/`rounded-lg`, which inherit the shell's 10px.

## Components

### Buttons
- **Shape:** square (0px), 2.75rem minimum height, 1px border.
- **Primary:** Cedar fill, Cedar Ink text, Barlow 600 0.9375rem, padding 0 1.125rem.
- **Hover / Focus / Active:** Cedar Deep on hover; 2px cedar focus outline; press scales to 0.97 over 160ms on cubic-bezier(0.23, 1, 0.32, 1).
- **Quiet:** transparent with a Seam Strong border; hover lifts to Galvalume Hi with an Ink 2 border.
- **Icon button:** 2.75rem square, Galvalume Hi, Seam Strong border.
- **Link:** Cedar Deep, 600, a 1px underline at 45% cedar that goes solid on hover.
- **Platform:** `pillClass` (bordered, background fill, hover muted/60) and `pillPrimaryClass` (filled ink `foreground` with `background` text), both h-8 with 6px radius and `flatReset`; `pillDangerClass` only inside confirmation dialogs; `quietButtonClass` for row menus and close buttons. The class names are kept from an earlier pill kit; the shapes are flat.

### Segmented controls
- **Style:** a Galvalume Hi track with a Seam Strong 1px border, items divided by 1px seams; on the roof, the Buy/Rent segment uses a 28% white border.
- **State:** the selected item is filled Roof with Roof Ink (on the roof band the current item flips to Galvalume Hi with Ink). Used for Buy/Rent, visit type, and sign in / create account.

### Status plates
- **Style:** a square plate in Barlow Condensed 600, Roof Ink on the state colour: Live Oak (active), Roof Rust (pending / under contract), Steel (coming soon), Closed, Cancelled. Literal labels ("Under contract").
- **Placement:** pinned to the bottom-left corner of the photo window, flush, in modules, rows, the featured panel and the sign plate.

### Result module and row
- **Anatomy:** photo window (3:2, Roof seam fill behind it) with the plate bottom-left and the save flag hanging from the top edge, then a body on Galvalume Hi: price line (condensed price, $/sq ft in Muted when computable), facts list (beds, baths, sq ft; values condensed bold, divided by 1px seams), Barlow 600 title whose link covers the whole module, then the place line (neighbourhood | city, seam-divided) in Muted 0.8125rem.
- **Focus:** the whole module takes the cedar outline when its title link is focused.
- **Row variant:** photo bay at the side; on phones the save flag moves to the photo's top-right inner corner.

### Search rail
- **Style:** a sticky Galvalume Lo rail under the roof with a Seam Strong bottom edge and the single rail shadow. Area field, then price, beds, baths and Buy/Rent selects, then the live count and the search button.
- **Live count:** the result count ("24 homes") sits on the rail in Barlow Condensed 600 as an `aria-live` output. Changing a select reloads the results at once; while pending the count reads "Updating", dims to 60% with a 0.4px blur, and the main content fades to 55%.
- **Phones:** the filters fold behind a More button carrying a cedar badge with the active-filter count; it turns Roof when open. The full row shows from 64rem.

### Saved flag
- **Default:** a 2.75rem square on Galvalume Hi with a Seam Strong border and no top border, hanging from the module's top edge; hover tints the icon cedar.
- **Saved:** the flag lengthens to 3.25rem, fills Cedar, fills its icon, and its bottom becomes a notched tail; 200ms ease-out, no transition under reduced motion.

### Place plate and photo fallback
- **Photo fallback:** where a home has no photo, the window is a Roof seam panel with a 1px line drawing of a house, the address in condensed bold and the note "Photos coming" in Roof Muted. It is a deliberate plate, never an empty frame.
- **Place plate:** where an area has no photo, a Galvalume Lo plate stamps the area name in condensed uppercase with its city and a seam-joined facts block (home counts, price figures); on phones it compacts to a square plate beside the name.

### Gallery
- **Stage:** a 3:2 photo window with a short 240ms fade between photos (none under reduced motion), and a Galvalume Hi control block flush at the bottom-right: previous, "3 / 12" in condensed figures, next.
- **Plaque:** a Roof strip under the stage in condensed 600 carrying the caption and the photo count.
- **Strip:** thumbnails 6.5rem wide at 3:2, seam-joined, scroll-snapping sideways; the current one at full opacity with the inset cedar ring, others at 80%.
- **Empty:** the stage shows the photo fallback.

### Inputs / Fields
- **Style:** square, 2.75rem, Galvalume Hi fill, Seam Strong 1px border, Barlow 1rem in Ink; hover borders Ink 2.
- **Focus:** 2px cedar outline inset by 1px and a near-white fill.
- **Selects:** native appearance off, a drawn chevron in currentColor.
- **Date and time:** the showing request's datetime field is prefilled with the earliest bookable half hour inside showing hours, so it carries a real value instead of the browser's placeholder grey. Every segment is painted Ink with Ink 2 separators, the focused segment turns Cedar with Cedar Ink, and the picker icon is rendered as a solid ink mark at 78% opacity.
- **Platform fields:** h-9, 6px, the shell's `input` border, a 3px ring at focus.

### Navigation
- **Roof band:** brokerage lockup (logo on a Galvalume Hi square, condensed name, market label in Roof Muted), the Buy/Rent segment, then at 64rem text links in Roof Muted that go Roof Ink on hover or current, and a bordered account/Saved block with a cedar count badge. On phones a 2.75rem toggle opens a stacked list of condensed 1.25rem links.
- **Account tabs (storefront):** condensed 600 1.125rem links on a Seam Strong rule; the current tab gets a 3px cedar underline.
- **Platform tabs:** underline tabs (h-9, 0.875rem 500, 2px `foreground` underline when active, counts in tabular 0.75rem). From md the row wraps onto a second line so every tab stays visible; on phones it scrolls sideways with a thin visible scrollbar and a right-edge fade as the cue. A short vertical divider can separate a second group (scope, then status) on the same rule.

### Footer and Equal Housing notice
The footer is the roof again: Roof seam band, brand column and three link columns from 64rem. The legal line carries the Equal Housing Opportunity notice with its 1px house-and-equals mark in Roof Ink on every storefront page. It is a fair-housing obligation and is never removed or hidden.

### Platform dense table
- **Style:** a 6px bordered wrap that scrolls horizontally; head row h-9 on muted/40 with 0.75rem 500 muted labels; cells px-3 py-2.5, top-aligned, 1px row rules, last row unruled.
- **Status:** a 2px-ringed 8px dot plus the status word; never a filled chip.
- **Phone row:** below md the table collapses to its first cell. Status and the md-only columns fold into that cell, and the row's primary action sits on a full-width line beneath the content, with the More menu at its end.
- **Ages:** the listings table shows "Updated" (from xl) because there is no listing date. The pipeline shows days since the deal last changed: a fresh deal shows the date, from a week idle the day count appears and gets heavier, and an open deal idle 30 days or more turns destructive.

### Response clock (platform signature)
Lead age as time since received or last contacted ("12m", "5h", "3d"), in 13px tabular figures. While a lead waits for a response the clock gets heavier in steps: normal and muted under 1h; medium under 4h; semibold under 24h; bold amber-700 under 3 days; bold destructive beyond. Its clock icon's stroke thickens with it (1.5 to 3). A lead that is not waiting shows a plain muted age.

### Record actions
One primary action per row; everything else is in a More menu (4px items). Destructive actions ("Mark lost", "Suspend access") come last, after a separator, in the destructive variant, and confirm in a dialog with the danger button. Record forms open in a right-hand sheet (full width on phones, max 32rem) behind the header or row button that needs them; pages never carry a card per record with its own inline form.

## Do's and Don'ts

### Do:
- **Do** keep every storefront corner square (0px) and every rule, joint and border 1px.
- **Do** derive cedar's hue from the brokerage hue and keep its lightness and chroma fixed, so any brokerage's site keeps a red-brown action.
- **Do** bind plate colour to listing state: Live Oak active, Roof Rust pending, Steel coming soon, Closed for the rest.
- **Do** set every price, count, date and age in tabular lining numerals.
- **Do** use literal labels from real data ("Homes for sale in Austin", "Under contract", "Photos coming").
- **Do** show the photo fallback plate or the place plate where a photo is missing, never an empty window.
- **Do** keep the featured panel off the rows it stands beside.
- **Do** prefill time fields with a real value so they read in Ink, not placeholder grey.
- **Do** keep the Equal Housing Opportunity notice in the footer of every storefront page.
- **Do** write explicit `rounded-[6px]` (controls, tables, cards) and `rounded-[4px]` (menu items, checkboxes) in platform code, with `flatReset` on every shared Button.
- **Do** show platform status as a dot plus a word, and put record forms in sheets behind the button that needs them.
- **Do** put destructive actions last in a row menu, behind a separator and a confirmation.

### Don't:
- **Don't** use cream, beige or a dark night ground on the storefront; the ground is cool galvalume.
- **Don't** use serif display type or gold hairlines anywhere in the storefront.
- **Don't** use cedar for anything that is not an action, a saved mark, focus or the current-tab underline; don't use rust or oak as buttons.
- **Don't** give storefront modules or buttons drop shadows; the rail's underside is the only ambient shadow.
- **Don't** use pill-shaped or heavily rounded tabs, chips, buttons or cards on either surface, or rely on the shell's 10px `--radius` in platform code.
- **Don't** invent claims (sales volume, awards, ratings, market statistics) or a days-on-market figure the data cannot support.
- **Don't** edit the shared dashboard shell or `components/ui/**`; adapt by passing classes.
- **Don't** colour a platform status as a filled chip; colour lives in the dot.
