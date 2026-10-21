import { StoreLogo } from '@/features/lib/store-logo-renderer'

type BrokerageMarkProps = { className?: string; logoIcon?: string; logoColor?: string }
export function BrokerageMark({ className = 'sf-brand-mark', logoIcon, logoColor }: BrokerageMarkProps) {
  return <StoreLogo className={className} logoIcon={logoIcon} logoColor={logoColor} />
}
