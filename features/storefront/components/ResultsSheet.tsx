'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { List, Map as MapIcon } from 'lucide-react'
import { releaseSnap, rubberBand, snapOffsets, stepSnap, type Snap } from '../lib/sheet-snaps'
import { listingCard, reducedMotion, SHOW_LISTING_EVENT, type ShowListingDetail } from '../lib/map-events'

const PHONE = '(max-width: 63.99rem)'
// Enough of the sheet to read its count and the top of the first home.
const PEEK = 148
// A finger has to travel this far before the sheet decides it is being dragged.
const SLOP = 6

type Drag = { startY: number; startOffset: number; samples: Array<[number, number]>; active: boolean; pointer?: number }

/**
 * The phone results: a sheet over a full-screen map that rests at a peek, half the screen or the
 * whole list. Drag the handle (or the list when it cannot scroll further up) to move it; a quick
 * flick carries it to the next stop. The handle is also a button: tap or Arrow keys step it.
 * Choosing a map pin raises the sheet to that home. From 64rem it is simply the results column.
 */
export function ResultsSheet({ children, footer, label }: { children: ReactNode; footer?: ReactNode; label?: string }) {
  const sheet = useRef<HTMLDivElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const drag = useRef<Drag | null>(null)
  // When the last drag ended; a click right after it is the drag's own release, not a tap.
  const dragged = useRef(0)
  const [snap, setSnap] = useState<Snap>('half')
  const [height, setHeight] = useState(0)
  const [live, setLive] = useState(false)
  const offsets = snapOffsets(height, PEEK)

  useEffect(() => {
    const query = window.matchMedia(PHONE)
    const sync = () => setLive(query.matches)
    sync()
    query.addEventListener('change', sync)
    const element = sheet.current
    const observer = new ResizeObserver(() => setHeight(element?.offsetHeight || 0))
    if (element) observer.observe(element)
    return () => {
      query.removeEventListener('change', sync)
      observer.disconnect()
    }
  }, [])

  const place = useCallback((offset: number | null) => {
    const element = sheet.current
    if (!element) return
    if (offset === null) {
      element.removeAttribute('data-dragging')
      element.style.removeProperty('--sf-sheet-drag')
    } else {
      element.setAttribute('data-dragging', '')
      element.style.setProperty('--sf-sheet-drag', `${offset}px`)
    }
  }, [])

  // A chosen pin brings its card to the top of the list, with the sheet at least half way up.
  useEffect(() => {
    if (!live) return
    const show = (event: Event) => {
      const { id } = (event as CustomEvent<ShowListingDetail>).detail
      const card = listingCard(id)
      const scroller = body.current
      if (!card || !scroller || !scroller.contains(card)) return
      event.preventDefault()
      setSnap(current => current === 'full' ? 'full' : 'half')
      const top = card.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 12
      scroller.scrollTo({ top, behavior: reducedMotion() ? 'auto' : 'smooth' })
      card.setAttribute('data-highlight', '')
      card.querySelector<HTMLElement>('.sf-card__title a')?.focus({ preventScroll: true })
    }
    window.addEventListener(SHOW_LISTING_EVENT, show)
    return () => window.removeEventListener(SHOW_LISTING_EVENT, show)
  }, [live])

  const begin = (y: number) => {
    drag.current = { startY: y, startOffset: offsets[snap], samples: [[performance.now(), y]], active: false }
  }
  const move = (y: number) => {
    const state = drag.current
    if (!state) return false
    if (!state.active && Math.abs(y - state.startY) < SLOP) return false
    state.active = true
    state.samples = [...state.samples.slice(-4), [performance.now(), y]]
    place(rubberBand(state.startOffset + y - state.startY, offsets.full, offsets.peek))
    return true
  }
  const end = (y: number) => {
    const state = drag.current
    drag.current = null
    if (!state?.active) return
    dragged.current = performance.now()
    const [then, from] = state.samples[0]
    const velocity = (y - from) / Math.max(1, performance.now() - then)
    place(null)
    setSnap(releaseSnap(offsets, state.startOffset + y - state.startY, velocity, state.startOffset))
  }

  // The bar: pointer events, so it drags with a finger, a pen or a mouse. The press is followed on the
  // window, so it keeps tracking once the pointer leaves the bar, while a plain tap still reaches the
  // button under it.
  const handlePointer = {
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
      if (!live || event.button > 0 || event.pointerType === 'touch' && !event.isPrimary) return
      const pointer = event.pointerId
      begin(event.clientY)
      drag.current!.pointer = pointer
      const onMove = (next: PointerEvent) => { if (next.pointerId === pointer && move(next.clientY)) next.preventDefault() }
      const finish = (next: PointerEvent) => {
        if (next.pointerId !== pointer) return
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', finish)
        window.removeEventListener('pointercancel', finish)
        if (next.type === 'pointercancel') { drag.current = null; place(null); return }
        if (drag.current?.pointer === pointer) end(next.clientY)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', finish)
      window.addEventListener('pointercancel', finish)
    },
  }

  // The list: below full it moves the sheet; at full it scrolls, until it is pulled down from its top.
  useEffect(() => {
    const scroller = body.current
    if (!live || !scroller) return
    let startY = 0
    let owner: 'sheet' | 'scroll' | null = null
    const touchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return
      startY = event.touches[0].clientY
      owner = null
      begin(startY)
    }
    const touchMove = (event: TouchEvent) => {
      if (event.touches.length !== 1 || !drag.current) return
      const y = event.touches[0].clientY
      if (owner === null) {
        if (Math.abs(y - startY) < SLOP) return
        const pullingDown = y > startY
        owner = snap !== 'full' || (pullingDown && scroller.scrollTop <= 0) ? 'sheet' : 'scroll'
      }
      if (owner === 'sheet') {
        event.preventDefault()
        move(y)
      }
    }
    const touchEnd = (event: TouchEvent) => {
      if (owner === 'sheet') end(event.changedTouches[0]?.clientY ?? startY)
      else drag.current = null
      owner = null
    }
    scroller.addEventListener('touchstart', touchStart, { passive: true })
    scroller.addEventListener('touchmove', touchMove, { passive: false })
    scroller.addEventListener('touchend', touchEnd)
    scroller.addEventListener('touchcancel', touchEnd)
    return () => {
      scroller.removeEventListener('touchstart', touchStart)
      scroller.removeEventListener('touchmove', touchMove)
      scroller.removeEventListener('touchend', touchEnd)
      scroller.removeEventListener('touchcancel', touchEnd)
    }
    // begin/move/end read the latest offsets through this effect's dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, snap, height])

  // Clicks that end a drag are not taps.
  const swallowDragClick = (event: React.MouseEvent) => {
    if (performance.now() - dragged.current < 350) {
      event.preventDefault()
      event.stopPropagation()
      dragged.current = 0
    }
  }

  const step = (direction: 1 | -1) => setSnap(current => stepSnap(current, direction))
  const toggle = () => setSnap(current => current === 'full' ? 'half' : stepSnap(current, 1))

  return (
    <div
      ref={sheet}
      className="sf-split__main sf-sheet"
      data-snap={snap}
      data-live={live || undefined}
      style={{ '--sf-sheet-y': `${offsets[snap]}px` } as React.CSSProperties}
      onClickCapture={swallowDragClick}
    >
      <div className="sf-sheet__bar" {...handlePointer}>
        <button
          type="button"
          className="sf-sheet__handle"
          aria-expanded={snap === 'full'}
          aria-controls="sf-sheet-body"
          aria-label={snap === 'full' ? 'Show more map' : 'Show more results'}
          onClick={toggle}
          onKeyDown={event => {
            if (event.key === 'ArrowUp') { event.preventDefault(); step(1) }
            if (event.key === 'ArrowDown') { event.preventDefault(); step(-1) }
          }}
        >
          <span className="sf-sheet__grip" aria-hidden />
        </button>
        <div className="sf-sheet__head">
          {label ? <strong className="sf-num">{label}</strong> : <span />}
          {snap === 'full'
            ? <button type="button" className="sf-sheet__switch" onClick={() => setSnap('peek')}><MapIcon aria-hidden />Map</button>
            : <button type="button" className="sf-sheet__switch" onClick={() => setSnap('full')}><List aria-hidden />List</button>}
        </div>
      </div>
      <div ref={body} id="sf-sheet-body" className="sf-sheet__body" onFocus={() => { if (live && snap === 'peek') setSnap('half') }}>
        {children}
        {footer ? <div className="sf-sheet__footer">{footer}</div> : null}
      </div>
    </div>
  )
}
