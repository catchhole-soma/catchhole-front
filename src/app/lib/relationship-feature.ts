// The relationship workspace is public by default.
// Set the build-time flag to exactly 'false' to temporarily hide it.
export const RELATIONSHIP_WORKSPACE_ENABLED = import.meta.env.VITE_RELATIONSHIP_WORKSPACE_ENABLED !== 'false';

export const RELATIONSHIP_QUERY_KEYS = ['relationView', 'relationPage', 'relationshipCandidate', 'relationshipId', 'relationshipFactId',
  'familyFocus', 'familyHistory', 'relationMode', 'relationEpisode', 'relationFocus', 'relationEdge'] as const;
