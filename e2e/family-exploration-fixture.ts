import type { Route } from '@playwright/test';
import type { FamilyTreeResponse } from '../src/app/api/generated/types.gen';

/** Existing small-family fixtures keep their graph; only the transport envelope changes. */
export function familyExplorationFixture(route: Route, data: unknown): unknown {
  if (!new URL(route.request().url()).pathname.endsWith('/family-tree/explore')
    || !data || typeof data !== 'object' || !('nodes' in data)) return data;
  const graph = data as FamilyTreeResponse;
  return { selectionRequired: false, totalNodeCount: graph.totalNodeCount, totalEdgeCount: graph.totalEdgeCount, graph, people: null };
}
