import { keystoneContext } from '../context'
import { reconcileOpenPayments } from '../mutations/payments'

const EVERY_MS = 60_000
// The minute timer only runs for this long after the last checkout started, so an idle site can sleep.
// A paid checkout left open longer is still settled by the run at the next server start.
const ACTIVE_MS = 30 * 60_000

type SweepState = { __paymentSweep?: ReturnType<typeof setInterval>; __paymentSweepArm?: () => void }

/** One run at start-up, then a minute timer only while a checkout is recent; a run never overlaps the last one. */
export function startPaymentSweep() {
  const state = globalThis as SweepState
  if (state.__paymentSweepArm) return
  let running = false
  let armedAt = 0
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
      if (state.__paymentSweep && Date.now() - armedAt > ACTIVE_MS) {
        clearInterval(state.__paymentSweep)
        state.__paymentSweep = undefined
      }
    }
  }
  state.__paymentSweepArm = () => {
    armedAt = Date.now()
    if (state.__paymentSweep) return
    state.__paymentSweep = setInterval(run, EVERY_MS)
    state.__paymentSweep.unref?.()
  }
  setTimeout(run, 15_000).unref?.()
  console.log('Payment sweep started (at start-up, then every 60 s for 30 min after a checkout starts)')
}
