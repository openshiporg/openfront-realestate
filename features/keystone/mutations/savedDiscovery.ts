import type { Context } from '.keystone/types'

import { activeBrokerageIds } from '../access'
import { freshOperatorCommandContext } from '../lib/commandContext'
import { lockSavedDiscoveryIdentity } from '../lib/savedDiscoveryIdentity'

type SavedPropertyStatus = 'saved' | 'interested' | 'hidden'
type SavePropertyInput = { propertyId: string; status?: SavedPropertyStatus | null; notes?: string | null }
type SavedPropertyIdInput = { savedPropertyId: string }
type SaveSearchInput = {
  name: string
  city?: string | null
  state?: string | null
  propertyType?: string | null
  minPrice?: string | null
  maxPrice?: string | null
  minBedrooms?: number | null
  minBathrooms?: string | null
  minSquareFeet?: number | null
  keywords?: string | null
  alertsEnabled?: boolean | null
}
type SavedSearchIdInput = { savedSearchId: string }
type SavedDiscoveryResult = { ok: boolean; message: string; itemId: string | null }
type SavedDiscoveryRecordIdentity = { itemId: string; userId: string; brokerageId: string; target: string }

function userId(context: Context) {
  return (context.session as any)?.itemId as string | undefined
}

function clean(value?: string | null) {
  return String(value || '').trim()
}

function unauthenticated() {
  return { ok: false, message: 'Sign in to save property discovery preferences.', itemId: null }
}

function savedPropertyStatus(value?: SavedPropertyStatus | null): SavedPropertyStatus {
  return value && ['saved', 'interested', 'hidden'].includes(value) ? value : 'saved'
}

async function withSavedDiscoveryLock<T>(
  context: Context,
  kind: 'property' | 'search',
  target: string,
  execute: (scoped: Context, currentUserId: string, brokerageId: string) => Promise<T>,
): Promise<T> {
  return context.transaction(async transactionContext => {
    const scoped = await freshOperatorCommandContext(
      context.session ? transactionContext.withSession(context.session) : transactionContext,
    )
    const currentUserId = userId(scoped)
    const brokerageId = activeBrokerageIds(scoped.session as any)[0]
    if (!currentUserId || !brokerageId) throw new Error('An active brokerage membership is required.')
    await lockSavedDiscoveryIdentity((scoped.sudo() as any).prisma, kind, brokerageId, currentUserId, target)
    return execute(scoped, currentUserId, brokerageId)
  }, { timeout: 30_000 })
}

async function withSavedDiscoveryRecordLock(
  context: Context,
  kind: 'property' | 'search',
  recordId: string,
  notFoundMessage: string,
  readIdentity: (scoped: Context, recordId: string) => Promise<SavedDiscoveryRecordIdentity | null>,
  remove: (scoped: Context, recordId: string) => Promise<SavedDiscoveryResult>,
): Promise<SavedDiscoveryResult> {
  const notFound = (): SavedDiscoveryResult => ({ ok: false, message: notFoundMessage, itemId: null })
  return context.transaction(async transactionContext => {
    const scoped = await freshOperatorCommandContext(
      context.session ? transactionContext.withSession(context.session) : transactionContext,
    )
    const currentUserId = userId(scoped)
    const brokerageId = activeBrokerageIds(scoped.session as any)[0]
    if (!currentUserId || !brokerageId) return notFound()

    const beforeLock = await readIdentity(scoped, recordId)
    if (!isOwnedRecordIdentity(beforeLock, recordId, currentUserId, brokerageId)) return notFound()
    await lockSavedDiscoveryIdentity((scoped.sudo() as any).prisma, kind, brokerageId, currentUserId, beforeLock.target)

    const afterLock = await readIdentity(scoped, recordId)
    if (!isOwnedRecordIdentity(afterLock, recordId, currentUserId, brokerageId) || !sameRecordIdentity(beforeLock, afterLock)) {
      return notFound()
    }
    return remove(scoped, afterLock.itemId)
  }, { timeout: 30_000 })
}

function isOwnedRecordIdentity(
  identity: SavedDiscoveryRecordIdentity | null,
  recordId: string,
  currentUserId: string,
  brokerageId: string,
): identity is SavedDiscoveryRecordIdentity {
  return Boolean(identity && identity.itemId === recordId && identity.userId === currentUserId && identity.brokerageId === brokerageId && identity.target)
}

function sameRecordIdentity(left: SavedDiscoveryRecordIdentity, right: SavedDiscoveryRecordIdentity) {
  return left.itemId === right.itemId && left.userId === right.userId && left.brokerageId === right.brokerageId && left.target === right.target
}

export async function savePropertyForCurrentUser(
  _root: unknown,
  { data }: { data: SavePropertyInput },
  context: Context
) {
  const currentUserId = userId(context)
  if (!currentUserId) return unauthenticated()
  const propertyId = clean(data.propertyId)
  if (!propertyId) return { ok: false, message: 'Choose a property to save.', itemId: null }
  if (!activeBrokerageIds(context.session as any).length) return { ok: false, message: 'This property is not available to save.', itemId: null }

  const savedStatus = savedPropertyStatus(data.status)
  return withSavedDiscoveryLock(context, 'property', propertyId, async (scoped, lockedUserId, brokerageId) => {
    if (lockedUserId !== currentUserId) return unauthenticated()
    const sudo = scoped.sudo()
    const property = await sudo.query.Property.findOne({ where: { id: propertyId }, query: 'id status brokerage { id }' })
    if (!property || property.brokerage?.id !== brokerageId || !['active', 'coming_soon'].includes(property.status)) {
      return { ok: false, message: 'This property is not available to save.', itemId: null }
    }

    const existing = await sudo.query.SavedProperty.findMany({
      where: { user: { id: { equals: lockedUserId } }, property: { id: { equals: propertyId } } },
      take: 2,
      query: 'id',
    })
    if (existing.length > 1) return { ok: false, message: 'This property is saved more than once. Remove the duplicate and try again.', itemId: null }
    if (existing[0]?.id) {
      const item = await sudo.query.SavedProperty.updateOne({
        where: { id: existing[0].id },
        data: { status: savedStatus, notes: clean(data.notes) },
        query: 'id',
      })
      return { ok: true, message: 'Saved property updated.', itemId: item.id }
    }

    const item = await sudo.query.SavedProperty.createOne({
      data: {
        status: savedStatus,
        notes: clean(data.notes),
        property: { connect: { id: propertyId } },
        user: { connect: { id: lockedUserId } },
      },
      query: 'id',
    })
    return { ok: true, message: 'Property saved.', itemId: item.id }
  })
}

