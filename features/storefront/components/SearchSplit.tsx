import type { ReactNode } from 'react'
import { ListingsMap, type MapPin } from './ListingsMap'

/** Map-first search: the map holds the left of the page while the results scroll beside it. */
export function SearchSplit({ pins, activeId, children, variant = 'results', overlay }: { pins: MapPin[]; activeId?: string; children: ReactNode; variant?: 'results' | 'detail'; overlay?: ReactNode }) {
  return (
    <div className="sf-split" data-variant={variant}>
      <div className="sf-split__map">
        <ListingsMap pins={pins} activeId={activeId} />
        {overlay ? <div className="sf-split__overlay">{overlay}</div> : null}
      </div>
      <div className="sf-split__main">{children}</div>
    </div>
  )
}
