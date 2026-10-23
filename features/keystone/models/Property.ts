import { list, graphql } from "@keystone-6/core";
import { checkbox, decimal, integer, relationship, select, text, timestamp, virtual } from "@keystone-6/core/fields";

import { getAgentImagePath, getNeighborhoodImagePath, getPropertyImagePath } from "../../lib/real-estate-images";

import { canCreateInActiveBrokerage, canMoveToActiveBrokerage, permissions, rules } from "../access";
import { createTenantOwnedHooks } from '../lib/tenantOwnedHooks'
import { money } from '../lib/money'
import { trackingFields } from "./trackingFields";

export const Property = list({
  access: {
    operation: {
      query: permissions.canManageListings,
      create: permissions.canManageBrokerageListings,
      update: permissions.canManageListings,
      delete: () => false,
    },
    filter: {
      query: rules.canAccessBrokerageRecords,
      update: rules.canManageAssignedProperties,
    },
    item: { create: canCreateInActiveBrokerage, update: canMoveToActiveBrokerage },
  },
  hooks: createTenantOwnedHooks({ listKey: 'Property', users: ['assignedAgent'], protectDelete: true }),
  ui: {
    hideDelete: true,
    listView: {
      initialColumns: ["title", "status", "listingType", "city", "price", "assignedAgent"],
    },
  },
  fields: {
    brokerage: relationship({ ref: 'Brokerage.properties', access: { update: () => false } }),
    title: text({ validation: { isRequired: true } }),
    slug: text({ isIndexed: "unique", validation: { isRequired: true } }),
    status: select({
      type: "enum",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Coming Soon", value: "coming_soon" },
        { label: "Active", value: "active" },
        { label: "Pending", value: "pending" },
        { label: "Sold", value: "sold" },
        { label: "Rented", value: "rented" },
        { label: "Off Market", value: "off_market" },
      ],
      defaultValue: "draft",
      validation: { isRequired: true },
      access: { create: () => false, update: () => false },
    }),
    listingType: select({
      type: "enum",
      options: [
        { label: "For Sale", value: "sale" },
        { label: "For Rent", value: "rent" },
      ],
      defaultValue: "sale",
      validation: { isRequired: true },
    }),
    propertyType: select({
      type: "enum",
      options: [
        { label: "House", value: "house" },
        { label: "Condo", value: "condo" },
        { label: "Townhome", value: "townhome" },
        { label: "Multi-Family", value: "multi_family" },
        { label: "Land", value: "land" },
        { label: "Commercial", value: "commercial" },
      ],
      defaultValue: "house",
    }),
    shortDescription: text({ ui: { displayMode: "textarea" } }),
    description: text({ ui: { displayMode: "textarea" } }),
    addressLine1: text({ validation: { isRequired: true } }),
    addressLine2: text(),
    city: text({ validation: { isRequired: true } }),
    state: text({ validation: { isRequired: true } }),
    postalCode: text(),
    neighborhood: text(),
    latitude: decimal({ precision: 10, scale: 7 }),
    longitude: decimal({ precision: 10, scale: 7 }),
    price: money({ precision: 12, scale: 2, validation: { isRequired: true }, defaultValue: "0.00" }),
    bedrooms: integer({ validation: { min: 0 }, defaultValue: 0 }),
    bathrooms: decimal({ precision: 4, scale: 1, defaultValue: "0.0" }),
    squareFeet: integer({ validation: { min: 0 } }),
    lotSizeSquareFeet: integer({ validation: { min: 0 } }),
    yearBuilt: integer(),
    hoaFee: money({ precision: 10, scale: 2 }),
    availableAt: timestamp(),
    isFeatured: checkbox({ defaultValue: false }),
    virtualTourUrl: text(),
    // Rental terms; shown on the storefront for listings with listingType "rent".
    leaseTerm: text({ ui: { description: "For rentals, e.g. 12 months" } }),
    securityDeposit: integer({ validation: { min: 0 }, ui: { description: "For rentals, in whole dollars" } }),
    petPolicy: text({ ui: { description: "For rentals, e.g. Cats and small dogs allowed" } }),
    primaryImageUrl: text(),
    assignedAgent: relationship({ ref: "User.assignedProperties", access: { create: permissions.canManagePeople, update: permissions.canManagePeople } }),
    leads: relationship({ ref: "Lead.property", many: true, access: { create: () => false, update: () => false } }),
    showings: relationship({ ref: "Showing.property", many: true, access: { create: () => false, update: () => false } }),
    savedBy: relationship({ ref: "SavedProperty.property", many: true, access: { create: () => false, update: () => false } }),
    listingEngagementAuthorities: relationship({ ref: 'ListingEngagementAuthority.property', many: true, access: { create: () => false, update: () => false } }),
    listingPublicationAuthorities: relationship({ ref: 'ListingPublicationAuthority.property', many: true, access: { create: () => false, update: () => false } }),
    representationAuthorities: relationship({ ref: 'RepresentationAuthority.property', many: true, access: { create: () => false, update: () => false } }),
    addressLabel: virtual({
      field: graphql.field({
        type: graphql.String,
        resolve(item: any) {
          return [item.addressLine1, item.city, item.state].filter(Boolean).join(", ");
        },
      }),
    }),
    publicImagePack: virtual({
      field: graphql.field({
        type: graphql.object<{
          propertyImagePath?: string;
          agentImagePath?: string;
          neighborhoodImagePath?: string;
        }>()({
          name: "PropertyPublicImagePack",
          fields: {
            propertyImagePath: graphql.field({ type: graphql.String, resolve: (item) => item.propertyImagePath }),
            agentImagePath: graphql.field({ type: graphql.String, resolve: (item) => item.agentImagePath }),
            neighborhoodImagePath: graphql.field({ type: graphql.String, resolve: (item) => item.neighborhoodImagePath }),
          },
        }),
        async resolve(item: any, _args, context) {
          const property = await context.sudo().query.Property.findOne({
            where: { id: item.id },
            query: "slug primaryImageUrl neighborhood assignedAgent { email avatarUrl }",
          });

          return {
            propertyImagePath: getPropertyImagePath(property || item),
            agentImagePath: getAgentImagePath(property?.assignedAgent),
            neighborhoodImagePath: getNeighborhoodImagePath(property?.neighborhood || item.neighborhood),
          };
        },
      }),
      ui: { query: "{ propertyImagePath agentImagePath neighborhoodImagePath }" },
    }),
    ...trackingFields,
  },
});
