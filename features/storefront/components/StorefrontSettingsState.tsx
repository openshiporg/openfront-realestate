import type { BrokerageSettingsState } from '@/features/storefront/lib/data/settings'

export function StorefrontSettingsState({ state }: { state: Exclude<BrokerageSettingsState, { status: 'ready' }> }) {
  const unconfigured = state.status === 'unconfigured'
  return (
    <main className="sf-storefront-status" data-storefront-state={state.status}>
      <div className="sf-state" role={unconfigured ? 'status' : 'alert'}>
        <h1>{unconfigured ? 'Coming soon.' : 'Temporarily unavailable.'}</h1>
        {unconfigured ? null : <p>Please try again later.</p>}
      </div>
    </main>
  )
}
