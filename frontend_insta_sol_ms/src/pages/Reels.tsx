import { useMemo, useState } from 'react';
import { ExternalLink, Film, Flame, AlertTriangle } from 'lucide-react';
import { getMedia } from '../api/insta';
import type { Media, MediaSort } from '../api/types';
import { useApi } from '../lib/useApi';
import { cn, formatCompact, formatDate, formatNumber, truncate } from '../lib/format';
import { Badge } from '../components/Badge';
import { DataTable, type Column, type SortDirection } from '../components/DataTable';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { PageHeader } from '../components/PageHeader';
import { SkeletonRows } from '../components/Spinner';

/**
 * F29 — the reel leaderboard, ranked by enquiries rather than views.
 *
 * The whole argument of this screen is that a 2,04,000-view reel with one
 * enquiry is a worse reel than a 12,000-view one with twenty. Sorting by
 * enquiries is only half of that; the other half is the efficiency column,
 * which shows enquiries per 1,000 views as a bar so a fat views number sitting
 * next to a stub of a bar is impossible to misread.
 */

const LIMIT = 50;

interface Scored {
  media: Media;
  views: number;
  reach: number;
  likes: number;
  comments: number;
  saved: number;
  shares: number;
  dms: number;
  enquiries: number;
  hot: number;
  /** Enquiries per 1,000 views — the number this screen exists to show. */
  perThousand: number;
  vanity: boolean;
  earner: boolean;
}

function score(items: Media[]): Scored[] {
  const rows = items.map((media) => {
    const views = media.metrics?.views ?? 0;
    const enquiries = media.enquiryCount ?? 0;
    return {
      media,
      views,
      reach: media.metrics?.reach ?? 0,
      likes: media.metrics?.likes ?? 0,
      comments: media.commentCount ?? media.metrics?.comments ?? 0,
      saved: media.metrics?.saved ?? 0,
      shares: media.metrics?.shares ?? 0,
      dms: media.dmCount ?? 0,
      enquiries,
      hot: media.hotCount ?? 0,
      perThousand: views > 0 ? (enquiries / views) * 1000 : 0,
      vanity: false,
      earner: false,
    };
  });

  if (rows.length === 0) return rows;

  const bestPerThousand = Math.max(...rows.map((row) => row.perThousand));
  const sortedViews = [...rows].map((row) => row.views).sort((a, b) => a - b);
  const medianViews = sortedViews[Math.floor(sortedViews.length / 2)] ?? 0;

  for (const row of rows) {
    if (bestPerThousand <= 0) continue;
    // Reach that people saw but nobody acted on: above-median views, bottom
    // quarter of conversion. That is the reel to stop making.
    row.vanity =
      row.views >= medianViews &&
      row.views > 0 &&
      row.perThousand < bestPerThousand * 0.25;
    row.earner = row.enquiries > 0 && row.perThousand >= bestPerThousand * 0.7;
  }

  return rows;
}

