import type { ReactNode } from 'react'
import { getBrokerageSettings } from '../lib/data/settings'
import { StorefrontNav } from './StorefrontNav'
import { StorefrontFooter } from './StorefrontFooter'

/** Storefront chrome for pages outside the home page (account, not found). */
export async function AccountShell({ children }: { children: ReactNode }) {
  const state = await getBrokerageSettings()
  return <>{state.status === 'ready' ? <StorefrontNav settings={state.settings} /> : null}{children}{state.status === 'ready' ? <StorefrontFooter settings={state.settings} /> : null}</>
}
