// Keep the unfinished relationship workspace out of the default build.
// Enable explicitly for development and preview verification only.
export const RELATIONSHIP_WORKSPACE_ENABLED = import.meta.env.VITE_RELATIONSHIP_WORKSPACE_ENABLED === 'true';
