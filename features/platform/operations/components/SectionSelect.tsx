'use client'

import { useEffect, useId } from 'react'
import { useRouter } from 'next/navigation'

/** Phone section switcher: a native select that navigates to the chosen section. Also maps legacy #anchors to tabs. */
export function SectionSelect({ current, sections }: { current: string; sections: Array<{ value: string; label: string; href: string; count?: number | null }> }) {
  const router = useRouter()
  const id = useId()
  /* Old links used #section anchors (e.g. /operations#commissions); send them to the matching tab. */
  useEffect(() => {
    const hash = window.location.hash.slice(1)
    const target = hash ? sections.find(section => section.value === hash) : undefined
    if (target && target.value !== current) router.replace(target.href)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <div className="md:hidden">
      <label htmlFor={id} className="sr-only">Operations section</label>
      <select
        id={id}
        value={current}
        onChange={event => {
          const target = sections.find(section => section.value === event.target.value)
          if (target) router.push(target.href)
        }}
        className="h-10 w-full rounded-[6px] border border-input bg-background px-3 text-sm font-medium outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {sections.map(section => <option key={section.value} value={section.value}>{section.label}{typeof section.count === 'number' ? ` (${section.count})` : ''}</option>)}
      </select>
    </div>
  )
}
