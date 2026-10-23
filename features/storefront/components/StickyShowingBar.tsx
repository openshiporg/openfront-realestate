'use client'

import { useEffect, useState, type ReactNode } from 'react'

/** Phone-width price bar; steps aside while the showing form itself is on screen. */
export function StickyShowingBar({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    const target = document.getElementById('showing')
    if (!target || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => setHidden(entry.isIntersecting), { threshold: 0 })
    observer.observe(target)
    return () => observer.disconnect()
  }, [])

  return <div className="sf-stickybar" data-hidden={hidden}>{children}</div>
}
