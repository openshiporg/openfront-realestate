# Openfront Real Estate — schema map

Source: `features/keystone/models/**` (44 lists), `features/keystone/mutations/**` (custom commands and projections), `features/keystone/access.ts`, and the onboarding seeds in `features/platform/onboarding/lib/*.json`.

## Tenancy
- Every operational record belongs to one `Brokerage`. Either a `brokerage` field is set directly, or it is derived from a parent by `createTenantOwnedHooks`, for example property → media, deal → inspection.
- Access is scoped by `activeBrokerageIds(session)`: the selected brokerage, or the user's single live membership.
- Role flags decide who can do what:
  - `canManageListings`, `canManageLeads`, `canManageShowings`, `canManageDeals`: work on records.
  - `canManagePeople`: brokerage-wide work, as opposed to assigned-only.
  - `canViewReports`: reports.
- Storefront customers are `User` rows with an `activeBrokerage` and **no** membership. They own their own `Showing`, `LeadActivity` (inquiries), `SavedProperty` and `SavedSearch` rows through server-set relations, never by matching an email.

## Lists

| List | Purpose in the business | Key fields | Relationships | Created by | States / transitions |
|---|---|---|---|---|---|
| Brokerage | The tenant: one brokerage per storefront | name, slug, status, isPrimary | every operational list | System (init/onboarding) | active / suspended / archived |
| BrokerageSettings | Storefront identity and showing length | businessName, marketLabel, city, state, tagline, publicPhone/Email, showingDurationMinutes, logoIcon, logoColor | brokerage | Merchant (Store Settings) | — |
| BrokerageMembership | A person's seat and role in a brokerage | membershipRole (owner…analyst), status, isPrimary | brokerage, user | Merchant (`inviteBrokerageMemberCommand`), system (init) | invited → active → suspended |
| User | Staff and storefront customers | name, email, phone, licenseNumber, brokerageTitle, avatarUrl, role, activeBrokerage | many: assigned properties/leads/showings/deals, memberships, customer showings/inquiries, saved homes | Merchant (invite), customer (sign-up), system (init) | onboardingStatus |
| Role | Permission bundle | can* flags | users | Merchant | — |
| AgentTeam | Listing, buyer or rental team | name, teamType, status, leadAgent | members, leads, deals, routing rules | Merchant | active / paused / archived |
| Property | A listing for sale or rent | title, slug, status, listingType, propertyType, address, price, beds/baths/sqft, hoaFee, availableAt, leaseTerm, securityDeposit, petPolicy, primaryImageUrl, isFeatured | brokerage, assignedAgent, leads, showings, savedBy, authorities | Merchant | draft → coming_soon → active ⇄ pending → sold / rented; any → off_market (`transitionPropertyStatus`) |
| PropertyMedia | Photos, floor plans, tours and video for a listing | title, mediaType, url, altText, caption, sortOrder, isHero | property | Merchant | — |
| OpenHouse | A public open house | title, startsAt, endsAt, attendeeCount, notes | property, hostAgent | Merchant | scheduled → completed / cancelled (`transitionOpenHouseStatus`) |
| ListingSyndication | Listing pushed to MLS or portals | channel, status, externalListingId, listingUrl, errorMessage | property | Merchant | draft → published / error / removed (`transitionListingSyndicationCommand`) |
| ListingEngagementAuthority | Signed listing agreement (seller authority) | authorityNumber, status, effective dates, marketing/showing authorized, documentSha256 | property, assignedPractitioner, supersedes | Merchant (`recordListingEngagementAuthorityCommand`) | executed / revoked / expired (append-only) |
| ListingPublicationAuthority | Right to publish to a destination | destination (public_site, mls, idx, syndication), status, effective dates | property, engagement | Merchant (command) | authorized / revoked / expired |
| PractitionerLicenseAuthority | Verified agent license per state | licenseNumber, licenseType, jurisdictionCode, status | practitioner, verifiedBy | Merchant (command) | verified_active / restricted / … / revoked |
| RepresentationAuthority | Buyer or seller representation agreement | side, relationshipType, status, effective dates | lead, property, deal, practitioner | Merchant (command) | executed / terminated / expired |
| Lead | A buyer, renter or seller contact | name, email, phone, status, intent, source, budget, timeline, message, identityKey | property, assignedAgent, assignedTeam, showings, activities | Customer (inquiry or showing form), merchant | new → attempted_contact → qualified → tour_scheduled → offer → closed / lost (`transitionLeadStatus`) |
| LeadActivity | Timeline entry on a lead | activityType, direction, channel, subject, body, occurredAt | lead, property, showing, agent, customer | System (forms), merchant (`addLeadActivityCommand`) | — |
| LeadRoutingRule | Auto-assign new leads | name, status, priority, intent, source, city, state, postalCode, isFallback | assignedAgent, assignedTeam | Merchant | active ⇄ paused |
| Showing | A tour request or booked tour | status, showingType, scheduledStart/End, notes, feedback, requestSnapshot | property, lead, assignedAgent, customer | Customer (Tour form), merchant (`scheduleShowingForLeadCommand`) | requested → scheduled → completed / no_show; requested or scheduled → cancelled (merchant `transitionShowingStatus`, customer `cancelCustomerShowing`) |
| ShowingFeedback | Structured feedback after a tour | rating, interestLevel, comments, priceOpinion, followUpRequired | showing, lead, property | Merchant (`completeShowingWithFeedback`) | — |
| SavedProperty | A shopper's saved home | status (saved, interested, hidden), notes | property, user | Customer (`savePropertyForCurrentUser`) | — |
| SavedSearch | A shopper's saved search | name, keywords, listingType, propertyType, price range, minBedrooms, minBathrooms, alertsEnabled | user, brokerage | Customer (`saveSearchForCurrentUser`) | — |
| SavedSearchAlert | Alert schedule for a saved search | status, cadence, lastSentAt, sentCount | savedSearch, user | Merchant or system (`queueSavedSearchAlertCommand`) | active / paused / unsubscribed |
| Deal | One transaction for a client | title, stage, transactionType, offerAmount, commissionAmount, expectedCloseDate, nextStep, notes | property, lead, assignedAgent, assignedTeam, authorities, ledger | Merchant | prospecting → active_search → offer_drafted → under_contract → inspection / financing → closed_won; any open → closed_lost (`transitionDealStage`) |
| Offer | An offer or counter on a deal | offerNumber, version, status, amount, earnestMoney, financingType, contingencies, responseDueAt | deal, property, lead, parentOffer / counterOffers, assignedAgent | Merchant (`createOfferCommand`, `createCounterOfferCommand`) | draft → submitted → countered / accepted / rejected / withdrawn (`transitionOfferStatus`) |
| TransactionMilestone | Closing checklist item | name, status, dueAt, sortOrder, notes | deal, assignedTo | Merchant (`createChecklistItemCommand`) | not_started → in_progress → complete; blocked (`transitionTransactionMilestoneStatus`) |
| DealDocument | Agreement, disclosure, report or statement | title, documentType, status, fileUrl, requiresSignature, sent/signed/expires | deal, property, uploadedBy, evidence | Merchant | draft → sent → signed → archived (`transitionDocumentCommand`) |
| DocumentEvidenceEvent | Append-only proof of document events | eventType, documentSha256, channel, provider, occurredAt | document, deal, offer, actor | Merchant (`appendDocumentEvidenceEventCommand`) | append-only |
| Disclosure | Required disclosure to the client | title, disclosureType, status, documentUrl | property, deal | Merchant | draft → sent → acknowledged; expired (`transitionDisclosureStatus`) |
| PropertyInspection | Inspection or appraisal | title, inspectionType, status, scheduledAt, inspectorName, estimatedCost, summary, findings | property, deal | Merchant | scheduled → completed / needs_follow_up / waived (`transitionInspectionCommand`) |
| Escrow | Escrow account for a deal | escrowNumber, status, escrowCompany, officer, openedAt, scheduledCloseAt, depositAmount | deal, property | Merchant | opened → pending → closed / cancelled |
| TitleOrder | Title search for a deal | orderNumber, titleCompany, status, exceptions | deal, property | Merchant | ordered → in_review → clear / exception |
| MortgageApplication | Buyer financing | applicationNumber, lenderName, status, loanAmount, interestRate | deal, lead | Merchant | started → preapproved → underwriting → approved / denied |
| Commission | Expected and paid commission per side | title, status, side, grossCommission, splits, netCommission, paidAt | deal, property, agent, ledgerEntries | Merchant | projected → approved → paid; clawed_back (`transitionCommissionStatus`) |
| CommissionLedgerEntry | Append-only commission ledger | entryType, allocationType, amountCents, payee, approvedBy | commission, deal, reverses | Merchant (propose, approve, receipt, reverse and reconcile commands) | append-only |
| AgentTask | A to-do for an agent | title, status, priority, dueAt, notes | assignedAgent, property, lead, deal | Merchant | open → in_progress → done; blocked (`transitionAgentTaskCommand`) |
| MarketComp | Comparable sale or listing for pricing | address, status, listPrice, salePrice, soldAt, beds/baths/sqft, distance | subjectProperty, neighborhood | Merchant | — |
| PropertyValuation | CMA, appraisal or AVM value | valuationType, low/estimated/high, valuedAt | property, performedBy | Merchant | — |
| Neighborhood | Market facts for an area | name, city, overview, schoolDistrict, scores, medians, activeListings | marketComps | Merchant (market intelligence) | — |
| SourceFeed | Listing import feed (RETS, RESO, CSV) | provider, feedType, status, lastImportedAt, recordsImported | brokerage | Merchant | active / paused / error (`queueSourceImportCommand`) |
| RetentionPolicy | Record-retention rule per class | retentionClass, triggerType, retentionDays, disposition | approvedBy, supersedes | Merchant (`recordRetentionPolicyCommand`) | append-only |
| TransactionFileEvent | Retention, hold and export events on a deal file | eventType, triggerAt, disposeAfter, holdKey, manifest | deal, document, policy | Merchant (retention, hold and export commands) | append-only |
| DomainOutboxEvent | Outbox for side effects and receipts | eventType, status, attempts, lastError | brokerage | System | pending → processing → dispatched / failed (`replayDomainOutboxEvent`) |
| DomainAuditEvent | Audit trail of CRUD and commands | aggregateType, action, before/after | brokerage, actor | System | append-only |

