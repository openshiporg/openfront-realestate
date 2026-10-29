import { NextRequest, NextResponse } from 'next/server'
import { keystoneContext } from '@/features/keystone/context'
import { handlePaymentProviderWebhook } from '@/features/keystone/mutations/payments'

const MAX_BYTES = 1_000_000

export async function POST(request: NextRequest, { params }: { params: Promise<{ providerId: string }> }) {
  const declared = Number(request.headers.get('content-length') || 0)
  if (declared > MAX_BYTES) return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
  // The signature covers the exact bytes, so read the raw text and never re-serialize it.
  const rawBody = await request.text()
  if (Buffer.byteLength(rawBody) > MAX_BYTES) return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
  const { providerId } = await params
  const result = await handlePaymentProviderWebhook(keystoneContext, providerId, rawBody, Object.fromEntries(request.headers.entries()))
  return NextResponse.json(result.body, { status: result.status })
}
