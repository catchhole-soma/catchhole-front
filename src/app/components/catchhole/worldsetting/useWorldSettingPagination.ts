import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router';
import { useResponsiveGridPagination } from '../../../hooks/useResponsiveGridPagination';

const PAGE_SIZES = [12, 18, 24] as const;

function savedPageSize(value: string | null): number | null {
  const size = Number(value);
  return PAGE_SIZES.some(option => option === size) ? size : null;
}

export function useWorldSettingPagination(active: boolean) {
  const [searchParams, setSearchParams] = useSearchParams();
  const savedSize = savedPageSize(searchParams.get('worldSize'));
  const layout = useResponsiveGridPagination({
    minItemWidth: 280,
    itemHeight: 104,
    gap: 12,
    maxColumns: 3,
    maxPageSize: 24,
    reservedBottomSpace: 64,
    mobilePageSize: 12,
    allowedPageSizes: PAGE_SIZES,
    enabled: active,
  });
  const previousLayout = useRef<string | null>(null);

  useEffect(() => {
    if (!active) {
      previousLayout.current = null;
      return;
    }
    if (!layout.ready) return;
    const layoutKey = `${layout.columnCount}:${layout.pageSize}`;
    const resized = previousLayout.current !== null && previousLayout.current !== layoutKey;
    previousLayout.current = layoutKey;
    // Reload and history restore the saved page boundaries. Only an actual
    // capacity change moves the current first item into a differently sized page.
    if (!resized && savedSize !== null) return;
    setSearchParams(previous => {
      const next = new URLSearchParams(previous);
      const oldSize = savedPageSize(previous.get('worldSize')) ?? layout.pageSize;
      const rawPage = Number(previous.get('page'));
      const oldPage = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
      next.set('worldSize', String(layout.pageSize));
      next.set('page', String(Math.floor(((oldPage - 1) * oldSize) / layout.pageSize) + 1));
      return next;
    }, { replace: true });
  }, [active, layout.columnCount, layout.pageSize, layout.ready, savedSize, setSearchParams]);

  return { ...layout, pageSize: savedSize ?? layout.pageSize, ready: savedSize !== null || layout.ready };
}
