import { createContext, useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getWorldImageThemeOptions } from '../../../api/generated/@tanstack/react-query.gen';
import type { WorldImageThemeResponse } from '../../../api/generated/types.gen';
import { shouldRetryQuery } from '../../../lib/query-client';

export const WorldImageThemeContext = createContext<WorldImageThemeResponse | undefined>(undefined);
export const useWorldImageThemeContext = () => useContext(WorldImageThemeContext);

export function useWorldImageTheme(workId: string, enabled = true) {
  return useQuery({
    ...getWorldImageThemeOptions({ path: { workId } }),
    enabled: enabled && Boolean(workId),
    retry: shouldRetryQuery,
  });
}
