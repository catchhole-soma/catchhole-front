import { useLayoutEffect, useRef, useState } from 'react';

interface ResponsiveGridPaginationOptions {
  minItemWidth: number;
  itemHeight: number;
  gap: number;
  maxColumns: number;
  maxPageSize: number;
  reservedBottomSpace: number;
  mobilePageSize?: number;
}

interface ResponsiveGridLayout {
  columns: number;
  pageSize: number;
  ready: boolean;
}

function findScrollParent(element: HTMLElement): HTMLElement | null {
  let parent = element.parentElement;
  while (parent) {
    const overflowY = window.getComputedStyle(parent).overflowY;
    if (overflowY === 'auto' || overflowY === 'scroll') return parent;
    parent = parent.parentElement;
  }
  return null;
}

export function useResponsiveGridPagination({
  minItemWidth,
  itemHeight,
  gap,
  maxColumns,
  maxPageSize,
  reservedBottomSpace,
  mobilePageSize,
}: ResponsiveGridPaginationOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentStartRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<ResponsiveGridLayout>({
    columns: 1,
    pageSize: 1,
    ready: false,
  });

  useLayoutEffect(() => {
    const container = containerRef.current;
    const contentStart = contentStartRef.current;
    if (!container || !contentStart) return;

    const scrollParent = findScrollParent(container);
    let resizeTimer: number | undefined;

    const measure = () => {
      const width = container.clientWidth;
      const columns = Math.min(
        maxColumns,
        Math.max(1, Math.floor((width + gap) / (minItemWidth + gap))),
      );

      const contentStartRect = contentStart.getBoundingClientRect();
      const availableHeight = scrollParent
        ? scrollParent.clientHeight
          - (contentStartRect.top - scrollParent.getBoundingClientRect().top + scrollParent.scrollTop)
          - reservedBottomSpace
        : window.innerHeight - contentStartRect.top - reservedBottomSpace;
      const visibleRows = Math.max(
        1,
        Math.floor((Math.max(itemHeight, availableHeight) + gap) / (itemHeight + gap)),
      );
      const maxRows = Math.max(1, Math.floor(maxPageSize / columns));
      const responsivePageSize = columns * Math.min(visibleRows, maxRows);
      const isMobileViewport = window.matchMedia('(max-width: 768px)').matches;
      const pageSize = mobilePageSize != null && isMobileViewport
        ? Math.min(maxPageSize, Math.max(columns, mobilePageSize))
        : responsivePageSize;

      setLayout(current => (
        current.columns === columns && current.pageSize === pageSize && current.ready
          ? current
          : { columns, pageSize, ready: true }
      ));
    };

    const scheduleMeasure = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(measure, 150);
    };
    const observer = new ResizeObserver(scheduleMeasure);
    observer.observe(container);
    if (scrollParent) observer.observe(scrollParent);
    window.addEventListener('resize', scheduleMeasure);

    measure();
    return () => {
      window.clearTimeout(resizeTimer);
      observer.disconnect();
      window.removeEventListener('resize', scheduleMeasure);
    };
  }, [gap, itemHeight, maxColumns, maxPageSize, minItemWidth, mobilePageSize, reservedBottomSpace]);

  return {
    containerRef,
    contentStartRef,
    columnCount: layout.columns,
    pageSize: layout.pageSize,
    ready: layout.ready,
  };
}
