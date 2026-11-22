/** Server start-up: the one-minute payment sweep runs inside the Node server, once per process. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (process.env.NEXT_PHASE === 'phase-production-build') return
  const { startPaymentSweep } = await import('./features/keystone/lib/paymentSweep')
  startPaymentSweep()
}
