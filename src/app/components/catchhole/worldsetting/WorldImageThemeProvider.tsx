import type { ReactNode } from 'react';
import { useWorldImageTheme, WorldImageThemeContext } from './useWorldImageTheme';

export function WorldImageThemeProvider({ workId, enabled, children }: {
  workId: string; enabled: boolean; children: ReactNode;
}) {
  const theme = useWorldImageTheme(workId, enabled);
  return <WorldImageThemeContext.Provider value={theme.data?.data}>{children}</WorldImageThemeContext.Provider>;
}
