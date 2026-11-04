'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { HomePhotoFallback } from './HomePhotoFallback'

export type GalleryPhoto = { imagePath: string; altText: string; caption: string }

/** Which slide of a scroll-snapped strip is showing. */
function slideAt(strip: HTMLElement | null) {
  if (!strip || !strip.clientWidth) return 0
  return Math.round(strip.scrollLeft / strip.clientWidth)
}

/**
 * The listing's photos. From 40rem: one large photo with two beside it. On a phone: a strip you swipe
 * through with a count. Either opens a full-screen viewer that also swipes, steps with the arrows
 * and keys, and closes with Escape or the close button.
 */
export function ListingGallery({ photos, title, plaque }: { photos: GalleryPhoto[]; title: string; plaque: string }) {
  const [index, setIndex] = useState<number | null>(null)
  const [showing, setShowing] = useState(0)
  const dialog = useRef<HTMLDialogElement>(null)
  const strip = useRef<HTMLDivElement>(null)
  const viewer = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (index !== null && !element.open) element.showModal()
    if (index === null && element.open) element.close()
  }, [index])

  // The viewer opens on the chosen photo, and stepping slides to the next one.
  useEffect(() => {
    const list = viewer.current
    if (index === null || !list) return
    const opening = !list.dataset.shown
    list.dataset.shown = '1'
    if (slideAt(list) === index) return
    list.scrollTo({ left: index * list.clientWidth, behavior: opening ? 'auto' : 'smooth' })
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
  const close = () => {
    if (viewer.current) delete viewer.current.dataset.shown
    setIndex(null)
  }

  return (
    <section className="sf-gallery" data-count={Math.min(photos.length, 3)} aria-label="Photos">
      <div ref={strip} className="sf-gallery__strip" onScroll={() => setShowing(slideAt(strip.current))}>
        {photos.map((photo, offset) => (
          <button key={photo.imagePath + offset} type="button" className="sf-gallery__lead" data-rest={offset > 0 || undefined} onClick={() => setIndex(offset)} aria-label={`Open photo ${offset + 1} of ${photos.length}${photo.caption ? `: ${photo.caption}` : ''}`}>
            <img src={photo.imagePath} alt={offset === 0 ? photo.altText || title : ''} fetchPriority={offset === 0 ? 'high' : 'low'} loading={offset === 0 ? 'eager' : 'lazy'} decoding="async" />
          </button>
        ))}
      </div>
      {photos.length > 1 ? <span className="sf-gallery__count sf-num" aria-hidden>{showing + 1} / {photos.length}</span> : null}
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

      <dialog ref={dialog} className="sf-viewer" aria-label={`${title} photos`} onClose={close} onClick={event => { if (event.target === event.currentTarget) close() }}>
        <div className="sf-viewer__frame">
          <div ref={viewer} className="sf-viewer__strip" onScroll={() => {
            const at = slideAt(viewer.current)
            if (index !== null && at !== index && viewer.current?.dataset.shown) setIndex(at)
          }}>
            {index !== null ? photos.map((photo, offset) => (
              <figure key={photo.imagePath + offset} className="sf-viewer__slide">
                <img src={photo.imagePath} alt={photo.altText || title} loading={Math.abs(offset - index) <= 1 ? 'eager' : 'lazy'} decoding="async" />
              </figure>
            )) : null}
          </div>
          {current ? (
            <p className="sf-viewer__caption"><span>{current.caption || plaque}</span><span className="sf-num" aria-live="polite">{(index ?? 0) + 1} of {photos.length}</span></p>
          ) : null}
          <button type="button" className="sf-viewer__close" onClick={close} aria-label="Close photos"><X aria-hidden /></button>
          {photos.length > 1 ? <>
            <button type="button" className="sf-viewer__step sf-viewer__step--prev" onClick={() => step(-1)} aria-label="Previous photo"><ChevronLeft aria-hidden /></button>
            <button type="button" className="sf-viewer__step sf-viewer__step--next" onClick={() => step(1)} aria-label="Next photo"><ChevronRight aria-hidden /></button>
          </> : null}
        </div>
      </dialog>
    </section>
  )
}
