'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, ArrowUpRight, Building2, CircleCheck, Home, Loader2, Building } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import seed from '../lib/seed.json'
import expansionSeed from '../lib/expansion-seed.json'
import { applyOnboarding, dismissOnboarding, startOnboarding } from '../actions/onboarding'

type Template = 'minimal' | 'full'
type Step = 'template' | 'progress' | 'done'
type Summary = { created: number; skipped: number; total: number }

const SECTION_TITLES: Array<{ key: keyof typeof seed.sections; title: string }> = [
  { key: 'agents', title: 'Agents' },
  { key: 'properties', title: 'Listings' },
  { key: 'routingRules', title: 'Lead routing' },
  { key: 'leads', title: 'Leads' },
  { key: 'showings', title: 'Showings' },
  { key: 'deals', title: 'Deals' },
]

const OPERATIONS_LABELS: Record<string, string> = {
  Neighborhood: 'Neighborhood guide',
  PropertyMedia: 'Listing photos',
  PropertyInspection: 'Inspection',
  Offer: 'Accepted offer',
  DealDocument: 'Seller disclosure',
  Commission: 'Commission',
  SavedSearch: 'Saved search',
  SavedProperty: 'Saved property',
  MarketComp: 'Market comp',
  AgentTeam: 'Agent team',
  AgentTask: 'Agent task',
  ListingSyndication: 'MLS syndication',
  SourceFeed: 'Listing feed',
  OpenHouse: 'Open house',
  ShowingFeedback: 'Showing feedback',
  Escrow: 'Escrow',
  TitleOrder: 'Title order',
  MortgageApplication: 'Mortgage application',
  TransactionMilestone: 'Closing milestone',
  PropertyValuation: 'Valuation',
  Disclosure: 'HOA disclosure',
  SavedSearchAlert: 'Saved-search alert',
}

const TEMPLATES: Array<{ value: Template; title: string; description: string; icon: typeof Home }> = [
  { value: 'minimal', title: 'Basic setup', description: seed.templateModes.minimal, icon: Home },
  { value: 'full', title: 'Complete setup', description: seed.templateModes.full, icon: Building },
]

function sectionItems(template: Template) {
  return SECTION_TITLES.map(({ key, title }) => ({
    title,
    items: seed.sections[key].items.filter(item => item.templates.includes(template)).map(item => item.label),
  }))
}

type Props = { isOpen: boolean; onClose: () => void }

