import coreSeed from '../../platform/onboarding/lib/seed.json'
import expansionSeed from '../../platform/onboarding/lib/expansion-seed.json'
import authoritySeed from '../../platform/onboarding/lib/authority-seed.json'
import { applyAuthoritySeed } from './authority-runtime'
import { applyCoreSeed, applyExpansionSeed, type SeedContext, type SeedTarget } from './seed-runtime'

export async function runRealEstateOnboarding(context: SeedContext, target: SeedTarget, template: 'full' | 'minimal' = 'full') {
  const core = await applyCoreSeed(context, coreSeed, target, template)
  const selectedAgents = new Set(coreSeed.sections.agents.items.filter(item => item.templates.includes(template)).map(item => item.data.email))
  const selectedProperties = new Set(coreSeed.sections.properties.items.filter(item => item.templates.includes(template)).map(item => item.data.slug))
  await applyAuthoritySeed(context, {
    ...authoritySeed,
    practitioners: authoritySeed.practitioners.filter(item => selectedAgents.has(item.email)),
    listings: authoritySeed.listings.filter(item => selectedProperties.has(item.propertySlug)),
  }, target)
  const expansion = template === 'full' ? await applyExpansionSeed(context, expansionSeed, target) : { created: 0, skipped: 0, total: 0 }
  return { core, expansion }
}
