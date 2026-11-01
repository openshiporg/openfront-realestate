'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { HomePhotoFallback } from './HomePhotoFallback'

export type GalleryPhoto = { imagePath: string; altText: string; caption: string }

/** The listing's photos: one large photo with two beside it, and every photo in a viewer. */
export function ListingGallery({ photos, title, plaque }: { photos: GalleryPhoto[]; title: string; plaque: string }) {
  const [index, setIndex] = useState<number | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (index !== null && !element.open) element.showModal()
    if (index === null && element.open) element.close()
  }, [index])

  useEffect(() => {
    if (index === null) return
    const keys = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') setIndex(value => value === null ? value : (value + 1) % photos.length)
      if (event.key === 'ArrowLeft') setIndex(value => value === null ? value : (value - 1 + photos.length) % photos.length)
    }
    window.addEventListener('keydown', keys)
    return () => window.removeEventListener('keydown', keys)
  }, [index, photos.length])

  if (!photos.length) {
    return (
      <section className="sf-gallery sf-gallery--empty" aria-label="Photos">
        <div className="sf-gallery__lead"><HomePhotoFallback label={plaque || title} /></div>
      </section>
    )
  }

  const side = photos.slice(1, 3)
  const current = index === null ? null : photos[index]
  const step = (delta: number) => setIndex(value => value === null ? 0 : (value + delta + photos.length) % photos.length)

  return (
    <section className="sf-gallery" data-count={Math.min(photos.length, 3)} aria-label="Photos">
      <button type="button" className="sf-gallery__lead" onClick={() => setIndex(0)} aria-label={`Open photo 1 of ${photos.length}`}>
        <img src={photos[0].imagePath} alt={photos[0].altText || title} fetchPriority="high" loading="eager" />
      </button>
      {side.length ? (
        <div className="sf-gallery__side">
          {side.map((photo, offset) => (
            <button key={photo.imagePath} type="button" onClick={() => setIndex(offset + 1)} aria-label={`Open photo ${offset + 2} of ${photos.length}${photo.caption ? `: ${photo.caption}` : ''}`}>
              <img src={photo.imagePath} alt="" loading="eager" decoding="async" />
            </button>
          ))}
        </div>
      ) : null}
      <button type="button" className="sf-gallery__all" onClick={() => setIndex(0)}>
        {photos.length === 1 ? 'View photo' : `View all ${photos.length} photos`}
      </button>

      <dialog ref={dialog} className="sf-viewer" aria-label={`${title} photos`} onClose={() => setIndex(null)} onClick={event => { if (event.target === event.currentTarget) setIndex(null) }}>
        {current ? (
          <div className="sf-viewer__frame">
            <figure>
              <img key={current.imagePath} src={current.imagePath} alt={current.altText || title} />
              <figcaption><span>{current.caption || plaque}</span><span className="sf-num" aria-live="polite">{(index ?? 0) + 1} of {photos.length}</span></figcaption>
            </figure>
            <button type="button" className="sf-viewer__close" onClick={() => setIndex(null)} aria-label="Close photos"><X aria-hidden /></button>
            {photos.length > 1 ? <>
              <button type="button" className="sf-viewer__step sf-viewer__step--prev" onClick={() => step(-1)} aria-label="Previous photo"><ChevronLeft aria-hidden /></button>
              <button type="button" className="sf-viewer__step sf-viewer__step--next" onClick={() => step(1)} aria-label="Next photo"><ChevronRight aria-hidden /></button>
            </> : null}
          </div>
        ) : null}
      </dialog>
    </section>
  )
}
