/**
 * Shown where a photo is missing: a standing-seam panel with the address stamped on it,
 * so the window reads as a deliberate plate rather than an empty frame.
 */
export function HomePhotoFallback({ label, note = 'Photos coming', showLabel = true }: { label: string; note?: string; showLabel?: boolean }) {
  return (
    <span className="sf-photo-fallback" role="img" aria-label={`${label}: ${note.toLowerCase()}`}>
      <svg viewBox="0 0 64 40" aria-hidden className="sf-photo-fallback__roof">
        <path d="M4 22 32 6l28 16M10 19v17h44V19M27 36V26h10v10" fill="none" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      </svg>
      {showLabel ? <span className="sf-photo-fallback__label">{label}</span> : null}
      <span className="sf-photo-fallback__note">{note}</span>
    </span>
  )
}
