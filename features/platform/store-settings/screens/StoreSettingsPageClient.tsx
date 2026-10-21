'use client'

import { useState } from 'react'
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
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={event => onChange(event.target.value)} required={required} maxLength={maxLength} className="mt-2" />
    </div>
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
      <div className="p-6">
        <div className="text-red-500">Error: {initialError}</div>
      </div>
    )
  }

  const selectedIcon = LOGO_ICONS.find(icon => icon.lightSvg === logoIcon)
  const logoSupported = !logoIcon.trim() || Boolean(sanitizeStoreLogoSvg(logoIcon))
  const colorValue = HUE_PRESETS.some(preset => String(preset.value) === logoColor) ? logoColor : undefined

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Store Settings</h1>

      <div className="space-y-6">
        <TextField id="business-name" label="Business Name" value={businessName} onChange={setBusinessName} required maxLength={120} />

        <div>
          <Label>Logo Icon</Label>
          <div className="mt-2 flex items-center gap-2">
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
              <SelectContent className="border-border dark:border-blue-700">
                {LOGO_ICONS.map(icon => (
                  <SelectItem key={icon.id} value={icon.id}>
                    <span className="flex items-center gap-3">
                      <StoreLogo logoIcon={icon.lightSvg} logoColor={logoColor} className="size-6" />
                      <span className="block font-medium text-gray-900 dark:text-gray-100">{icon.name}</span>
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
                  <h4 className="font-medium">Edit SVG Code</h4>
                  <Textarea
                    value={logoIcon}
                    onChange={event => setLogoIcon(event.target.value)}
                    className="font-mono text-xs min-h-[300px]"
                    placeholder="<svg>...</svg>"
                    aria-label="SVG code"
                  />
                  {logoSupported ? (
                    <div className="flex items-center gap-2">
                      <div className="text-sm text-muted-foreground">Preview:</div>
                      <div className="flex items-center justify-center p-2 border rounded">
                        <StoreLogo logoIcon={logoIcon} logoColor={logoColor} className="size-8" />
                      </div>
                    </div>
                  ) : <p role="alert" className="text-sm text-red-500">This SVG is not supported.</p>}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div>
          <Label>Logo Color</Label>
          <div className="mt-2">
            <Select value={colorValue ?? ''} onValueChange={value => setLogoColor(normalizeStoreLogoColor(value))}>
              <SelectPrimitive.Trigger className={cn(triggerClass)} aria-label="Logo color">
                <SelectValue>
                  <div className="w-6 h-6 rounded-full" style={{ background: swatch(logoColor) }} />
                </SelectValue>
              </SelectPrimitive.Trigger>
              <SelectContent className="border-border dark:border-blue-700">
                <div className="grid grid-cols-4 gap-2 p-2">
                  {HUE_PRESETS.map(preset => (
                    <SelectItem
                      key={preset.value}
                      value={preset.value.toString()}
                      aria-label={preset.name}
                      className="cursor-pointer p-0 h-12 w-12 flex items-center justify-center [&>span:first-child]:hidden"
                    >
                      <div className="w-6 h-6 rounded-full" style={{ background: swatch(preset.value) }} />
                    </SelectItem>
                  ))}
                </div>
              </SelectContent>
            </Select>
          </div>
        </div>

        <TextField id="market-label" label="Market Label" value={marketLabel} onChange={setMarketLabel} required maxLength={120} />
        <div className="grid gap-6 sm:grid-cols-2">
          <TextField id="city" label="City" value={city} onChange={setCity} required maxLength={120} />
          <TextField id="state" label="State" value={state} onChange={setState} required maxLength={80} />
        </div>
        <TextField id="tagline" label="Tagline" value={tagline} onChange={setTagline} required maxLength={220} />

        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" value={description} onChange={event => setDescription(event.target.value)} rows={4} maxLength={1000} className="mt-2" />
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <TextField id="public-phone" label="Public Phone" type="tel" value={publicPhone} onChange={setPublicPhone} maxLength={80} />
          <TextField id="public-email" label="Public Email" type="email" value={publicEmail} onChange={setPublicEmail} maxLength={320} />
        </div>

        <div>
          <Label htmlFor="equal-housing-notice">Equal Housing Notice</Label>
          <Textarea id="equal-housing-notice" value={equalHousingNotice} onChange={event => setEqualHousingNotice(event.target.value)} rows={2} maxLength={240} className="mt-2" />
        </div>

        <div className="max-w-xs">
          <Label htmlFor="showing-duration">Showing Duration (minutes)</Label>
          <Input id="showing-duration" type="number" min={15} max={240} step={5} value={showingDurationMinutes} onChange={event => setShowingDurationMinutes(event.target.value)} className="mt-2" />
        </div>

        <Button onClick={handleSave} disabled={isLoading || !logoSupported}>
          {isLoading ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  )
}
