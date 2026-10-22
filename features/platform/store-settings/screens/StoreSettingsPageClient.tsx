'use client'

import { useState } from 'react'
import type React from 'react'
import * as SelectPrimitive from '@radix-ui/react-select'
import { Code } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { sanitizeStoreLogoSvg } from '@/features/lib/sanitize-store-logo'
import { normalizeStoreLogoColor } from '@/features/lib/store-logo'
import { StoreLogo } from '@/features/lib/store-logo-renderer'
import { LOGO_ICONS, HUE_PRESETS } from '../lib/icon-registry'
import { savePlatformStorefrontSettings, type PlatformStorefrontSettings } from '../actions/storefront-settings'

interface StoreSettingsPageClientProps {
  initialData: PlatformStorefrontSettings | null
  initialError: string | null
}

const swatch = (hue: string | number) => `hsl(${(240 + Number(hue)) % 360}, 70%, 50%)`
const triggerClass = 'flex h-12 w-12 shrink-0 rounded-lg border border-input bg-background focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 p-0 overflow-hidden items-center justify-center'

function TextField({ id, label, value, onChange, required, type = 'text', maxLength }: { id: string; label: string; value: string; onChange: (value: string) => void; required?: boolean; type?: string; maxLength?: number }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={event => onChange(event.target.value)} required={required} maxLength={maxLength} />
    </div>
  )
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 border-t border-border py-6 first:border-t-0 first:pt-0 md:grid-cols-[12rem_minmax(0,1fr)] md:gap-8">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <div className="min-w-0 space-y-5">{children}</div>
    </section>
  )
}

