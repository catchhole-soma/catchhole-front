// The relationship workspace is public by default.
// Set the build-time flag to exactly 'false' to temporarily hide it.
export const RELATIONSHIP_WORKSPACE_ENABLED = import.meta.env.VITE_RELATIONSHIP_WORKSPACE_ENABLED !== 'false';

const FAMILY_QUERY_KEYS = ['relationView', 'relationPage', 'relationshipCandidate', 'relationshipId', 'relationshipFactId',
  'familyFocus', 'familyHistory'] as const;
export const RELATIONSHIP_QUERY_KEYS = [...FAMILY_QUERY_KEYS, 'relationMode', 'relationEpisode', 'relationFocus', 'relationEdge'] as const;

export function getRelationshipMode(params: URLSearchParams): 'people' | 'family' {
  const mode = params.get('relationMode');
  if (mode === 'people' || mode === 'family') return mode;
  // Keep existing family detail links meaningful while ordinary graph entry opens people.
  const legacyFamilyTab = (params.get('nav') === null || params.get('nav') === 'settingDB') && params.get('tab') === 'relations';
  return legacyFamilyTab || FAMILY_QUERY_KEYS.some(key => params.has(key)) ? 'family' : 'people';
}
