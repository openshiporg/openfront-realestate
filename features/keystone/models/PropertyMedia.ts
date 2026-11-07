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

/** One hero per property: promoting a photo demotes the previous hero (a partial unique index backs this). */
function withSingleHero<T extends { beforeOperation?: (args: any) => any }>(hooks: T): T {
  return {
    ...hooks,
    async beforeOperation(args: any) {
      await hooks.beforeOperation?.(args)
      const { operation, resolvedData, item, inputData, context } = args
      if ((operation !== 'create' && operation !== 'update') || resolvedData?.isHero !== true) return
      const propertyId = item?.propertyId || inputData?.property?.connect?.id
      if (!propertyId) return
      const sudo = context.sudo()
      const others = await sudo.db.PropertyMedia.findMany({
        where: { property: { id: { equals: propertyId } }, isHero: { equals: true }, ...(item?.id ? { id: { not: { equals: item.id } } } : {}) },
      })
      for (const other of others) await sudo.db.PropertyMedia.updateOne({ where: { id: String(other.id) }, data: { isHero: false } })
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
  hooks: withSingleHero(withMediaSource(createTenantOwnedHooks({ listKey: 'PropertyMedia', parents: { property: 'Property' }, required: ['property'], deriveOnly: true }))),
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
