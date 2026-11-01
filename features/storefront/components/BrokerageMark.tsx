import { normalizeStoreLogoColor } from '@/features/lib/store-logo'
import { storeOwnMark } from '../lib/store-mark'

type BrokerageMarkProps = { className?: string; logoIcon?: string; logoColor?: string }

/**
 * The mark the brokerage set in Store Settings, in its saved colour. With no mark, or only
 * the platform placeholder, nothing renders and the brokerage name stands alone.
 */
export function BrokerageMark({ className = 'sf-brand-mark', logoIcon, logoColor }: BrokerageMarkProps) {
  const svg = storeOwnMark(logoIcon)
  if (!svg) return null
  return <span className={`inline-flex shrink-0 [&>svg]:size-full ${className}`} aria-hidden="true" style={{ filter: `hue-rotate(${normalizeStoreLogoColor(logoColor)}deg)` }} dangerouslySetInnerHTML={{ __html: svg }} />
}
