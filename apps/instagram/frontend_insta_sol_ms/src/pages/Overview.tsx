import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AtSign, Eye, MessageSquare, PlayCircle, TrendingUp, UserCheck, Users } from 'lucide-react';
import { getOverview, getTimeseries } from '../api/insta';
import type { OverviewPoint, TimeseriesMetric } from '../api/types';
import { useApi } from '../lib/useApi';
import { cn, formatNumber, formatRelative } from '../lib/format';
import { accountHealth } from '../lib/accountHealth';
import { Badge, ToneDot } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { LoadingBlock } from '../components/Spinner';
import { PageHeader } from '../components/PageHeader';
import { StatCard } from '../components/StatCard';
import { TrendChart, type TrendPoint } from '../components/Sparkline';

type MetricKey = 'enquiries' | TimeseriesMetric;

const METRICS: Array<{ key: MetricKey; label: string; color: string }> = [
  { key: 'enquiries', label: 'Enquiries', color: '#2563EB' },
  { key: 'followers', label: 'Followers', color: '#22C55E' },
  { key: 'reach', label: 'Reach', color: '#EAB308' },
  { key: 'views', label: 'Views', color: '#0EA5E9' },
];

export default function Overview() {
  const overview = useApi((signal) => getOverview(signal), ['overview']);

  const counters = overview.data?.counters ?? {};
  const series = overview.data?.series ?? [];
  const accounts = overview.data?.accounts ?? [];
  const firstLoad = overview.loading && !overview.data;

  return (
    <div>
      <PageHeader
        title="Overview"
        description="What Instagram produced for you in the last 30 days, and whether your accounts are syncing."
        onRefresh={overview.reload}
        refreshing={overview.loading}
      />

      {overview.error ? (
        <ErrorState error={overview.error} onRetry={overview.reload} context="the overview" />
      ) : (
        <>
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              label="Enquiries"
              value={firstLoad ? null : counters.enquiries ?? 0}
              icon={Users}
              hint={counters.hotEnquiries !== undefined ? `${counters.hotEnquiries} very hot` : 'Found in DMs'}
              loading={firstLoad}
            />
            <StatCard
              label="Waiting on us"
              value={firstLoad ? null : counters.unansweredThreads ?? 0}
              icon={MessageSquare}
              hint={`of ${formatNumber(counters.threads ?? 0)} conversations`}
              alert={(counters.unansweredThreads ?? 0) > 0}
              loading={firstLoad}
            />
            <StatCard
              label="Followers"
              value={firstLoad ? null : counters.followers ?? 0}
              icon={TrendingUp}
              hint="Across connected accounts"
              loading={firstLoad}
            />
            <StatCard
              label="Reach"
              value={firstLoad ? null : counters.reach ?? 0}
              icon={Eye}
              hint="Unique accounts, last 30 days"
              loading={firstLoad}
            />
            <StatCard label="Views" value={firstLoad ? null : counters.views ?? 0} icon={PlayCircle} hint="Last 30 days" loading={firstLoad} />
            <StatCard
              label="Accounts engaged"
              value={firstLoad ? null : counters.accountsEngaged ?? 0}
              icon={UserCheck}
              hint={`${formatNumber(counters.totalInteractions ?? 0)} likes, comments, saves and shares`}
              loading={firstLoad}
            />
          </section>

          <section className="mt-5">
            <TrendPanel series={series} loading={firstLoad} />
          </section>

          <section className="mt-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Instagram accounts</h2>
              <Link to="/accounts" className="text-sm font-medium text-brand hover:underline">
                Manage accounts
              </Link>
            </div>

            {firstLoad ? (
              <LoadingBlock label="Checking your accounts…" />
            ) : accounts.length === 0 ? (
              <EmptyState
                title="No Instagram account connected yet"
                description="Connect the agency's Instagram professional account. DMs start arriving here within a few minutes."
                icon={<AtSign className="h-5 w-5" />}
                action={
                  <Link
                    to="/accounts"
                    className="inline-flex min-h-touch items-center rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-light"
                  >
                    Connect Instagram
                  </Link>
                }
              />
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {accounts.map((account) => {
                  const health = accountHealth(account);
                  return (
                    <div
                      key={account.igUserId}
                      className={cn('rounded-xl border bg-white p-4 shadow-sm', health.tone === 'danger' ? 'border-red-200' : 'border-slate-200')}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-ink">@{account.username ?? account.igUserId}</p>
                          <p className="truncate text-xs text-slate-500">{formatNumber(account.followersCount ?? 0)} followers</p>
                        </div>
                        <Badge tone={health.tone}>
                          <ToneDot tone={health.tone} />
                          {health.label}
                        </Badge>
                      </div>
                      <p className="mt-3 text-xs text-slate-500">Last DM sync {formatRelative(account.lastConversationsSyncAt)}</p>
                      {health.detail ? (
                        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{health.detail}</p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Trend panel                                                         */
/* ------------------------------------------------------------------ */

function TrendPanel({ series, loading }: { series: OverviewPoint[]; loading: boolean }) {
  const [metric, setMetric] = useState<MetricKey>('enquiries');
  const active = METRICS.find((m) => m.key === metric) ?? METRICS[0];

  // Prefer the series /overview already returned; only reach for
  // /insights/timeseries when that metric is missing from it.
  const inlinePoints = useMemo<TrendPoint[]>(
    () =>
      series
        .filter((point) => typeof point[metric] === 'number')
        .map((point) => ({ date: point.date, value: point[metric] as number })),
    [series, metric],
  );

  const needsFallback = !loading && inlinePoints.length === 0 && metric !== 'enquiries';

  const fallback = useApi(
    (signal) => (needsFallback ? getTimeseries(metric as TimeseriesMetric, 30, signal) : Promise.resolve(null)),
    ['timeseries', metric, needsFallback],
  );

  const fallbackPoints: TrendPoint[] = (fallback.data?.points ?? []).map((point) => ({ date: point.date, value: point.value }));
  const points = inlinePoints.length > 0 ? inlinePoints : fallbackPoints;
  const busy = loading || (needsFallback && fallback.loading);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-ink">Last 30 days</h2>
          <p className="text-xs text-slate-500">Instagram keeps roughly 90 days of this. We keep it permanently.</p>
        </div>
        <div role="tablist" aria-label="Trend metric" className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
          {METRICS.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={metric === item.key}
              onClick={() => setMetric(item.key)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition',
                metric === item.key ? 'bg-white text-ink shadow-sm' : 'text-slate-500 hover:text-ink',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {busy ? (
        <LoadingBlock label="Loading the trend…" />
      ) : fallback.error ? (
        <ErrorState error={fallback.error} onRetry={fallback.reload} context="the trend chart" />
      ) : points.length === 0 ? (
        <EmptyState
          title={`No ${active.label.toLowerCase()} history yet`}
          description="One snapshot is taken per day per account. The chart fills in as the days accumulate."
        />
      ) : (
        <TrendChart points={points} color={active.color} metricLabel={active.label.toLowerCase()} height={240} />
      )}
    </div>
  );
}
