import { Link } from 'react-router-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import { MessageCircle, MapPin } from 'lucide-react';
import { formatRelativeTime, formatRupees } from '@/lib/format';
import { errorMessage } from '@/services/api';
import { marketplace, qk } from '@/services/marketplace';
import type { Thread } from '@/types/api';
import { ListingImage } from '@/components/listing/ListingImage';
import { Badge } from '@/components/ui/Badge';
import { Button, LinkButton } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { cn } from '@/lib/cn';
import { MePageHeader, RequireLogin } from './RequireLogin';

export default function Enquiries() {
  return (
    <RequireLogin title="Enquiries" reason="Login to see your chats with agencies.">
      <EnquiriesInner />
    </RequireLogin>
  );
}

export function ThreadStatusPill({ status }: { status: Thread['status'] }) {
  if (status === 'listing_removed') return <Badge tone="dust">Listing removed</Badge>;
  if (status === 'agency_closed') return <Badge tone="danger">Agency closed</Badge>;
  return null;
}

function EnquiriesInner() {
  const q = useInfiniteQuery({
    queryKey: qk.threads,
    queryFn: ({ pageParam }) => marketplace.threads(pageParam || undefined),
    initialPageParam: '' as string,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="container-x max-w-3xl py-6 sm:py-10">
      <MePageHeader eyebrow="Your conversations" title="Enquiries" count={q.isSuccess ? items.length : undefined} />
      {q.isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-card" />
          ))}
        </div>
      )}
      {q.isError && <ErrorState body={errorMessage(q.error)} onRetry={() => void q.refetch()} />}
      {q.isSuccess && items.length === 0 && (
        <EmptyState
          icon={<MessageCircle size={26} aria-hidden />}
          title="No enquiries yet"
          body="Open any home and tap Chat with agency, I'm interested, or Book a site visit. Every conversation lands here."
          action={<LinkButton to="/search">Find a home</LinkButton>}
        />
      )}
      <ul className="space-y-3">
        {items.map((t) => {
          const unread = t.unreadBuyer > 0;
          return (
            <li key={t.threadId}>
              <Link
                to={`/me/enquiries/${encodeURIComponent(t.threadId)}`}
                className={cn(
                  'flex gap-3 rounded-card border bg-paper p-3 shadow-card transition-shadow hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marigold',
                  unread ? 'border-marigold/60' : 'border-line',
                )}
              >
                <ListingImage slug={t.agencySlug} propertyId={t.propertyId} imageCount={t.snapshot.imageCount} alt="" className="h-20 w-24 shrink-0 rounded-xl sm:h-24 sm:w-32" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className={cn('truncate text-[15px] leading-snug', unread ? 'font-extrabold' : 'font-bold')}>{t.snapshot.title}</p>
                    <time dateTime={t.lastMessageAt} className="shrink-0 text-[11px] text-dust-dim">
                      {formatRelativeTime(t.lastMessageAt)}
                    </time>
                  </div>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-dust-dim">
                    <MapPin size={11} className="text-marigold" aria-hidden />
                    {[t.snapshot.locality, t.snapshot.city].filter(Boolean).join(', ')} · {formatRupees(t.snapshot.price, t.snapshot.mode)}
                  </p>
                  <p className={cn('mt-1.5 line-clamp-1 text-[13px]', unread ? 'font-bold text-ink' : 'text-ink/70')}>{t.lastPreview || 'Conversation started'}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="truncate text-[11px] font-bold text-dust-dim">{t.snapshot.agencyName}</span>
                    <ThreadStatusPill status={t.status} />
                    {unread && (
                      <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-pill bg-gulal px-1.5 text-[11px] font-extrabold text-paper" aria-label={`${t.unreadBuyer} unread`}>
                        {t.unreadBuyer}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
      {q.hasNextPage && (
        <div className="mt-4 flex justify-center">
          <Button variant="outline" onClick={() => void q.fetchNextPage()} loading={q.isFetchingNextPage}>
            Load older
          </Button>
        </div>
      )}
    </div>
  );
}