## Merchant workflows

1. **List a home.** Create the Property (draft), add PropertyMedia, record ListingEngagementAuthority and ListingPublicationAuthority (public_site), then publish (coming_soon → active). Optionally add ListingSyndication and schedule an OpenHouse.
2. **Capture and work a lead.** The storefront question or tour form, or manual entry, creates a Lead with a LeadActivity. LeadRoutingRule assigns it to an agent or team. The agent works the activity timeline, runs status transitions and resolves duplicates.
3. **Tour a home.** A Showing is requested by the customer or scheduled by the agent. The agent confirms it (scheduled) and completes it with ShowingFeedback, or marks it no-show or cancelled. The lead status follows (tour_scheduled).
4. **Run a deal to close.** Create a Deal from the lead and property, record RepresentationAuthority, then Offer → counter → accepted. Next come TransactionMilestones, DealDocuments with evidence, Disclosures, PropertyInspection, MortgageApplication, TitleOrder and Escrow, and finally closed_won. The listing becomes sold or rented.
5. **Get paid.** Create a Commission (projected), then use the CommissionLedgerEntry allocation, approval, receipt and reconciliation commands, and mark it approved → paid.
6. **Run the team.** Invite and suspend BrokerageMemberships, manage AgentTeams and PractitionerLicenseAuthority, create AgentTasks and set up LeadRoutingRules.
7. **Price and market.** Add MarketComps and PropertyValuations, look after Neighborhood facts, and manage SourceFeed imports and SavedSearchAlerts.
8. **Keep records.** Use RetentionPolicy and TransactionFileEvent (retention, legal hold, export). The DomainOutboxEvent queue and its replay sit alongside them.
9. **Brand the storefront.** Edit BrokerageSettings in Store Settings, and run onboarding.