export default function Reels() {
  const [sort, setSort] = useState<{ key: string; direction: SortDirection }>({
    key: 'enquiries',
    direction: 'desc',
  });

  // The contract only sorts server-side by `enquiries` or `views`; that choice
  // decides which top-N comes back, and the table re-orders within it.
  const apiSort: MediaSort = sort.key === 'views' ? 'views' : 'enquiries';

  const { data, loading, error, reload } = useApi(
    (signal) => getMedia({ sort: apiSort, limit: LIMIT }, signal),
    ['media', apiSort],
  );

  const rows = useMemo(() => score(data?.media ?? []), [data]);

  const sorted = useMemo(() => {
    const pick = (row: Scored): number | string => {
      switch (sort.key) {
        case 'views':
          return row.views;
        case 'reach':
          return row.reach;
        case 'likes':
          return row.likes;
        case 'comments':
          return row.comments;
        case 'saved':
          return row.saved;
        case 'shares':
          return row.shares;
        case 'dms':
          return row.dms;
        case 'hot':
          return row.hot;
        case 'efficiency':
          return row.perThousand;
        case 'published':
          return row.media.publishedAt ?? '';
        case 'enquiries':
        default:
          return row.enquiries;
      }
    };
    const factor = sort.direction === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const left = pick(a);
      const right = pick(b);
      if (typeof left === 'number' && typeof right === 'number') {
        return factor * (left - right);
      }
      return factor * String(left).localeCompare(String(right));
    });
  }, [rows, sort]);

  const bestPerThousand = Math.max(1e-9, ...rows.map((row) => row.perThousand));

  /** The single loudest example of views without enquiries, for the callout. */
  const worstOffender = useMemo(() => {
    const candidates = rows.filter((row) => row.vanity && row.views > 0);
    if (candidates.length === 0) return null;
    return candidates.reduce((worst, row) => (row.views > worst.views ? row : worst));
  }, [rows]);

  const columns: Column<Scored>[] = [
    {
      key: 'reel',
      header: 'Reel',
      width: '34%',
      render: (row) => <ReelCell row={row} />,
    },
    {
      key: 'views',
      header: 'Views',
      align: 'right',
      sortable: true,
      hideBelow: 'sm',
      render: (row) => (
        <span
          className={cn('tabular-nums', row.vanity ? 'text-slate-400' : 'text-slate-700')}
          title={formatNumber(row.views)}
        >
          {formatCompact(row.views)}
        </span>
      ),
    },
    {
      key: 'reach',
      header: 'Reach',
      align: 'right',
      sortable: true,
      hideBelow: 'lg',
      render: (row) => (
        <span className="tabular-nums" title={formatNumber(row.reach)}>
          {formatCompact(row.reach)}
        </span>
      ),
    },
    {
      key: 'likes',
      header: 'Likes',
      align: 'right',
      sortable: true,
      hideBelow: 'md',
      render: (row) => <span className="tabular-nums">{formatNumber(row.likes)}</span>,
    },
    {
      key: 'comments',
      header: 'Comments',
      align: 'right',
      sortable: true,
      hideBelow: 'lg',
      render: (row) => <span className="tabular-nums">{formatNumber(row.comments)}</span>,
    },
    {
      key: 'saved',
      header: 'Saves',
      align: 'right',
      sortable: true,
      hideBelow: 'lg',
      render: (row) => <span className="tabular-nums">{formatNumber(row.saved)}</span>,
    },
    {
      key: 'shares',
      header: 'Shares',
      align: 'right',
      sortable: true,
      hideBelow: 'lg',
      render: (row) => <span className="tabular-nums">{formatNumber(row.shares)}</span>,
    },
    {
      key: 'dms',
      header: 'DMs',
      align: 'right',
      sortable: true,
      hideBelow: 'md',
      render: (row) => <span className="tabular-nums">{formatNumber(row.dms)}</span>,
    },
    {
      key: 'enquiries',
      header: 'Enquiries',
      align: 'right',
      sortable: true,
      headerClassName: 'text-brand',
      render: (row) => (
        <span
          className={cn(
            'tabular-nums text-base font-semibold',
            row.enquiries > 0 ? 'text-ink' : 'text-slate-300',
          )}
        >
          {formatNumber(row.enquiries)}
        </span>
      ),
    },
    {
      key: 'hot',
      header: 'Hot',
      align: 'right',
      sortable: true,
      hideBelow: 'sm',
      render: (row) =>
        row.hot > 0 ? (
          <span className="inline-flex items-center gap-1 tabular-nums font-medium text-danger">
            <Flame className="h-3.5 w-3.5" />
            {row.hot}
          </span>
        ) : (
          <span className="text-slate-300">0</span>
        ),
    },
    {
      key: 'efficiency',
      header: 'Enquiries / 1k views',
      align: 'left',
      sortable: true,
      hideBelow: 'md',
      width: '18%',
      render: (row) => (
        <EfficiencyBar value={row.perThousand} max={bestPerThousand} row={row} />
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Reel leaderboard"
        description="Ranked by enquiries, not views. The reel you are proudest of is often the one to stop making."
        onRefresh={reload}
        refreshing={loading}
      />

      {error ? (
        <ErrorState error={error} onRetry={reload} context="the reel leaderboard" />
      ) : loading && !data ? (
        <SkeletonRows rows={6} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No reels have synced yet"
          description="Posts and their insights sync hourly once an Instagram account is connected. Each reel shows the DMs and enquiries it produced."
          icon={<Film className="h-5 w-5" />}
        />
      ) : (
        <>
          {worstOffender ? (
            <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <p className="text-sm text-amber-900">
                <span className="font-semibold">Vanity reach.</span>{' '}
                <span className="font-medium">
                  {truncate(worstOffender.media.caption, 48) || 'One of your reels'}
                </span>{' '}
                pulled {formatNumber(worstOffender.views)} views and produced{' '}
                {formatNumber(worstOffender.enquiries)}{' '}
                {worstOffender.enquiries === 1 ? 'enquiry' : 'enquiries'}. Views are not
                the product.
              </p>
            </div>
          ) : null}

          <DataTable
            columns={columns}
            rows={sorted}
            rowKey={(row) => row.media.mediaId}
            initialSort={sort}
            onSortChange={(key, direction) => setSort({ key, direction })}
            rowClassName={(row) =>
              row.vanity ? 'bg-amber-50/40' : row.earner ? 'bg-green-50/40' : undefined
            }
            caption="Reels ranked by the enquiries they produced"
          />

          <p className="mt-3 text-xs text-slate-500">
            Rows tinted amber earned far fewer enquiries per view than your best reel;
            green rows are your earners. Showing the top {Math.min(LIMIT, rows.length)} by{' '}
            {apiSort}.
          </p>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ReelCell({ row }: { row: Scored }) {
  const { media } = row;
  return (
    <div className="flex items-start gap-3">
      <Thumbnail url={media.thumbnailUrl} />
      <div className="min-w-0">
        <p className="line-clamp-2 text-sm font-medium text-ink">
          {truncate(media.caption, 90) || 'Untitled post'}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
          <span>{formatDate(media.publishedAt)}</span>
          {media.mediaProductType ? (
            <Badge tone="neutral">{media.mediaProductType.toLowerCase()}</Badge>
          ) : null}
          {row.vanity ? <Badge tone="warning">vanity</Badge> : null}
          {row.earner ? <Badge tone="success">earner</Badge> : null}
          {media.permalink ? (
            <a
              href={media.permalink}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.stopPropagation()}
              className="inline-flex items-center gap-1 text-brand hover:underline"
            >
              Open <ExternalLink className="h-3 w-3" />
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Thumbnail({ url }: { url?: string }) {
  const [broken, setBroken] = useState(false);

  if (!url || broken) {
    return (
      <div className="flex h-14 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
        <Film className="h-4 w-4" />
      </div>
    );
  }

  return (
    <img
      src={url}
      alt=""
      loading="lazy"
      onError={() => setBroken(true)}
      className="h-14 w-11 shrink-0 rounded-lg border border-slate-200 object-cover"
    />
  );
}

function EfficiencyBar({
  value,
  max,
  row,
}: {
  value: number;
  max: number;
  row: Scored;
}) {
  const ratio = Math.max(0, Math.min(1, value / max));
  const width = value > 0 ? Math.max(ratio * 100, 3) : 0;

  return (
    <div className="min-w-[7rem]">
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            row.vanity ? 'bg-danger' : row.earner ? 'bg-accent' : 'bg-brand-lighter',
          )}
          style={{ width: `${width}%` }}
        />
      </div>
      <p className="mt-1 text-xs tabular-nums text-slate-500">
        {value > 0 ? value.toFixed(2) : '0'} per 1k
      </p>
    </div>
  );
}
