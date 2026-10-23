export const PROPERTY_IMAGE_PATHS: Record<string, string> = {
  'riverfront-loft-austin': '/images/real-estate/photos/riverfront-loft-austin.jpg',
  'hill-country-estate': '/images/real-estate/photos/hill-country-estate.jpg',
  'eastside-townhome-rental': '/images/real-estate/photos/eastside-townhome-rental.jpg',
  'mueller-bungalow': '/images/real-estate/photos/mueller-bungalow.jpg',
}

export const AGENT_IMAGE_PATHS: Record<string, string> = {
  'maya.chen@example.realestate.local': '/images/real-estate/photos/agents/maya-chen.jpg',
  'omar.patel@example.realestate.local': '/images/real-estate/photos/agents/omar-patel.jpg',
  'evelyn.brooks@example.realestate.local': '/images/real-estate/photos/agents/evelyn-brooks.jpg',
}

export const NEIGHBORHOOD_IMAGE_PATHS: Record<string, string> = {
  'rainey street historic district': '/images/real-estate/photos/neighborhoods/rainey-street.jpg',
  'westlake hills': '/images/real-estate/photos/mueller-bungalow.jpg',
  'east cesar chavez': '/images/real-estate/photos/neighborhood-homes.jpg',
  mueller: '/images/real-estate/photos/neighborhood-homes.jpg',
}

type PublicImagePack = {
  propertyImagePath?: string | null
  agentImagePath?: string | null
  neighborhoodImagePath?: string | null
}

type ListingImageInput = {
  slug?: string | null
  primaryImageUrl?: string | null
  publicImagePack?: PublicImagePack | null
}

type AgentImageInput = {
  email?: string | null
  avatarUrl?: string | null
}

export function getPropertyImagePath(listing: ListingImageInput) {
  if (listing.publicImagePack?.propertyImagePath) return listing.publicImagePack.propertyImagePath
  if (listing.primaryImageUrl) return listing.primaryImageUrl
  return listing.slug ? PROPERTY_IMAGE_PATHS[listing.slug] : undefined
}

export function getAgentImagePath(agent?: AgentImageInput | null, publicImagePack?: PublicImagePack | null) {
  if (publicImagePack?.agentImagePath) return publicImagePack.agentImagePath
  if (!agent) return undefined
  if (agent.avatarUrl) return agent.avatarUrl
  return agent.email ? AGENT_IMAGE_PATHS[agent.email.toLowerCase()] : undefined
}

export function getNeighborhoodImagePath(neighborhood?: string | null, publicImagePack?: PublicImagePack | null) {
  if (publicImagePack?.neighborhoodImagePath) return publicImagePack.neighborhoodImagePath
  if (!neighborhood) return undefined
  return NEIGHBORHOOD_IMAGE_PATHS[neighborhood.trim().toLowerCase()]
}

const LEGACY_NEIGHBORHOOD_PHOTOS: Record<string, string> = {
  'rainey-street': 'neighborhoods/rainey-street',
  'westlake-hills': 'mueller-bungalow',
  'east-cesar-chavez': 'neighborhood-homes',
  mueller: 'neighborhood-homes',
}

/** Starter data saved before the photo pack pointed at labelled SVG art; serve the matching photo instead. */
export function upgradeLegacyImagePath(path: string) {
  const match = /^\/images\/real-estate\/(properties|agents|neighborhoods)\/([a-z0-9-]+)\.svg$/.exec(path)
  if (!match) return path
  const [, kind, name] = match
  if (kind === 'properties') return `/images/real-estate/photos/${name}.jpg`
  if (kind === 'agents') return `/images/real-estate/photos/agents/${name}.jpg`
  return LEGACY_NEIGHBORHOOD_PHOTOS[name] ? `/images/real-estate/photos/${LEGACY_NEIGHBORHOOD_PHOTOS[name]}.jpg` : path
}
