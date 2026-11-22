import { keystoneContext } from '../context'
import { reconcileOpenPayments } from '../mutations/payments'

const EVERY_MS = 60_000

/** One timer per server process; a run never overlaps the last one. */
export function startPaymentSweep() {
  const state = globalThis as { __paymentSweep?: ReturnType<typeof setInterval> }
  if (state.__paymentSweep) return
  let running = false
  const run = async () => {
    if (running) return
    running = true
    try {
      const result = await reconcileOpenPayments(keystoneContext)
      if (result.changed) console.log(`Payment sweep: ${result.changed} of ${result.checked} open payment(s) settled`)
    } catch (error) {
      console.error('Payment sweep failed', error instanceof Error ? error.message : error)
    } finally {
      running = false
    }
  }
  state.__paymentSweep = setInterval(run, EVERY_MS)
  state.__paymentSweep.unref?.()
  setTimeout(run, 15_000).unref?.()
  console.log('Payment sweep started (every 60 s)')
}
