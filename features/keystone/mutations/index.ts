import { mergeSchemas } from '@graphql-tools/schema'
import type { GraphQLSchema } from 'graphql'
import { publicBrokerageIdentity } from './publicBrokerageIdentity'
import { customerSavedHomes, customerSavedProperties, publicRealEstateListing, publicRealEstateListings } from './publicStorefront'
import redirectToInit from './redirectToInit'
import { requestPropertyShowing } from './requestPropertyShowing'
import { platformShowingDetail, scheduledShowingReceipt } from './showingJourney'
import { platformLeadDetail, platformShowingRequestViewer } from './leadJourney'
import {
  dismissRealEstateOnboarding,
  runRealEstateOnboardingMutation,
} from './runRealEstateOnboarding'
import {
  transitionCommissionStatus,
  transitionDealStage,
  transitionDisclosureStatus,
  transitionLeadStatus,
  transitionOfferStatus,
  transitionOpenHouseStatus,
  transitionPropertyStatus,
  transitionShowingStatus,
  reviewShowingCommand,
  transitionTransactionMilestoneStatus,
} from './operatorLifecycle'
import {
  deleteSavedSearchForCurrentUser,
  removeSavedPropertyForCurrentUser,
  savePropertyForCurrentUser,
  saveSearchForCurrentUser,
} from './savedDiscovery'
import { submitListingInquiry } from './submitListingInquiry'
import {
  addLeadActivityCommand,
  completeShowingWithFeedback,
  inviteBrokerageMemberCommand,
  resolveDuplicateLeadCommand,
  scheduleShowingForLeadCommand,
  suspendBrokerageMemberCommand,
  updateDealFinancialTermsCommand,
  updateDealNextStepCommand,
} from './operatorCommands'
import { domainOutboxEventStatus, replayDomainOutboxEvent } from './domainOutbox'
import { platformContacts, platformListings, platformOperations, platformPeople, platformPipeline, platformReports, platformShowings } from './platformProjections'
import { platformStorefrontSettings, updatePlatformStorefrontSettings } from './platformStorefrontSettings'
import { registerRealEstateCustomer, customerShowingHistory, cancelCustomerShowing, customerInquiryHistory } from './customerAccount'
import { createChecklistItemCommand, createCounterOfferCommand, createOfferCommand, queueSavedSearchAlertCommand, queueSourceImportCommand, transitionAgentTaskCommand, transitionDocumentCommand, transitionInspectionCommand, transitionListingSyndicationCommand, updateSavedSearchAlertCommand } from './platformCommands'
import { recordListingEngagementAuthorityCommand, recordListingPublicationAuthorityCommand, recordPractitionerLicenseAuthorityCommand, recordRepresentationAuthorityCommand } from './authorityCommands'
import { appendDocumentEvidenceEventCommand } from './documentEvidenceCommands'
import { approveCommissionAllocationCommand, proposeCommissionAllocationCommand, recordCommissionReceiptCommand, reconcileCommissionLedgerCommand, reverseCommissionLedgerEntryCommand } from './commissionLedgerCommands'
import { assignTransactionFileRetentionCommand, createTransactionExportManifestCommand, recordRetentionPolicyCommand, recordTransactionLegalHoldCommand } from './retentionCommands'

const graphql = String.raw

