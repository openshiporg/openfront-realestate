import type { ReactNode } from 'react'
import { ListingsMap, type MapPin } from './ListingsMap'
import { ResultsSheet } from './ResultsSheet'
import type { MapArea } from '../lib/map-area'

/**
 * Map-first search. From 64rem the map holds the left of the page while the results scroll beside it.
 * On a phone or tablet the map fills the screen and the results ride over it in a draggable sheet,
 * which carries the footer at its foot. The detail variant keeps its map beside the home on desktop.
 */
export function SearchSplit({ pins, activeId, children, variant = 'results', overlay, sheetLabel, footer, area = null, searchable = false }: {
  pins: MapPin[]
  activeId?: string
  children: ReactNode
  variant?: 'results' | 'detail'
  overlay?: ReactNode
  /** The count the phone sheet shows while it is lowered. */
  sheetLabel?: string
  /** Rendered inside the phone sheet; the page renders its own footer from 64rem. */
  footer?: ReactNode
  area?: MapArea | null
  searchable?: boolean
}) {
  return (
    <div className="sf-split" data-variant={variant}>
      <div className="sf-split__map">
        <ListingsMap pins={pins} activeId={activeId} area={area} searchable={searchable} />
        {overlay ? <div className="sf-split__overlay">{overlay}</div> : null}
      </div>
      {variant === 'results'
        ? <ResultsSheet label={sheetLabel} footer={footer}>{children}</ResultsSheet>
        : <div className="sf-split__main">{children}</div>}
    </div>
  )
}
