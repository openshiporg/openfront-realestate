---
version: 1
slug: "features-platform"
primary_target: "features/platform"
related_targets: ["app/dashboard/(admin)/platform"]
---

# Platform pages (features/platform, /dashboard/platform/*)

Mode: Operate. Users: agents, brokers, coordinators. Inside the fixed shared dashboard shell, byte-identical to E-commerce; `components/ui/**` also shared (pass explicit radius classes, never edit).
Rules (owner, 2026-10-25): no pill or heavily rounded tabs, chips or cards; radii at most 6px (explicit `rounded-[6px]`, since the dashboard's `--radius` is 10px); flat underline tabs; dense tables with real status columns; each page opens on the operator's first-10-seconds task.

## Direction contract

THESIS: The call list. Every screen opens on who to contact, what to confirm and what is blocking a closing, and refuses the card-per-record-with-its-own-form template.

OWN-WORLD: The shell's neutral palette; status colour only where it carries meaning (dot + word); one sans with tabular numerals for prices, ages, dates and money; dense rows; flat 6px buttons with a filled ink primary; underline tabs with counts; record actions separated from navigation (one primary per row, destructive in a menu); forms behind the row action that needs them.

STORY: See the queue (leads by age, showings to confirm, deals by days in stage), act from the row, open a record only when needed.

FIRST VIEWPORT: Title with one truthful status and the primary action; underline tabs; then the work table. Leads: a "needs response" table sorted by age. Pipeline: stages as columns with days-in-stage, or a table grouped by stage, with a visible scroll cue. Operations: what is overdue or blocking first.

FORM: Extension of the established shell world. The concept roll was skipped on purpose: the owner's brief pins this surface's structure (task-first pages, dense tables with a status column, flat underline tabs, radii at most 6px), and a pinned brief outranks the roll. Owner's words (brief batches-2-6-full-redesign-2026-10-25.md): "No pill-shaped or heavily rounded tabs, chips or cards. Use tight radii (≤6px), flat or underline tabs, dense readable tables and lists, clear hierarchy, real status columns." and "Rebuild each page around the operator's main tasks (what they open it to do in the first 10 seconds), not around the data model." seed: seed:a18917bc9e82feaf (surface roll, run after the build was specified). It dealt my grounded structures 4 (a response queue sorted by waiting time), 1 (status tables with underline tabs) and 3 (tables grouped by stage) from: 1 status tables with underline tabs, 2 kanban by stage, 3 tables grouped by stage, 4 response queue sorted by waiting time, 5 list and detail split, 6 map of listings, 7 calendar of showings. The build carries all three: 4 on Leads, 3 on Pipeline, 1 on the other screens, inside the owner's pinned table-first structure. Signature move: lead age shown as a response clock that changes weight as a lead waits.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