export function extendGraphqlSchema(baseSchema: GraphQLSchema) {
  return mergeSchemas({
    schemas: [baseSchema],
    typeDefs: graphql`
      type PlatformPerson { id: ID! name: String! email: String phone: String }
      type PlatformPropertySummary { id: ID! title: String! slug: String city: String state: String addressLine1: String price: String listingType: String }
      type PlatformLeadSummary { id: ID! name: String! email: String phone: String status: String intent: String }
      type PlatformActivity { id: ID! activityType: String! direction: String channel: String subject: String body: String occurredAt: String agent: PlatformPerson }
      type PlatformContact { id: ID! name: String! email: String phone: String status: String! intent: String source: String message: String lastContactedAt: String createdAt: String updatedAt: String activityAccess: String! property: PlatformPropertySummary assignedAgent: PlatformPerson showingsCount: Int activities: [PlatformActivity!]! }
      type PlatformContactCandidate { id: ID! name: String! email: String phone: String status: String! source: String createdAt: String assignedAgent: PlatformPerson property: PlatformPropertySummary }
      type PlatformDuplicateGroup { key: String! reason: String! candidates: [PlatformContactCandidate!]! }
      type PlatformContactStats { total: Int! new: Int! qualified: Int! tourScheduled: Int! offer: Int! }
      type PlatformOperatorViewer { actorId: ID! brokerageId: ID! }
      type PlatformContactPageInfo { hasNextPage: Boolean! hasPreviousPage: Boolean! nextCursor: String previousCursor: String }
      type PlatformContactWorkspace { items: [PlatformContact!]! duplicateGroups: [PlatformDuplicateGroup!]! stats: PlatformContactStats! pageInfo: PlatformContactPageInfo! viewer: PlatformOperatorViewer! }
      type PlatformLeadDetail { lead: PlatformContact! activityAccess: String! nextActivityCursor: String viewer: PlatformOperatorViewer! }

      type PlatformListing { id: ID! title: String! slug: String! status: String! listingType: String propertyType: String shortDescription: String addressLine1: String city: String state: String postalCode: String price: String bedrooms: Int bathrooms: String squareFeet: Int isFeatured: Boolean primaryImageUrl: String updatedAt: String assignedAgent: PlatformPerson leadsCount: Int showingsCount: Int }
      type PlatformListingStats { total: Int! active: Int! comingSoon: Int! pending: Int! sold: Int! offMarket: Int! }
      type PlatformListingPageInfo { hasNextPage: Boolean! hasPreviousPage: Boolean! nextCursor: String previousCursor: String }
      type PlatformListingWorkspace { items: [PlatformListing!]! stats: PlatformListingStats! pageInfo: PlatformListingPageInfo! }

      type PlatformShowing { id: ID! status: String! showingType: String scheduledStart: String! scheduledEnd: String notes: String feedback: String createdAt: String property: PlatformPropertySummary lead: PlatformLeadSummary assignedAgent: PlatformPerson }
      type ShowingCommandReceipt { version: Int! showingId: ID! leadId: ID! propertyId: ID! }
      type ShowingSourceSnapshot { version: Int! capturedAt: String! propertyId: ID! leadId: ID! assignedAgentId: ID scheduledStart: String! scheduledEnd: String! showingType: String! listingTitle: String! listingSlug: String! addressLine1: String! city: String! state: String! listingType: String! price: String notes: String! propertyUpdatedAt: String }
      type ShowingHistoryEntry { id: ID! action: String! occurredAt: String! fromStatus: String toStatus: String }
      type PlatformShowingDetail { showing: PlatformShowing! updatedAt: String! revision: String! snapshot: ShowingSourceSnapshot history: [ShowingHistoryEntry!]! nextHistoryCursor: String }
      type PlatformShowingStats { total: Int! requested: Int! scheduled: Int! completed: Int! noShow: Int! cancelled: Int! }
      type PlatformShowingPageInfo { hasNextPage: Boolean! hasPreviousPage: Boolean! nextCursor: String previousCursor: String }
      type PlatformShowingWorkspace { items: [PlatformShowing!]! stats: PlatformShowingStats! pageInfo: PlatformShowingPageInfo! }

      type PlatformDeal { id: ID! title: String! stage: String! transactionType: String offerAmount: String commissionAmount: String expectedCloseDate: String closedAt: String nextStep: String notes: String createdAt: String updatedAt: String property: PlatformPropertySummary lead: PlatformLeadSummary assignedAgent: PlatformPerson assignedTeam: PlatformTeam }
      type PlatformTeam { id: ID! name: String! }
      type PlatformPipelineStats { total: Int! open: Int! underContract: Int! closedWon: Int! closedLost: Int! projectedCommission: String! }
      type PlatformPipelineWorkspace { items: [PlatformDeal!]! stats: PlatformPipelineStats! }

      type PlatformMembership { id: ID! membershipRole: String! isPrimary: Boolean! brokerage: PlatformBrokerageRef }
      type PlatformBrokerageRef { id: ID! name: String! slug: String! }
      type PlatformAgent { id: ID! name: String! email: String phone: String licenseNumber: String brokerageTitle: String avatarUrl: String onboardingStatus: String role: PlatformRoleRef memberships: [PlatformMembership!]! listingCount: Int! leadCount: Int! showingCount: Int! dealCount: Int! }
      type PlatformRoleRef { id: ID! name: String! }
      type PlatformAgentTeam { id: ID! name: String! slug: String! teamType: String! status: String! description: String leadAgent: PlatformPerson members: [PlatformPerson!]! leadCount: Int! dealCount: Int! }
      type PlatformPeopleWorkspace { agents: [PlatformAgent!]! teams: [PlatformAgentTeam!]! }

      type PlatformOfferRef { id: ID! offerNumber: String! }
      type PlatformOffer { id: ID! offerNumber: String! version: Int! parentOffer: PlatformOfferRef status: String! amount: String earnestMoney: String financingType: String contingencies: String submittedAt: String responseDueAt: String createdAt: String deal: PlatformDealRef property: PlatformPropertyRef lead: PlatformLeadRef assignedAgent: PlatformPerson }
      type PlatformDealRef { id: ID! title: String! }
      type PlatformPropertyRef { id: ID! title: String! }
      type PlatformLeadRef { id: ID! name: String! }
      type PlatformMilestone { id: ID! name: String! status: String! dueAt: String completedAt: String sortOrder: Int notes: String assignedTo: PlatformPerson }
      type PlatformDocument { id: ID! title: String! documentType: String! status: String! requiresSignature: Boolean! sentAt: String signedAt: String expiresAt: String }
      type PlatformTransaction { id: ID! title: String! stage: String! expectedCloseDate: String property: PlatformPropertyRef lead: PlatformLeadRef assignedAgent: PlatformPerson milestones: [PlatformMilestone!]! documents: [PlatformDocument!]! }
      type PlatformCommission { id: ID! title: String! status: String! side: String! grossCommission: String brokerageSplitPercent: String agentSplitPercent: String netCommission: String paidAt: String deal: PlatformDealRef agent: PlatformPerson }
      type PlatformSavedSearch { id: ID! name: String! city: String state: String propertyType: String minPrice: String maxPrice: String minBedrooms: Int alertsEnabled: Boolean! lastNotifiedAt: String user: PlatformPerson }
      type PlatformSavedSearchAlert { id: ID! status: String! cadence: String! lastSentAt: String sentCount: Int savedSearch: PlatformSearchRef user: PlatformPerson }
      type PlatformSearchRef { id: ID! name: String! }
      type PlatformSourceFeed { id: ID! name: String! provider: String feedType: String! status: String! lastImportedAt: String recordsImported: Int }
      type PlatformQueueItem { id: ID! eventKey: String! eventType: String! aggregateType: String! aggregateId: String! status: String! attempts: Int replayCount: Int availableAt: String occurredAt: String! lastError: String }
      type PlatformDisclosure { id: ID! title: String! disclosureType: String! status: String! documentUrl: String sentAt: String acknowledgedAt: String deal: PlatformDealRef property: PlatformPropertyRef }
      type PlatformMortgageEvidence { id: ID! applicationNumber: String! lenderName: String status: String! loanAmount: String interestRate: String submittedAt: String decisionAt: String deal: PlatformDealRef lead: PlatformLeadRef }
      type PlatformTitleEvidence { id: ID! orderNumber: String! titleCompany: String status: String! orderedAt: String clearedAt: String exceptions: String deal: PlatformDealRef property: PlatformPropertyRef }
      type PlatformEscrowEvidence { id: ID! escrowNumber: String! status: String! escrowCompany: String officerName: String openedAt: String scheduledCloseAt: String closedAt: String depositAmount: String deal: PlatformDealRef property: PlatformPropertyRef }
      type PlatformOpenHouse { id: ID! title: String! status: String! startsAt: String! endsAt: String! attendeeCount: Int notes: String property: PlatformPropertyRef hostAgent: PlatformPerson }
      type PlatformInspection { id: ID! title: String! inspectionType: String! status: String! scheduledAt: String completedAt: String inspectorName: String estimatedCost: String summary: String findings: String property: PlatformPropertyRef deal: PlatformDealRef }
      type PlatformMarketComp { id: ID! addressLine1: String! city: String state: String status: String! listPrice: String salePrice: String soldAt: String bedrooms: Int bathrooms: String squareFeet: Int distanceMiles: String subjectProperty: PlatformPropertyRef neighborhood: PlatformNeighborhoodRef }
      type PlatformNeighborhoodRef { id: ID! name: String! }
      type PlatformValuation { id: ID! valuationNumber: String! valuationType: String! lowValue: String estimatedValue: String highValue: String valuedAt: String notes: String property: PlatformPropertyRef performedBy: PlatformPerson }
      type PlatformSyndication { id: ID! channel: String! status: String! externalListingId: String listingUrl: String publishedAt: String lastSyncedAt: String errorMessage: String property: PlatformPropertySummary }
      type PlatformAgentTask { id: ID! title: String! status: String! priority: String! dueAt: String completedAt: String notes: String assignedAgent: PlatformPerson property: PlatformPropertyRef lead: PlatformLeadRef deal: PlatformDealRef }
      type PlatformReportLead { id: ID! source: String status: String! assignedAgent: PlatformPerson }
      type PlatformReportShowing { id: ID! status: String! assignedAgent: PlatformPerson }
      type PlatformReportDeal { id: ID! stage: String! commissionAmount: String assignedAgent: PlatformPerson }
      type PlatformReportsWorkspace { leads: [PlatformReportLead!]! showings: [PlatformReportShowing!]! deals: [PlatformReportDeal!]! activeListings: Int! pendingListings: Int! }
      type PlatformListingEngagementAuthority { id: ID! authorityNumber: String! status: String! jurisdictionCode: String! effectiveFrom: String! effectiveThrough: String! marketingAuthorized: Boolean! showingAuthorized: Boolean! documentSha256: String! property: PlatformPropertyRef practitioner: PlatformPerson }
      type PlatformListingPublicationAuthority { id: ID! authorityNumber: String! destination: String! status: String! effectiveFrom: String! effectiveThrough: String! authorityBasis: String! property: PlatformPropertyRef engagementId: ID }
      type PlatformPractitionerLicenseAuthority { id: ID! licenseNumber: String! licenseType: String! jurisdictionCode: String! status: String! effectiveFrom: String! effectiveThrough: String! verifiedAt: String! verificationSource: String! practitioner: PlatformPerson }
      type PlatformRepresentationAuthority { id: ID! authorityNumber: String! side: String! relationshipType: String! jurisdictionCode: String! status: String! effectiveFrom: String! effectiveThrough: String! disclosureVersion: String! lead: PlatformLeadRef property: PlatformPropertyRef deal: PlatformDealRef practitioner: PlatformPerson }
      type PlatformDocumentEvidenceEvent { id: ID! eventKey: String! eventType: String! documentSha256: String! templateSha256: String! channel: String! provider: String! providerReference: String! occurredAt: String! acknowledgedAt: String document: PlatformDocumentRef offer: PlatformOfferRef }
      type PlatformDocumentRef { id: ID! title: String! }
      type PlatformCommissionLedgerEntry { id: ID! entryKey: String! batchKey: String! entryType: String! allocationType: String amountCents: String! currencyCode: String! payeeLabel: String externalReference: String occurredAt: String! commissionId: ID! preparedBy: PlatformPerson approvedBy: PlatformPerson }
      type PlatformRetentionPolicy { id: ID! policyKey: String! retentionClass: String! jurisdictionCode: String! triggerType: String! retentionDays: Int! disposition: String! effectiveFrom: String! effectiveThrough: String }
      type PlatformTransactionFileEvent { id: ID! eventKey: String! eventType: String! triggerAt: String disposeAfter: String holdKey: String manifestKey: String manifestSha256: String documentSha256: String externalDeletionReference: String reason: String! occurredAt: String! deal: PlatformDealRef document: PlatformDocumentRef }

      type PlatformOperationsWorkspace { offers: [PlatformOffer!]! transactions: [PlatformTransaction!]! commissions: [PlatformCommission!]! savedSearches: [PlatformSavedSearch!]! alerts: [PlatformSavedSearchAlert!]! feeds: [PlatformSourceFeed!]! queue: [PlatformQueueItem!]! inspections: [PlatformInspection!]! openHouses: [PlatformOpenHouse!]! disclosures: [PlatformDisclosure!]! mortgages: [PlatformMortgageEvidence!]! titleOrders: [PlatformTitleEvidence!]! escrows: [PlatformEscrowEvidence!]! comps: [PlatformMarketComp!]! valuations: [PlatformValuation!]! syndications: [PlatformSyndication!]! tasks: [PlatformAgentTask!]! listingEngagementAuthorities: [PlatformListingEngagementAuthority!]! listingPublicationAuthorities: [PlatformListingPublicationAuthority!]! practitionerLicenses: [PlatformPractitionerLicenseAuthority!]! representationAuthorities: [PlatformRepresentationAuthority!]! documentEvidenceEvents: [PlatformDocumentEvidenceEvent!]! commissionLedgerEntries: [PlatformCommissionLedgerEntry!]! retentionPolicies: [PlatformRetentionPolicy!]! transactionFileEvents: [PlatformTransactionFileEvent!]! }

      input PublicRealEstateListingFilters {
        q: String
        city: String
        listingType: String
        propertyType: String
        minPrice: String
        maxPrice: String
        bedrooms: Int
        bathrooms: Int
        sort: String
      }

      type PublicRealEstateAgent {
        name: String!
        email: String!
        phone: String!
        brokerageTitle: String!
        imagePath: String!
      }

      type PublicRealEstateMedia {
        title: String!
        mediaType: String!
        imagePath: String!
        externalUrl: String!
        altText: String!
        caption: String!
        sortOrder: Int!
        isHero: Boolean!
      }

      type PublicOpenHouse {
        id: ID!
        title: String!
        startsAt: String!
        endsAt: String!
        hostName: String!
      }

      type PublicRealEstateListing {
        id: ID!
        title: String!
        slug: String!
        status: String!
        listingType: String!
        propertyType: String!
        shortDescription: String!
        description: String!
        addressLine1: String!
        addressLine2: String!
        city: String!
        state: String!
        postalCode: String!
        neighborhood: String!
        price: String!
        bedrooms: Int
        bathrooms: String!
        squareFeet: Int
        lotSizeSquareFeet: Int
        yearBuilt: Int
        hoaFee: String!
        availableAt: String!
        isFeatured: Boolean!
        virtualTourUrl: String!
        leaseTerm: String!
        securityDeposit: Int
        petPolicy: String!
        imagePath: String!
        assignedAgent: PublicRealEstateAgent
        media: [PublicRealEstateMedia!]!
        openHouses: [PublicOpenHouse!]!
      }

      input SubmitListingInquiryInput {
        brokerageSlug: String!
        propertyId: ID!
        name: String!
        email: String
        phone: String
        intent: String
        message: String
        preferredTime: String
      }

      type SubmitListingInquiryResult {
        ok: Boolean!
        message: String!
      }

      input RequestPropertyShowingInput {
        brokerageSlug: String!
        propertyId: ID!
        name: String!
        email: String
        phone: String
        requestedStart: String!
        showingType: String
        message: String
        idempotencyKey: String
      }

      type RequestPropertyShowingResult {
        ok: Boolean!
        message: String!
        requestReference: String
      }

      type CustomerRegistrationResult { ok: Boolean! message: String! }
      input RealEstateCustomerInput { name: String! email: String! password: String! brokerageSlug: String! }
      type CustomerShowing { id: ID! status: String! showingType: String! scheduledStart: String! scheduledEnd: String listingTitle: String! listingSlug: String! requestedStart: String! }
      type CustomerSavedProperty { id: ID! propertyId: ID! }
      type CustomerInquiry { id: ID! message: String! sentAt: String! listingTitle: String! listingSlug: String! status: String! }

      type PublicBrokerageIdentity {
        businessName: String!
        marketLabel: String!
        city: String!
        state: String!
        tagline: String!
        description: String!
        equalHousingNotice: String!
        publicPhone: String!
        publicEmail: String!
        brandHue: Int!
        logoIcon: String!
        logoColor: String!
      }

      type PublicBrokerageIdentityState {
        status: String!
        brokerageSlug: String
        settings: PublicBrokerageIdentity
      }

      type PlatformStorefrontSettings {
        id: ID!
        businessName: String!
        marketLabel: String!
        city: String!
        state: String!
        tagline: String!
        description: String!
        equalHousingNotice: String!
        publicPhone: String!
        publicEmail: String!
        showingDurationMinutes: Int!
        brandHue: Int!
        logoIcon: String!
        logoColor: String!
      }

      type PlatformStorefrontSettingsState {
        status: String!
        settings: PlatformStorefrontSettings
      }

      input PlatformStorefrontSettingsInput {
        businessName: String!
        marketLabel: String!
        city: String!
        state: String!
        tagline: String!
        description: String!
        equalHousingNotice: String!
        publicPhone: String!
        publicEmail: String!
        showingDurationMinutes: Int!
        brandHue: Int
        logoIcon: String
        logoColor: String
      }

      input ShowingReviewInput { id: ID! status: String! expectedStatus: String! expectedUpdatedAt: String! expectedRevision: String! note: String idempotencyKey: String! }
      input OperatorTransitionInput {
        id: ID!
        status: String!
        note: String
        idempotencyKey: String!
        expectedStatus: String
        expectedUpdatedAt: String
      }

      type OperatorTransitionResult {
        ok: Boolean!
        message: String!
        itemId: ID
        status: String
        replayed: Boolean!
      }

      type OperatorCommandResult {
        ok: Boolean!
        message: String!
        itemId: ID
        replayed: Boolean!
      }

      input CreateOfferCommandInput { dealId: ID! amount: String! earnestMoney: String financingType: String contingencies: String responseDueAt: DateTime idempotencyKey: String! }
      input CreateCounterOfferCommandInput { offerId: ID! amount: String! contingencies: String responseDueAt: DateTime idempotencyKey: String! }
      input CreateChecklistItemCommandInput { dealId: ID! name: String! dueAt: DateTime assignedToId: ID notes: String idempotencyKey: String! }
      input TransitionDocumentCommandInput { documentId: ID! status: String! idempotencyKey: String! }
      input TransitionAgentTaskCommandInput { taskId: ID! status: String! idempotencyKey: String! }
      input TransitionInspectionCommandInput { inspectionId: ID! status: String! idempotencyKey: String! }
      input UpdateSavedSearchAlertCommandInput { alertId: ID! status: String! cadence: String! idempotencyKey: String! }
      input QueueSavedSearchAlertCommandInput { alertId: ID! idempotencyKey: String! }
      input QueueSourceImportCommandInput { sourceFeedId: ID! mode: String! idempotencyKey: String! }
      input TransitionListingSyndicationCommandInput { syndicationId: ID! status: String! providerReference: String reason: String! idempotencyKey: String! }

      input RecordPractitionerLicenseAuthorityInput { practitionerId: ID! licenseNumber: String! licenseType: String! jurisdictionCode: String! status: String! effectiveFrom: DateTime! effectiveThrough: DateTime! verifiedAt: DateTime! verificationSource: String! restrictions: String reason: String! idempotencyKey: String! }
      input RecordListingEngagementAuthorityInput { propertyId: ID! practitionerId: ID! status: String! jurisdictionCode: String! effectiveFrom: DateTime! effectiveThrough: DateTime! exclusive: Boolean marketingAuthorized: Boolean showingAuthorized: Boolean sellerPartySummary: JSON signatoryCapacity: String! documentSha256: String! providerReference: String reason: String! idempotencyKey: String! }
      input RecordListingPublicationAuthorityInput { propertyId: ID! engagementId: ID! destination: String! status: String! effectiveFrom: DateTime! effectiveThrough: DateTime! authorityBasis: String! localRuleReference: String dataUseGrantReference: String reason: String! idempotencyKey: String! }
      input RecordRepresentationAuthorityInput { leadId: ID! propertyId: ID dealId: ID practitionerId: ID! side: String! relationshipType: String! jurisdictionCode: String! status: String! effectiveFrom: DateTime! effectiveThrough: DateTime! scopeSummary: String! documentSha256: String! disclosureVersion: String! consentRecordedAt: DateTime! reason: String! idempotencyKey: String! }

      input AppendDocumentEvidenceEventInput { documentId: ID! offerId: ID eventType: String! documentSha256: String! templateSha256: String! certificateSha256: String recipients: JSON! channel: String! provider: String! providerReference: String! occurredAt: DateTime! providerReportedAt: DateTime acknowledgedAt: DateTime acknowledgementReference: String reason: String! idempotencyKey: String! }

      input CommissionAllocationLineInput { allocationType: String! amountCents: String! payeeUserId: ID payeeLabel: String }
      input ProposeCommissionAllocationInput { commissionId: ID! currencyCode: String! lines: [CommissionAllocationLineInput!]! reason: String! idempotencyKey: String! }
      input ApproveCommissionAllocationInput { commissionId: ID! batchKey: String! reason: String! idempotencyKey: String! }
      input RecordCommissionReceiptInput { commissionId: ID! batchKey: String! amountCents: String! currencyCode: String! externalReference: String! sourceDocumentSha256: String! reason: String! idempotencyKey: String! }
      input ReverseCommissionLedgerEntryInput { entryId: ID! reason: String! idempotencyKey: String! }
      input ReconcileCommissionLedgerInput { commissionId: ID! batchKey: String! externalReference: String! reason: String! idempotencyKey: String! }

      input RecordRetentionPolicyInput { retentionClass: String! jurisdictionCode: String! triggerType: String! retentionDays: Int! disposition: String! legalBasis: String! effectiveFrom: DateTime! effectiveThrough: DateTime reason: String! idempotencyKey: String! }
      input AssignTransactionFileRetentionInput { dealId: ID! documentId: ID! policyId: ID! documentSha256: String! triggerAt: DateTime! reason: String! idempotencyKey: String! }
      input RecordTransactionLegalHoldInput { dealId: ID! documentId: ID holdKey: String! action: String! reason: String! idempotencyKey: String! }
      input TransactionExportManifestItemInput { documentId: ID! sha256: String! }
      input CreateTransactionExportManifestInput { dealId: ID! manifestKey: String! manifestSha256: String! items: [TransactionExportManifestItemInput!]! reason: String! idempotencyKey: String! }
      input InviteBrokerageMemberInput {
        brokerageId: ID!
        name: String!
        email: String!
        temporaryPassword: String!
        roleName: String!
        membershipRole: String!
        idempotencyKey: String!
      }

      input SuspendBrokerageMemberInput { membershipId: ID! idempotencyKey: String! }

      input UpdateDealFinancialTermsInput {
        dealId: ID!
        offerAmount: String!
        commissionAmount: String
        idempotencyKey: String!
      }

      input UpdateDealNextStepInput {
        dealId: ID!
        nextStep: String!
        notes: String
        idempotencyKey: String!
      }

      input CompleteShowingWithFeedbackInput {
        showingId: ID!
        feedback: String!
        idempotencyKey: String!
        expectedStatus: String
        expectedUpdatedAt: String
        expectedRevision: String
      }

      input ScheduleShowingForLeadInput {
        originalActorId: ID
        originalBrokerageId: ID
        leadId: ID!
        propertyId: ID!
        assignedAgentId: ID
        scheduledStart: DateTime!
        notes: String
        idempotencyKey: String!
      }

      input AddLeadActivityCommandInput {
        leadId: ID!
        propertyId: ID
        activityType: String
        direction: String
        channel: String
        subject: String
        body: String!
        idempotencyKey: String!
      }

      input ResolveDuplicateLeadInput {
        primaryLeadId: ID!
        duplicateLeadId: ID!
        note: String
        idempotencyKey: String!
      }

      type DomainOutboxEventStatus {
        id: ID!
        eventKey: String!
        eventType: String!
        aggregateType: String!
        aggregateId: String!
        status: String!
        attempts: Int
        replayCount: Int
        availableAt: DateTime
        occurredAt: DateTime!
        dispatchedAt: DateTime
        lastError: String
      }

      input SavePropertyForCurrentUserInput {
        propertyId: ID!
        status: SavedPropertyStatusType
        notes: String
      }

      input SavedPropertyIdInput {
        savedPropertyId: ID!
      }

      input SaveSearchForCurrentUserInput {
        name: String!
        city: String
        state: String
        propertyType: String
        listingType: String
        minPrice: String
        maxPrice: String
        minBedrooms: Int
        minBathrooms: String
        minSquareFeet: Int
        keywords: String
        alertsEnabled: Boolean
      }

      input SavedSearchIdInput {
        savedSearchId: ID!
      }

      type SavedDiscoveryResult {
        ok: Boolean!
        message: String!
        itemId: ID
      }

      type OnboardingSeedSummary {
        created: Int!
        skipped: Int!
        total: Int!
      }

      type RealEstateOnboardingResult {
        completed: Boolean!
        status: String!
        core: OnboardingSeedSummary
        expansion: OnboardingSeedSummary
      }

      type Query {
        redirectToInit: Boolean
        publicBrokerageIdentity(brokerageSlug: String): PublicBrokerageIdentityState!
        customerShowingHistory(brokerageSlug: String!, id: ID): [CustomerShowing!]!
        customerInquiryHistory(brokerageSlug: String!): [CustomerInquiry!]!
        customerSavedProperties(brokerageSlug: String!): [CustomerSavedProperty!]!
        customerSavedHomes(brokerageSlug: String!): [PublicRealEstateListing!]!
        publicRealEstateListings(brokerageSlug: String!, filters: PublicRealEstateListingFilters, take: Int = 24, skip: Int = 0): [PublicRealEstateListing!]!
        publicRealEstateListing(brokerageSlug: String!, slug: String!): PublicRealEstateListing
        domainOutboxEventStatus(eventKey: String!): DomainOutboxEventStatus
        platformContacts(status: String = "all", q: String, take: Int = 50, after: String, before: String): PlatformContactWorkspace!
        platformLeadDetail(id: ID!, before: String): PlatformLeadDetail
        platformShowingRequestViewer: PlatformOperatorViewer
        platformListings(status: String = "all", q: String, take: Int = 60, after: String, before: String): PlatformListingWorkspace!
        scheduledShowingReceipt(data: ScheduleShowingForLeadInput!): ShowingCommandReceipt
        platformShowingDetail(id: ID!, before: String): PlatformShowingDetail
        platformShowings(status: String = "all", range: String = "upcoming", q: String, take: Int = 80, after: String, before: String): PlatformShowingWorkspace!
        platformPipeline: PlatformPipelineWorkspace!
        platformPeople: PlatformPeopleWorkspace!
        platformReports: PlatformReportsWorkspace!
        platformOperations: PlatformOperationsWorkspace!
        platformStorefrontSettings: PlatformStorefrontSettingsState!
      }

      type Mutation {
        submitListingInquiry(data: SubmitListingInquiryInput!): SubmitListingInquiryResult!
        requestPropertyShowing(data: RequestPropertyShowingInput!): RequestPropertyShowingResult!
        transitionLeadStatus(data: OperatorTransitionInput!): OperatorTransitionResult!
        transitionPropertyStatus(data: OperatorTransitionInput!): OperatorTransitionResult!
        transitionShowingStatus(data: OperatorTransitionInput!): OperatorTransitionResult!
        reviewShowingCommand(data: ShowingReviewInput!): OperatorTransitionResult!
        transitionOpenHouseStatus(data: OperatorTransitionInput!): OperatorTransitionResult!
        transitionOfferStatus(data: OperatorTransitionInput!): OperatorTransitionResult!
        transitionDealStage(data: OperatorTransitionInput!): OperatorTransitionResult!
        transitionCommissionStatus(data: OperatorTransitionInput!): OperatorTransitionResult!
        transitionDisclosureStatus(data: OperatorTransitionInput!): OperatorTransitionResult!
        transitionTransactionMilestoneStatus(data: OperatorTransitionInput!): OperatorTransitionResult!
        createOfferCommand(data: CreateOfferCommandInput!): OperatorCommandResult!
        createCounterOfferCommand(data: CreateCounterOfferCommandInput!): OperatorCommandResult!
        createChecklistItemCommand(data: CreateChecklistItemCommandInput!): OperatorCommandResult!
        transitionDocumentCommand(data: TransitionDocumentCommandInput!): OperatorCommandResult!
        transitionAgentTaskCommand(data: TransitionAgentTaskCommandInput!): OperatorCommandResult!
        transitionInspectionCommand(data: TransitionInspectionCommandInput!): OperatorCommandResult!
        updateSavedSearchAlertCommand(data: UpdateSavedSearchAlertCommandInput!): OperatorCommandResult!
        queueSavedSearchAlertCommand(data: QueueSavedSearchAlertCommandInput!): OperatorCommandResult!
        queueSourceImportCommand(data: QueueSourceImportCommandInput!): OperatorCommandResult!
        transitionListingSyndicationCommand(data: TransitionListingSyndicationCommandInput!): OperatorCommandResult!
        recordPractitionerLicenseAuthorityCommand(data: RecordPractitionerLicenseAuthorityInput!): OperatorCommandResult!
        recordListingEngagementAuthorityCommand(data: RecordListingEngagementAuthorityInput!): OperatorCommandResult!
        recordListingPublicationAuthorityCommand(data: RecordListingPublicationAuthorityInput!): OperatorCommandResult!
        recordRepresentationAuthorityCommand(data: RecordRepresentationAuthorityInput!): OperatorCommandResult!
        appendDocumentEvidenceEventCommand(data: AppendDocumentEvidenceEventInput!): OperatorCommandResult!
        proposeCommissionAllocationCommand(data: ProposeCommissionAllocationInput!): OperatorCommandResult!
        approveCommissionAllocationCommand(data: ApproveCommissionAllocationInput!): OperatorCommandResult!
        recordCommissionReceiptCommand(data: RecordCommissionReceiptInput!): OperatorCommandResult!
        reverseCommissionLedgerEntryCommand(data: ReverseCommissionLedgerEntryInput!): OperatorCommandResult!
        reconcileCommissionLedgerCommand(data: ReconcileCommissionLedgerInput!): OperatorCommandResult!
        recordRetentionPolicyCommand(data: RecordRetentionPolicyInput!): OperatorCommandResult!
        assignTransactionFileRetentionCommand(data: AssignTransactionFileRetentionInput!): OperatorCommandResult!
        recordTransactionLegalHoldCommand(data: RecordTransactionLegalHoldInput!): OperatorCommandResult!
        createTransactionExportManifestCommand(data: CreateTransactionExportManifestInput!): OperatorCommandResult!
        inviteBrokerageMemberCommand(data: InviteBrokerageMemberInput!): OperatorCommandResult!
        suspendBrokerageMemberCommand(data: SuspendBrokerageMemberInput!): OperatorCommandResult!
        updateDealFinancialTermsCommand(data: UpdateDealFinancialTermsInput!): OperatorCommandResult!
        updateDealNextStepCommand(data: UpdateDealNextStepInput!): OperatorCommandResult!
        completeShowingWithFeedback(data: CompleteShowingWithFeedbackInput!): OperatorCommandResult!
        scheduleShowingForLeadCommand(data: ScheduleShowingForLeadInput!): OperatorCommandResult!
        addLeadActivityCommand(data: AddLeadActivityCommandInput!): OperatorCommandResult!
        resolveDuplicateLeadCommand(data: ResolveDuplicateLeadInput!): OperatorCommandResult!
        replayDomainOutboxEvent(eventId: ID!): OperatorCommandResult!
        savePropertyForCurrentUser(data: SavePropertyForCurrentUserInput!): SavedDiscoveryResult!
        removeSavedPropertyForCurrentUser(data: SavedPropertyIdInput!): SavedDiscoveryResult!
        saveSearchForCurrentUser(data: SaveSearchForCurrentUserInput!): SavedDiscoveryResult!
        deleteSavedSearchForCurrentUser(data: SavedSearchIdInput!): SavedDiscoveryResult!
        runRealEstateOnboarding(template: String = "full"): RealEstateOnboardingResult!
        dismissRealEstateOnboarding: RealEstateOnboardingResult!
        updatePlatformStorefrontSettings(data: PlatformStorefrontSettingsInput!): PlatformStorefrontSettingsState!
        registerRealEstateCustomer(data: RealEstateCustomerInput!): CustomerRegistrationResult!
        cancelCustomerShowing(brokerageSlug: String!, id: ID!): CustomerRegistrationResult!
      }
    `,
    resolvers: {
      Query: {
        redirectToInit,
        publicBrokerageIdentity,
        customerShowingHistory,
        customerInquiryHistory,
        customerSavedProperties,
        customerSavedHomes,
        publicRealEstateListings,
        publicRealEstateListing,
        domainOutboxEventStatus,
        platformContacts,
        platformLeadDetail,
        platformShowingRequestViewer,
        platformListings,
        platformShowings,
        platformShowingDetail,
        scheduledShowingReceipt,
        platformPipeline,
        platformPeople,
        platformReports,
        platformOperations,
        platformStorefrontSettings,
      },
      Mutation: {
        submitListingInquiry,
        requestPropertyShowing,
        transitionLeadStatus,
        transitionPropertyStatus,
        transitionShowingStatus,
        reviewShowingCommand,
        transitionOpenHouseStatus,
        transitionOfferStatus,
        transitionDealStage,
        transitionCommissionStatus,
        transitionDisclosureStatus,
        transitionTransactionMilestoneStatus,
        createOfferCommand,
        createCounterOfferCommand,
        createChecklistItemCommand,
        transitionDocumentCommand,
        transitionAgentTaskCommand,
        transitionInspectionCommand,
        updateSavedSearchAlertCommand,
        queueSavedSearchAlertCommand,
        queueSourceImportCommand,
        transitionListingSyndicationCommand,
        recordPractitionerLicenseAuthorityCommand,
        recordListingEngagementAuthorityCommand,
        recordListingPublicationAuthorityCommand,
        recordRepresentationAuthorityCommand,
        appendDocumentEvidenceEventCommand,
        proposeCommissionAllocationCommand,
        approveCommissionAllocationCommand,
        recordCommissionReceiptCommand,
        reverseCommissionLedgerEntryCommand,
        reconcileCommissionLedgerCommand,
        recordRetentionPolicyCommand,
        assignTransactionFileRetentionCommand,
        recordTransactionLegalHoldCommand,
        createTransactionExportManifestCommand,
        inviteBrokerageMemberCommand,
        suspendBrokerageMemberCommand,
        updateDealFinancialTermsCommand,
        updateDealNextStepCommand,
        completeShowingWithFeedback,
        scheduleShowingForLeadCommand,
        addLeadActivityCommand,
        resolveDuplicateLeadCommand,
        replayDomainOutboxEvent,
        savePropertyForCurrentUser,
        removeSavedPropertyForCurrentUser,
        saveSearchForCurrentUser,
        deleteSavedSearchForCurrentUser,
        runRealEstateOnboarding: runRealEstateOnboardingMutation,
        dismissRealEstateOnboarding,
        updatePlatformStorefrontSettings,
        registerRealEstateCustomer,
        cancelCustomerShowing,
      },
    },
  })
}
