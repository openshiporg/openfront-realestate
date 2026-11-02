import { list } from "@keystone-6/core";
import { checkbox, image, integer, relationship, select, text } from "@keystone-6/core/fields";

import { canCreateForManagedProperty, permissions, rules } from "../access";
import { createTenantOwnedHooks } from '../lib/tenantOwnedHooks';
import { trackingFields } from "./trackingFields";
import { mediaSourceProblem } from "../lib/propertyMediaSource";

/** Every media item needs an uploaded image or a link. */
function withMediaSource<T extends { validateInput?: (args: any) => any }>(hooks: T): T {
  return {
    ...hooks,
    async validateInput(args: any) {
      const { resolvedData, item, addValidationError } = args
      const problem = mediaSourceProblem({
        imageId: resolvedData?.image?.id !== undefined ? resolvedData.image.id : item?.image_id,
        url: resolvedData?.url !== undefined ? resolvedData.url : item?.url,
      })
      if (problem) addValidationError(problem)
      await hooks.validateInput?.(args)
    },
  }
}

export const PropertyMedia = list({
  access: {
    operation: {
      query: permissions.canManageListings,
      create: permissions.canManageListings,
      update: permissions.canManageListings,
      delete: permissions.canManageListings,
    },
    filter: { query: rules.canReadPropertyChildren, update: rules.canManagePropertyChildren, delete: rules.canManagePropertyChildren },
    item: { create: canCreateForManagedProperty },
  },
  hooks: withMediaSource(createTenantOwnedHooks({ listKey: 'PropertyMedia', parents: { property: 'Property' }, required: ['property'], deriveOnly: true })),
  ui: { listView: { initialColumns: ["image", "title", "mediaType", "property", "sortOrder", "isHero"] } },
  fields: {
    title: text({ validation: { isRequired: true } }),
    mediaType: select({
      type: "enum",
      options: [
        { label: "Photo", value: "photo" },
        { label: "Floor Plan", value: "floor_plan" },
        { label: "Virtual Tour", value: "virtual_tour" },
        { label: "Video", value: "video" },
        { label: "Document", value: "document" },
      ],
      defaultValue: "photo",
      validation: { isRequired: true },
    }),
    // An uploaded photo lives in S3; `url` remains for tours, videos, documents and older photos.
    image: image({ storage: "my_images" }),
    url: text(),
    altText: text(),
    caption: text({ ui: { displayMode: "textarea" } }),
    sortOrder: integer({ defaultValue: 0 }),
    isHero: checkbox({ defaultValue: false }),
    property: relationship({ ref: "Property", access: { update: () => false } }),
    ...trackingFields,
  },
});
