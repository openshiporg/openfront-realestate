/** A media item must carry an uploaded image or a link; returns the problem, or null. */
export function mediaSourceProblem({ imageId, url }: { imageId?: string | null; url?: string | null }) {
  if (imageId) return null
  if (url && url.trim()) return null
  return 'Upload a photo or enter a link.'
}

type MediaSource = { image?: { url?: string | null } | null; url?: string | null }

/** Only https addresses from the image storage are shown; anything else is ignored. */
function storedImageUrl(item: MediaSource) {
  const url = item.image?.url?.trim() || ''
  return /^https:\/\//.test(url) ? url : ''
}

/**
 * The public address of a media item: the uploaded S3 image first, then the older `url` when it is
 * one of the storefront's own /images/real-estate/ paths (`legacyPath` decides that).
 */
export function publicMediaImagePath(item: MediaSource, legacyPath: (url?: string | null) => string) {
  return storedImageUrl(item) || legacyPath(item.url)
}

/** The listing's lead photo: an uploaded cover photo first, then the listing's own image path. */
export function publicHeroImagePath(media: ReadonlyArray<MediaSource & { mediaType?: string | null; isHero?: boolean | null }>, primaryImagePath: string) {
  const cover = media.find(item => item.mediaType === 'photo' && item.isHero && storedImageUrl(item))
  return (cover && storedImageUrl(cover)) || primaryImagePath
}
