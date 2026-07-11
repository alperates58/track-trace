import { useState, useEffect, useCallback } from 'react';

interface VirtualizerOptions {
  count: number;
  getScrollElement: () => HTMLElement | null;
  estimateSize: () => number;
  overscan?: number;
}

export function useVirtualizer({ count, getScrollElement, estimateSize, overscan = 5 }: VirtualizerOptions) {
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  useEffect(() => {
    const el = getScrollElement();
    if (!el) return;

    const handleScroll = () => {
      setScrollTop(el.scrollTop);
    };

    const resizeObserver = new ResizeObserver((entries) => {
      if (entries[0]) {
        setViewportHeight(entries[0].contentRect.height);
      }
    });

    el.addEventListener('scroll', handleScroll, { passive: true });
    resizeObserver.observe(el);
    setViewportHeight(el.clientHeight);
    setScrollTop(el.scrollTop);

    return () => {
      el.removeEventListener('scroll', handleScroll);
      resizeObserver.disconnect();
    };
  }, [getScrollElement]);

  const itemSize = estimateSize();
  const totalSize = count * itemSize;

  let startIndex = Math.max(0, Math.floor(scrollTop / itemSize) - overscan);
  let endIndex = Math.min(count - 1, Math.ceil((scrollTop + viewportHeight) / itemSize) + overscan);

  const virtualItems = [];
  for (let i = startIndex; i <= endIndex; i++) {
    virtualItems.push({
      index: i,
      start: i * itemSize,
      size: itemSize,
    });
  }

  const scrollToIndex = useCallback((index: number) => {
    const el = getScrollElement();
    if (!el) return;
    
    const offset = index * itemSize;
    if (offset < el.scrollTop) {
      el.scrollTop = offset;
    } else if (offset + itemSize > el.scrollTop + el.clientHeight) {
      el.scrollTop = offset + itemSize - el.clientHeight;
    }
  }, [getScrollElement, itemSize]);

  return {
    virtualItems,
    totalSize,
    scrollToIndex
  };
}
