'use client'

import { Fragment } from 'react'
import { LocalDateTime } from '../../showings/components/LocalDateTime'

const ISO = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})/g

/** Renders stored text with any ISO timestamps shown as the viewer's local date and time. */
export function LocalizedText({ text }: { text: string }) {
  const parts: Array<string | { iso: string }> = []
  let last = 0
  for (const match of text.matchAll(ISO)) {
    const index = match.index ?? 0
    if (index > last) parts.push(text.slice(last, index))
    parts.push({ iso: match[0] })
    last = index + match[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return <>{parts.map((part, index) => typeof part === 'string' ? <Fragment key={index}>{part}</Fragment> : <LocalDateTime key={index} value={part.iso} />)}</>
}
