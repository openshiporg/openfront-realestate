'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { HomePhotoFallback } from './HomePhotoFallback'

export type GalleryPhoto = { imagePath: string; altText: string; caption: string }

/** The listing's photo set: one large photo, a strip of the rest, and the address plaque under it. */
export function ListingGallery({ photos, title, plaque }: { photos: GalleryPhoto[]; title: string; plaque: string }) {
  const [index, setIndex] = useState(0)
  if (!photos.length) {
    return (
      <section className="sf-gallery sf-gallery--empty" aria-label="Photos">
        <div className="sf-gallery__stage"><HomePhotoFallback label={plaque || title} /></div>
      </section>
    )
  }

  const current = photos[Math.min(index, photos.length - 1)]
  const many = photos.length > 1
  const step = (delta: number) => setIndex(value => (value + delta + photos.length) % photos.length)

  return (
    <section className={many ? 'sf-gallery' : 'sf-gallery sf-gallery--solo'} aria-label="Photos" aria-roledescription={many ? 'carousel' : undefined}>
      <figure className="sf-gallery__stage">
        <img key={current.imagePath} src={current.imagePath} alt={current.altText || title} fetchPriority="high" loading="eager" />
        {many ? (
          <span className="sf-gallery__controls">
            <button type="button" className="sf-icon-btn" onClick={() => step(-1)} aria-label="Previous photo"><ChevronLeft aria-hidden /></button>
            <span className="sf-num" aria-live="polite">{index + 1} of {photos.length}</span>
            <button type="button" className="sf-icon-btn" onClick={() => step(1)} aria-label="Next photo"><ChevronRight aria-hidden /></button>
          </span>
        ) : null}
      </figure>
      <p className="sf-gallery__plaque">
        <span>{current.caption || plaque}</span>
        {!many ? <span className="sf-num">1 photo</span> : null}
      </p>
      {many ? (
        <div className="sf-gallery__strip">
          {photos.map((photo, photoIndex) => (
            <button key={photo.imagePath} type="button" onClick={() => setIndex(photoIndex)} aria-label={`Photo ${photoIndex + 1}${photo.caption ? `: ${photo.caption}` : ''}`} aria-pressed={photoIndex === index}>
              <img src={photo.imagePath} alt="" loading="eager" decoding="async" fetchPriority="low" />
            </button>
          ))}
        </div>
      ) : null}
    </section>
  )
}