export async function removeSavedPropertyForCurrentUser(
  _root: unknown,
  { data }: { data: SavedPropertyIdInput },
  context: Context
) {
  const currentUserId = userId(context)
  if (!currentUserId) return unauthenticated()
  const id = clean(data.savedPropertyId)
  if (!id || !activeBrokerageIds(context.session as any).length) return { ok: false, message: 'Saved property not found.', itemId: null }

  return withSavedDiscoveryRecordLock(
    context,
    'property',
    id,
    'Saved property not found.',
    async (scoped, recordId) => {
      const item = await scoped.sudo().query.SavedProperty.findOne({
        where: { id: recordId },
        query: 'id user { id } property { id brokerage { id status } }',
      })
      const propertyId = typeof item?.property?.id === 'string' ? item.property.id : ''
      const brokerage = item?.property?.brokerage
      if (!item?.id || !item.user?.id || !propertyId || clean(propertyId) !== propertyId || !brokerage?.id || brokerage.status !== 'active') return null
      return { itemId: item.id, userId: item.user.id, brokerageId: brokerage.id, target: propertyId }
    },
    async (scoped, recordId) => {
      await scoped.sudo().query.SavedProperty.deleteOne({ where: { id: recordId }, query: 'id' })
      return { ok: true, message: 'Saved property removed.', itemId: recordId }
    },
  )
}

export async function saveSearchForCurrentUser(
  _root: unknown,
  { data }: { data: SaveSearchInput },
  context: Context
) {
  const currentUserId = userId(context)
  if (!currentUserId) return unauthenticated()
  const name = clean(data.name)
  if (!name) return { ok: false, message: 'Name the search before saving it.', itemId: null }
  if (!activeBrokerageIds(context.session as any).length) return { ok: false, message: 'An active brokerage membership is required.', itemId: null }

  return withSavedDiscoveryLock(context, 'search', name, async (scoped, lockedUserId, brokerageId) => {
    if (lockedUserId !== currentUserId) return unauthenticated()
    const sudo = scoped.sudo()
    const existing = await sudo.query.SavedSearch.findMany({
      where: { brokerage: { id: { equals: brokerageId } }, user: { id: { equals: lockedUserId } }, name: { equals: name } },
      take: 2,
      query: 'id',
    })
    if (existing.length > 1) return { ok: false, message: 'A saved search with this name already exists more than once. Remove the duplicate and try again.', itemId: null }
    const values = {
      name,
      city: clean(data.city),
      state: clean(data.state),
      propertyType: clean(data.propertyType),
      minPrice: clean(data.minPrice) || null,
      maxPrice: clean(data.maxPrice) || null,
      minBedrooms: data.minBedrooms ?? null,
      minBathrooms: clean(data.minBathrooms) || null,
      minSquareFeet: data.minSquareFeet ?? null,
      keywords: clean(data.keywords),
      alertsEnabled: data.alertsEnabled ?? true,
    }
    if (existing[0]?.id) {
      const item = await sudo.query.SavedSearch.updateOne({ where: { id: existing[0].id }, data: values, query: 'id' })
      return { ok: true, message: 'Saved search updated.', itemId: item.id }
    }

    const item = await sudo.query.SavedSearch.createOne({
      data: { ...values, brokerage: { connect: { id: brokerageId } }, user: { connect: { id: lockedUserId } } },
      query: 'id',
    })
    return { ok: true, message: 'Search saved.', itemId: item.id }
  })
}

export async function deleteSavedSearchForCurrentUser(
  _root: unknown,
  { data }: { data: SavedSearchIdInput },
  context: Context
) {
  const currentUserId = userId(context)
  if (!currentUserId) return unauthenticated()
  const id = clean(data.savedSearchId)
  if (!id || !activeBrokerageIds(context.session as any).length) return { ok: false, message: 'Saved search not found.', itemId: null }

  return withSavedDiscoveryRecordLock(
    context,
    'search',
    id,
    'Saved search not found.',
    async (scoped, recordId) => {
      const item = await scoped.sudo().query.SavedSearch.findOne({
        where: { id: recordId },
        query: 'id name user { id } brokerage { id status }',
      })
      const name = typeof item?.name === 'string' ? item.name : ''
      const brokerage = item?.brokerage
      if (!item?.id || !name || clean(name) !== name || !item.user?.id || !brokerage?.id || brokerage.status !== 'active') return null
      return { itemId: item.id, userId: item.user.id, brokerageId: brokerage.id, target: name }
    },
    async (scoped, recordId) => {
      await scoped.sudo().query.SavedSearch.deleteOne({ where: { id: recordId }, query: 'id' })
      return { ok: true, message: 'Saved search deleted.', itemId: recordId }
    },
  )
}
