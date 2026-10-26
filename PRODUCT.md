# Product

<!-- impeccable:product-schema 1 -->

Inferred on 2026-10-25 from the repository and the owner's redesign brief (`Euler/state/briefs/batches-2-6-full-redesign-2026-10-25.md`). The owner ordered the work without an interview round; every fact below is taken from code, seed data or the brief.

## Platform

web

## Users
- **Agents** (dashboard, `/dashboard/platform/*`): work their leads (who to contact next), confirm and run showings, move deals through the pipeline, keep tasks.
- **Brokers / coordinators**: listings and their status, lead routing to agents, people and workload, operations (offers, closings, compliance), reports, brokerage settings.
- **Buyers and renters** (storefront): browse and search listings, view a listing, save homes, request a showing or ask a question, follow their showings and questions in an account. Often on a phone.

## Product Purpose
A self-hostable property-listing and brokerage-operations application: a public listings site plus the brokerage's leads, showings, offers, deals, documents, tasks and commission records.

## Operating Context
- Leads come from the website and other sources, are routed to agents by rules, and progress new → qualified → … or lost.
- Showings are requested, confirmed, completed or cancelled; deals move through stages to closing.
- Listings have status (coming soon, active, pending, sold, rental), price, facts (beds, baths, sq ft, lot, HOA, year), photos and an assigned agent.

## Capabilities and Constraints
- Next.js + Keystone 6. The shared dashboard shell (`features/dashboard/**`, `proxy.ts`, `app/dashboard/**` outside platform routes) and `components/ui/**` stay identical to Openfront E-commerce; in the dashboard scope `--radius` is 10px, so platform code uses explicit pixel radii.
- No new environment variables; onboarding/seed files are not edited by design work.
- Fair-housing obligations: the Equal Housing Opportunity notice stays.

## Brand Commitments
- The storefront brand is the brokerage's (name, logo, colours, market label, imagery from settings; demo: Juniper Realty, Austin TX, "Residences across Austin, chosen with care."). Design must work for any brokerage and market.
- Platform UI: no pill-shaped or heavily rounded tabs, chips or cards; radii ≤ 6px; flat or underline tabs (owner, 2026-10-25).

## Evidence on Hand
- Photography in `public/images/real-estate/photos/` (Austin skyline, listings, interiors, neighbourhood homes); SVG drawings for agents, neighbourhoods and properties.
- No real reviews, sales volumes, awards or market statistics; none may be invented.

## Product Principles
1. Agents open the product to know who to call and what is due; every screen leads with that.
2. Buyers search and compare first; persuasion comes from real listing facts and photos.
3. Truthful labels and states from real data.
4. Keep every route, state and workflow when changing presentation.