## Customer workflows

1. **Browse.** Home search with filters and sort → listing detail (photos, facts, rental terms, open houses, advisor).
2. **Tour.** Tour form → Showing (requested) → "Request sent" → My showings, where the customer can cancel.
3. **Ask.** Question form → Lead plus LeadActivity, linked to the account when signed in → Questions tab.
4. **Save.** Heart → SavedProperty, and Save search → SavedSearch. Both appear on the Saved tab.
5. **Account.** Sign up, sign in, password reset, and Profile.

## Coverage

"Before" is the platform at `ffc683f`. "After" is this coverage pass. Generic Keystone list pages (`/dashboard/<list>`) don't count as a platform page.

| Workflow / list | Before | After |
|---|---|---|
| Property (list, status) | `/platform/listings` (listings): list, status tabs and status actions | unchanged |
| Property (create, edit, detail) | **THIN**: linked out to the generic Keystone forms, with no detail page | `/platform/listings/new`, and `/platform/listings/[id]` (detail, edit, status track) |
| PropertyMedia | **MISSING** | On listing detail: add by URL, set cover, reorder and remove. The storefront only shows images under `/images/real-estate/`, because this vertical has no upload storage. |
| OpenHouse | **THIN**: one section of operations; the only actions were complete and cancel | On listing detail: schedule, then complete or cancel. The operations section stays. |
| Lead / LeadActivity | `/platform/leads`, `/platform/leads/[id]` (leads) | unchanged |
| Lead (manual entry) | **MISSING** | "New lead" drawer on `/platform/leads` |
| LeadRoutingRule | **THIN**: nav linked to the generic `/lead-routing-rules` | `/platform/routing` (routing): create, edit, pause/activate, delete |
| Showing / ShowingFeedback | `/platform/showings`, `/platform/showings/[id]` (showings) | unchanged |
| Deal (board) | `/platform/pipeline` (pipeline) | adds "New deal" |
| Deal detail: offers, milestones, documents, inspections, financing, title, escrow, commissions | **THIN**: scattered across the operations page, with no per-deal view | `/platform/pipeline/[id]`: a deal workspace with every child record and its actions |
| Offer / TransactionMilestone / DealDocument / Disclosure | operations sections | also on the deal page |
| PropertyInspection, Escrow, TitleOrder, MortgageApplication | **THIN**: read-only rows in operations (inspection transitions only) | Created and progressed from the deal page |
| Commission / CommissionLedgerEntry | operations (commissions, ledger forms) | Deal page lists the deal's commissions; the ledger stays in operations |
| AgentTask | **THIN**: one operations section, with no create | `/platform/tasks` (tasks): status tabs, create, transitions |
| BrokerageMembership / AgentTeam / User | `/platform/people` (people) | unchanged |
| Practitioner, listing and representation authorities; DocumentEvidenceEvent | operations ("Licenses & agreements", "Document history") | unchanged; the listing page shows the listing's authorities |
| ListingSyndication | operations ("Syndication") | also shown on listing detail |
| MarketComp / PropertyValuation | operations ("Comparables and valuations") | also shown on listing detail |
| Neighborhood | **MISSING**: no page; not brokerage-scoped (no `brokerage` field) | Left to the generic list. It's a cross-tenant list, so it can't get a brokerage-scoped page without a schema change. |
| SavedSearch / SavedSearchAlert / SourceFeed | operations ("Saved search alerts", "Imports") | unchanged |
| RetentionPolicy / TransactionFileEvent / DomainOutboxEvent | operations ("Record retention", queue) | unchanged |
| DomainAuditEvent | system log; parent: the record pages | unchanged |
| BrokerageSettings | `/platform/store-settings` | unchanged |
| Role | generic `/roles` (nav entry) | unchanged (shared shell) |
| Reports | `/platform/reports` | unchanged |

### Storefront

| Customer workflow | Before | After |
|---|---|---|
| Browse → detail | complete | unchanged |
| Tour → confirmation → history | Request sent, then My showings (list and cancel) | adds a showing page `/account/showings/[id]` with "Add to calendar" (.ics) |
| Open house | shown on the listing; no way to keep it | "Add to calendar" (.ics) per open house |
| Ask → history | Questions tab | unchanged |
| Save homes and searches | Saved tab | unchanged |
| Account | sign-up, sign-in, reset, profile | unchanged |
