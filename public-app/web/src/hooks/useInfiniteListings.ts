/**
 * Cursor-paginated GET /listings with an IntersectionObserver sentinel.
 */
import { useEffect, useRef } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { marketplace, qk } from '@/services/marketplace';
import type { ListingsQuery } from '@/types/api';

export function useInfiniteListings(query: ListingsQuery, enabled = true) {
  const q = useInfiniteQuery({
    queryKey: qk.listings(query),
    queryFn: ({ pageParam, signal }) => marketplace.listings({ ...query, cursor: pageParam || undefined }, signal),
    initialPageParam: '' as string,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: enabled && !!query.city,
    staleTime: 60_000,
  });

  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  return { ...q, items };
}

/** Attach to a sentinel div; calls onVisible when it scrolls into view. */
export function useIntersection(onVisible: () => void, enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const cb = useRef(onVisible);
  cb.current = onVisible;
  useEffect(() => {
    if (!enabled || !ref.current || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) cb.current();
      },
      { rootMargin: '600px 0px' },
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, [enabled]);
  return ref;
}
