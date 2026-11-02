export const MEDIA_UPLOAD_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const MEDIA_UPLOAD_MAX_BYTES = 8 * 1024 * 1024

/** Why an Add media form can't be saved, or null. A photo upload wins over a link. */
export function mediaUploadProblem({ file, url, propertyId }: { file: { size: number; type: string } | null; url: string; propertyId: string }) {
  if (!propertyId) return 'Listing not found.'
  if (file) {
    if (!(MEDIA_UPLOAD_TYPES as readonly string[]).includes(file.type)) return 'Upload a JPEG, PNG or WebP photo.'
    if (file.size > MEDIA_UPLOAD_MAX_BYTES) return 'Photos can be up to 8 MB.'
    return null
  }
  if (!url) return 'Upload a photo or enter a link.'
  if (!/^(https:\/\/|\/images\/)/.test(url)) return 'Use an https:// link.'
  return null
}