export function StoreSettingsPageClient({ initialData, initialError }: StoreSettingsPageClientProps) {
  const [businessName, setBusinessName] = useState(initialData?.businessName || '')
  const [marketLabel, setMarketLabel] = useState(initialData?.marketLabel || '')
  const [city, setCity] = useState(initialData?.city || '')
  const [state, setState] = useState(initialData?.state || '')
  const [tagline, setTagline] = useState(initialData?.tagline || '')
  const [description, setDescription] = useState(initialData?.description || '')
  const [publicPhone, setPublicPhone] = useState(initialData?.publicPhone || '')
  const [publicEmail, setPublicEmail] = useState(initialData?.publicEmail || '')
  const [equalHousingNotice, setEqualHousingNotice] = useState(initialData?.equalHousingNotice ?? 'Equal housing opportunity.')
  const [showingDurationMinutes, setShowingDurationMinutes] = useState(String(initialData?.showingDurationMinutes ?? 60))
  const [logoIcon, setLogoIcon] = useState(initialData?.logoIcon || LOGO_ICONS[0].lightSvg)
  const [logoColor, setLogoColor] = useState(normalizeStoreLogoColor(initialData?.logoColor || '0'))
  const [isLoading, setIsLoading] = useState(false)

  const handleSave = async () => {
    setIsLoading(true)
    const result = await savePlatformStorefrontSettings({
      businessName,
      marketLabel,
      city,
      state,
      tagline,
      description,
      equalHousingNotice,
      publicPhone,
      publicEmail,
      showingDurationMinutes: Number(showingDurationMinutes),
      logoIcon,
      logoColor,
    })
    if (result.success) toast.success('Store settings updated')
    else toast.error(result.error || 'Store settings could not be saved.')
    setIsLoading(false)
  }

  if (initialError) {
    return (
      <div className="px-4 py-5 md:px-6">
        <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">Store settings could not be loaded. {initialError}</div>
      </div>
    )
  }

  const selectedIcon = LOGO_ICONS.find(icon => icon.lightSvg === logoIcon)
  const logoSupported = !logoIcon.trim() || Boolean(sanitizeStoreLogoSvg(logoIcon))
  const colorValue = HUE_PRESETS.some(preset => String(preset.value) === logoColor) ? logoColor : undefined
  const location = [city, state].filter(Boolean).join(', ')

  return (
    <div className="px-4 pb-24 pt-5 md:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Store Settings</h1>
      </header>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
        <form
          className="min-w-0 max-w-3xl"
          onSubmit={event => { event.preventDefault(); if (!isLoading && logoSupported) void handleSave() }}
        >
          <SettingsSection title="Brand">
            <TextField id="business-name" label="Business name" value={businessName} onChange={setBusinessName} required maxLength={120} />
            <div className="flex flex-wrap gap-6">
              <div className="space-y-2">
                <Label>Logo</Label>
                <div className="flex items-center gap-2">
                  <Select
                    value={selectedIcon?.id || ''}
                    onValueChange={id => {
                      const icon = LOGO_ICONS.find(item => item.id === id)
                      if (icon) setLogoIcon(icon.lightSvg)
                    }}
                  >
                    <SelectPrimitive.Trigger className={cn(triggerClass)} aria-label="Logo icon">
                      <StoreLogo logoIcon={logoIcon} logoColor={logoColor} className="size-6" />
                    </SelectPrimitive.Trigger>
                    <SelectContent className="border-border">
                      {LOGO_ICONS.map(icon => (
                        <SelectItem key={icon.id} value={icon.id}>
                          <span className="flex items-center gap-3">
                            <StoreLogo logoIcon={icon.lightSvg} logoColor={logoColor} className="size-6" />
                            <span className="block font-medium text-foreground">{icon.name}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="icon" className="h-12 w-12 shrink-0" type="button" aria-label="Edit SVG code">
                        <Code className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[min(500px,calc(100vw-2rem))]" align="start">
                      <div className="space-y-4">
                        <h4 className="font-medium">SVG code</h4>
                        <Textarea
                          value={logoIcon}
                          onChange={event => setLogoIcon(event.target.value)}
                          className="min-h-[300px] font-mono text-xs"
                          placeholder="<svg>...</svg>"
                          aria-label="SVG code"
                        />
                        {logoSupported ? null : <p role="alert" className="text-sm text-destructive">This SVG is not supported.</p>}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Colour</Label>
                <Select value={colorValue ?? ''} onValueChange={value => setLogoColor(normalizeStoreLogoColor(value))}>
                  <SelectPrimitive.Trigger className={cn(triggerClass)} aria-label="Logo color">
                    <SelectValue>
                      <div className="h-6 w-6 rounded-full" style={{ background: swatch(logoColor) }} />
                    </SelectValue>
                  </SelectPrimitive.Trigger>
                  <SelectContent className="border-border">
                    <div className="grid grid-cols-4 gap-2 p-2">
                      {HUE_PRESETS.map(preset => (
                        <SelectItem
                          key={preset.value}
                          value={preset.value.toString()}
                          aria-label={preset.name}
                          className="flex h-12 w-12 cursor-pointer items-center justify-center p-0 [&>span:first-child]:hidden"
                        >
                          <div className="h-6 w-6 rounded-full" style={{ background: swatch(preset.value) }} />
                        </SelectItem>
                      ))}
                    </div>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </SettingsSection>

          <SettingsSection title="Market">
            <TextField id="market-label" label="Market label" value={marketLabel} onChange={setMarketLabel} required maxLength={120} />
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField id="city" label="City" value={city} onChange={setCity} required maxLength={120} />
              <TextField id="state" label="State" value={state} onChange={setState} required maxLength={80} />
            </div>
            <TextField id="tagline" label="Headline" value={tagline} onChange={setTagline} required maxLength={220} />
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" value={description} onChange={event => setDescription(event.target.value)} rows={4} maxLength={1000} />
            </div>
          </SettingsSection>

          <SettingsSection title="Contact">
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField id="public-phone" label="Public phone" type="tel" value={publicPhone} onChange={setPublicPhone} maxLength={80} />
              <TextField id="public-email" label="Public email" type="email" value={publicEmail} onChange={setPublicEmail} maxLength={320} />
            </div>
          </SettingsSection>

          <SettingsSection title="Showings & compliance">
            <div className="max-w-xs space-y-2">
              <Label htmlFor="showing-duration">Showing length (minutes)</Label>
              <Input id="showing-duration" type="number" min={15} max={240} step={5} value={showingDurationMinutes} onChange={event => setShowingDurationMinutes(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="equal-housing-notice">Equal housing notice</Label>
              <Textarea id="equal-housing-notice" value={equalHousingNotice} onChange={event => setEqualHousingNotice(event.target.value)} rows={2} maxLength={240} />
            </div>
          </SettingsSection>

          <div className="sticky bottom-0 -mx-4 flex items-center justify-end gap-3 border-t border-border bg-background/90 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
            {!logoSupported ? <p role="alert" className="mr-auto text-sm text-destructive">Unsupported logo SVG</p> : null}
            <Button type="submit" className="rounded-full" disabled={isLoading || !logoSupported}>
              {isLoading ? 'Saving…' : 'Save settings'}
            </Button>
          </div>
        </form>

        <aside className="hidden xl:sticky xl:top-4 xl:block" aria-label="Storefront preview">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Preview</p>
          <div className="overflow-hidden rounded-xl border border-border bg-[#f8f6f1] text-[#23262b] shadow-xs">
            <div className="flex items-center gap-2.5 border-b border-black/10 px-4 py-3">
              <StoreLogo logoIcon={logoSupported ? logoIcon : ''} logoColor={logoColor} className="size-7" />
              <div className="min-w-0 leading-tight">
                <p className="truncate text-sm font-bold">{businessName || 'Business name'}</p>
                <p className="truncate text-[11px] text-black/50">{marketLabel || 'Market label'}</p>
              </div>
            </div>
            <div className="space-y-2 px-4 py-6">
              {location ? <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-black/50">{location}</p> : null}
              <p className="font-serif text-3xl leading-[0.95] tracking-tight">{tagline || 'Headline'}</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
