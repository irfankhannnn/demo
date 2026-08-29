import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Laptop, MessageSquare, TrendingUp, Users } from 'lucide-react';
import { getDevices, getOverview, getTimeseries } from '../api/insta';
import type { OverviewPoint, TimeseriesMetric } from '../api/types';
import { useApi } from '../lib/useApi';
import { cn, formatDateTime, formatRelative } from '../lib/format';
import { deviceHealth } from '../lib/deviceHealth';
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
  const devices = useApi((signal) => getDevices(signal), ['devices']);

  const counters = overview.data?.counters ?? {};
  const series = overview.data?.series ?? [];
  const deviceList = devices.data?.devices ?? overview.data?.devices ?? [];

  return (
    <div>
      <PageHeader
        title="Overview"
        description="What Instagram produced for you, and whether the laptop agent is actually running."
        onRefresh={() => {
          overview.reload();
          devices.reload();
        }}
        refreshing={overview.loading || devices.loading}
      />

      {overview.error ? (
        <ErrorState
          error={overview.error}
          onRetry={overview.reload}
          context="the overview"
        />
      ) : (
        <>
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Enquiries"
              value={overview.loading && !overview.data ? null : counters.enquiries ?? 0}
              icon={Users}
              hint={
                counters.hotEnquiries !== undefined
                  ? `${counters.hotEnquiries} hot`
                  : 'Captured from DMs and comments'
              }
              loading={overview.loading && !overview.data}
            />
            <StatCard
              label="Unanswered DMs"
              value={
                overview.loading && !overview.data ? null : counters.unansweredThreads ?? 0
              }
              icon={MessageSquare}
              hint="Threads waiting on a reply"
              alert={(counters.unansweredThreads ?? 0) > 0}
              loading={overview.loading && !overview.data}
            />
            <StatCard
              label="Followers"
              value={overview.loading && !overview.data ? null : counters.followers ?? 0}
              icon={TrendingUp}
              delta={counters.followersDelta ?? null}
              hint="Across connected accounts"
              loading={overview.loading && !overview.data}
            />
            <StatCard
              label="Reach"
              value={overview.loading && !overview.data ? null : counters.reach ?? 0}
              icon={Eye}
              hint="Last 30 days"
              loading={overview.loading && !overview.data}
            />
          </section>

          <section className="mt-5">
            <TrendPanel series={series} loading={overview.loading && !overview.data} />
          </section>
        </>
      )}

      <section className="mt-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Connection health
          </h2>
          <Link
            to="/devices"
            className="text-sm font-medium text-brand hover:underline"
          >
            Manage laptops
          </Link>
        </div>

        {devices.error ? (
          <ErrorState
            error={devices.error}
            onRetry={devices.reload}
            context="device health"
          />
        ) : devices.loading && !devices.data ? (
          <LoadingBlock label="Checking your laptops…" />
        ) : deviceList.length === 0 ? (
          <EmptyState
            title="No laptop is paired yet"
            description="The agent runs on the agency laptop and does all the Instagram API work. Nothing shows up on this dashboard until one is paired."
            icon={<Laptop className="h-5 w-5" />}
            action={
              <Link
                to="/devices"
                className="inline-flex min-h-touch items-center rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-light"
              >
                Pair a laptop
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {deviceList.map((device) => {
              const health = deviceHealth(device);
              return (
                <div
                  key={device.deviceId}
                  className={cn(
                    'rounded-xl border bg-white p-4 shadow-sm',
                    health.level === 'offline' ? 'border-red-200' : 'border-slate-200',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">
                        {device.deviceName || device.deviceId}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {device.igUsername ? `@${device.igUsername}` : 'No account linked'}
                      </p>
                    </div>
                    <Badge tone={health.tone}>
                      <ToneDot tone={health.tone} />
                      {health.label}
                    </Badge>
                  </div>

                  <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <dt className="text-slate-400">Last check-in</dt>
                      <dd
                        className="text-slate-700"
                        title={formatDateTime(device.lastSeenAt)}
                      >
                        {formatRelative(device.lastSeenAt)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Agent version</dt>
                      <dd className="text-slate-700">{device.agentVersion || '—'}</dd>
                    </div>
                  </dl>

                  {health.tokenWarning ? (
                    <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      {health.tokenWarning}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Trend panel                                                         */
/* ------------------------------------------------------------------ */

function TrendPanel({
  series,
  loading,
}: {
  series: OverviewPoint[];
  loading: boolean;
}) {
  const [metric, setMetric] = useState<MetricKey>('enquiries');
  const active = METRICS.find((m) => m.key === metric) ?? METRICS[0];

  // Prefer the series /overview already returned; only reach for
  // /insights/timeseries when this deployment left that metric out of it.
  const inlinePoints = useMemo<TrendPoint[]>(() => {
    return series
      .filter((point) => typeof point[metric] === 'number')
      .map((point) => ({ date: point.date, value: point[metric] as number }));
  }, [series, metric]);

  const needsFallback = !loading && inlinePoints.length === 0 && metric !== 'enquiries';

  const fallback = useApi(
    (signal) =>
      needsFallback
        ? getTimeseries(metric as TimeseriesMetric, 30, signal)
        : Promise.resolve(null),
    ['timeseries', metric, needsFallback],
  );

  const fallbackPoints: TrendPoint[] = (fallback.data?.points ?? []).map((point) => ({
    date: point.date,
    value: point.value,
  }));

  const points = inlinePoints.length > 0 ? inlinePoints : fallbackPoints;
  const busy = loading || (needsFallback && fallback.loading);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-ink">Last 30 days</h2>
          <p className="text-xs text-slate-500">
            Instagram keeps roughly 90 days of this. We keep it permanently.
          </p>
        </div>
        <div
          role="tablist"
          aria-label="Trend metric"
          className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1"
        >
          {METRICS.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={metric === item.key}
              onClick={() => setMetric(item.key)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition',
                metric === item.key
                  ? 'bg-white text-ink shadow-sm'
                  : 'text-slate-500 hover:text-ink',
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
        <ErrorState
          error={fallback.error}
          onRetry={fallback.reload}
          context="the trend chart"
        />
      ) : points.length === 0 ? (
        <EmptyState
          title={`No ${active.label.toLowerCase()} history yet`}
          description="The laptop agent writes one snapshot a day. The chart fills in as those days accumulate."
        />
      ) : (
        <TrendChart
          points={points}
          color={active.color}
          metricLabel={active.label.toLowerCase()}
          height={240}
        />
      )}
    </div>
  );
}
