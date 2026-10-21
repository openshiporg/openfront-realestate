export const PROPERTY_IMAGE_PATHS: Record<string, string> = {
  'riverfront-loft-austin': '/images/real-estate/properties/riverfront-loft-austin.svg',
  'hill-country-estate': '/images/real-estate/properties/hill-country-estate.svg',
  'eastside-townhome-rental': '/images/real-estate/properties/eastside-townhome-rental.svg',
  'mueller-bungalow': '/images/real-estate/properties/mueller-bungalow.svg',
}

export const AGENT_IMAGE_PATHS: Record<string, string> = {
  'maya.chen@example.realestate.local': '/images/real-estate/agents/maya-chen.svg',
  'omar.patel@example.realestate.local': '/images/real-estate/agents/omar-patel.svg',
  'evelyn.brooks@example.realestate.local': '/images/real-estate/agents/evelyn-brooks.svg',
}

export const NEIGHBORHOOD_IMAGE_PATHS: Record<string, string> = {
  'rainey street historic district': '/images/real-estate/neighborhoods/rainey-street.svg',
  'westlake hills': '/images/real-estate/neighborhoods/westlake-hills.svg',
  'east cesar chavez': '/images/real-estate/neighborhoods/east-cesar-chavez.svg',
  mueller: '/images/real-estate/neighborhoods/mueller.svg',
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