export function OnboardingDialog({ isOpen, onClose }: Props) {
  const router = useRouter()
  const [template, setTemplate] = useState<Template>('full')
  const [step, setStep] = useState<Step>('template')
  const [error, setError] = useState('')
  const [summary, setSummary] = useState<{ core?: Summary | null; expansion?: Summary | null } | null>(null)
  const [pending, startTransition] = useTransition()
  const isLoading = step === 'progress'

  const sections = useMemo(() => sectionItems(template), [template])
  const operations = useMemo(
    () => template === 'full' ? expansionSeed.records.map(record => OPERATIONS_LABELS[record.listKey] || record.listKey) : [],
    [template]
  )

  const close = () => {
    if (isLoading) return
    if (step === 'done') router.refresh()
    setStep('template')
    setError('')
    onClose()
  }

  const run = () => {
    setError('')
    setStep('progress')
    startTransition(async () => {
      await startOnboarding()
      const result = await applyOnboarding(template)
      if (result.success) {
        setSummary({ core: result.core, expansion: result.expansion })
        setStep('done')
      } else {
        setError(result.error || 'Brokerage setup failed.')
        setStep('template')
      }
    })
  }

  const skip = () => {
    setError('')
    startTransition(async () => {
      const result = await dismissOnboarding()
      if (result.success) {
        onClose()
        router.refresh()
      } else setError(result.error || 'Could not skip setup.')
    })
  }

  const created = (summary?.core?.created || 0) + (summary?.expansion?.created || 0)
  const existing = (summary?.core?.skipped || 0) + (summary?.expansion?.skipped || 0)

  const actions = step === 'done' ? (
    <div className="flex w-full flex-col gap-2 sm:flex-row">
      <Button type="button" variant="outline" className="min-h-11 flex-1" onClick={close}>Close</Button>
      <Button asChild className="min-h-11 flex-1">
        <a href="/" target="_blank" rel="noopener noreferrer">
          View your website
          <ArrowUpRight className="ml-1.5 size-4" aria-hidden />
        </a>
      </Button>
    </div>
  ) : (
    <div className="flex w-full flex-col gap-2 sm:flex-row">
      <Button type="button" variant="ghost" className="min-h-11 flex-1" disabled={isLoading || pending} onClick={skip}>Skip setup</Button>
      <Button type="button" className="min-h-11 flex-1" disabled={isLoading || pending} onClick={run}>
        {isLoading ? <><Loader2 className="mr-2 size-4 animate-spin" aria-hidden />Setting up…</> : error ? 'Retry setup' : 'Confirm'}
      </Button>
    </div>
  )

  return (
    <Dialog open={isOpen} onOpenChange={open => { if (!open) close() }}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] max-w-[95vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="mb-0 shrink-0 border-b px-4 py-4 sm:px-6">
          <DialogTitle>Brokerage setup</DialogTitle>
          <DialogDescription className="sr-only">Choose starter data for your brokerage.</DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
          <div className="flex shrink-0 flex-col lg:w-80 lg:border-r">
            <div className="flex-1 p-4 sm:p-6">
              <div className="flex items-center gap-3">
                <div className="inline-flex shrink-0 items-center justify-center rounded-sm bg-muted p-3">
                  <Building2 className="size-5 text-foreground" aria-hidden />
                </div>
                <div className="space-y-0.5">
                  <h3 className="text-sm font-medium text-foreground">Starter data</h3>
                  <p className="text-sm text-muted-foreground">
                    {step === 'done' ? 'Your brokerage is ready' : 'Agents, listings, leads, and deals'}
                  </p>
                </div>
              </div>
              <Separator className="my-4" />

              {step === 'done' ? (
                <div className="space-y-3 text-sm">
                  <h4 className="font-medium text-foreground">Setup complete</h4>
                  <p className="text-muted-foreground">
                    Your {template === 'minimal' ? 'basic' : 'complete'} brokerage setup is saved. Review your website settings and invite your team next.
                  </p>
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <CircleCheck className="size-4 fill-muted-foreground text-background" aria-hidden />
                    {created} record{created === 1 ? '' : 's'} created
                  </p>
                  {existing ? (
                    <p className="flex items-center gap-2 text-muted-foreground">
                      <CircleCheck className="size-4 fill-muted-foreground text-background" aria-hidden />
                      {existing} existing record{existing === 1 ? '' : 's'} kept
                    </p>
                  ) : null}
                </div>
              ) : isLoading ? (
                <div className="space-y-1">
                  <h4 className="text-sm font-medium text-foreground">
                    Creating {template === 'minimal' ? 'basic' : 'complete'} setup
                  </h4>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Adding agents, listings, leads, showings, and deals to your brokerage. This can take a minute.
                  </p>
                </div>
              ) : (
                <>
                  <h4 className="mb-4 text-sm font-medium text-foreground">Setup type</h4>
                  <RadioGroup value={template} onValueChange={value => setTemplate(value as Template)} className="space-y-3">
                    {TEMPLATES.map(option => {
                      const Icon = option.icon
                      const selected = template === option.value
                      return (
                        <Label
                          key={option.value}
                          htmlFor={`onboarding-${option.value}`}
                          className={`flex cursor-pointer gap-4 rounded-md border p-4 transition-colors ${selected ? 'border-primary bg-primary/5' : 'hover:border-primary/40'}`}
                        >
                          <RadioGroupItem value={option.value} id={`onboarding-${option.value}`} className="sr-only" />
                          <Icon className={`mt-0.5 size-5 shrink-0 ${selected ? 'text-primary' : 'text-muted-foreground'}`} aria-hidden />
                          <span className="flex-1">
                            <span className="mb-1 block text-base font-medium">{option.title}</span>
                            <span className="block text-sm font-normal text-muted-foreground">{option.description}</span>
                          </span>
                        </Label>
                      )
                    })}
                  </RadioGroup>
                </>
              )}
            </div>

            <div className="flex flex-col border-t">
              {error && !isLoading && step !== 'done' ? (
                <div role="alert" className="flex items-start gap-3 border-b bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>{error} Records already created will be kept when you retry.</span>
                </div>
              ) : null}
              <div className="p-4">{actions}</div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="grid gap-5 sm:grid-cols-2">
              {sections.map(section => (
                <section key={section.title} aria-label={section.title}>
                  <h4 className="mb-2 text-sm font-medium text-foreground">{section.title}</h4>
                  <ul className="space-y-1.5">
                    {section.items.map(item => (
                      <li key={item} className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${step === 'done' ? 'border-primary/20 bg-primary/5' : ''}`}>
                        {step === 'done'
                          ? <CircleCheck className="size-3.5 shrink-0 fill-primary text-background" aria-hidden />
                          : isLoading
                            ? <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" aria-hidden />
                            : <span className="size-3.5 shrink-0 rounded-full border" aria-hidden />}
                        <span className="truncate">{item}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
              {operations.length ? (
                <section aria-label="Transaction operations" className="sm:col-span-2">
                  <h4 className="mb-2 text-sm font-medium text-foreground">Transaction operations</h4>
                  <ul className="flex flex-wrap gap-1.5">
                    {operations.map(item => (
                      <li key={item} className={`rounded-md border px-2.5 py-1 text-xs ${step === 'done' ? 'border-primary/20 bg-primary/5' : 'text-muted-foreground'}`}>{item}</li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default OnboardingDialog
