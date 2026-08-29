import { useMemo, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { getThreads } from '../api/insta';
import { WINDOW_STATES, type Thread, type WindowState } from '../api/types';
import { useApi } from '../lib/useApi';
import { cn, formatDateTime, formatRelative, millisSince } from '../lib/format';
import { Badge, WindowStateBadge } from '../components/Badge';
import { DataTable, type Column } from '../components/DataTable';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { FilterSelect } from '../components/FilterSelect';
import { PageHeader } from '../components/PageHeader';
import { SkeletonRows } from '../components/Spinner';

/**
 * F5 — the missed-DM rescue queue.
 *
 * The countdown matters more than the list: a STANDARD thread stops being
 * answerable 24 hours after the last inbound message, and once it does the only
 * legal way back in is the story-CTA campaign (F25). Anything under four hours
 * left is called out in red.
 */

const WINDOW_HOURS = 24;
const HOUR_MS = 3_600_000;

function hoursLeft(thread: Thread): number | null {
  if (thread.windowState === 'CLOSED') return 0;
  const since = millisSince(thread.lastInboundAt);
  if (since === null) return null;
  const remaining = WINDOW_HOURS * HOUR_MS - since;
  return remaining <= 0 ? 0 : remaining / HOUR_MS;
}

export default function Threads() {
  const [windowState, setWindowState] = useState<WindowState | ''>('');
  const [unansweredOnly, setUnansweredOnly] = useState(false);

  const { data, loading, error, reload } = useApi(
    (signal) => getThreads({ windowState, unanswered: unansweredOnly }, signal),
    ['threads', windowState, unansweredOnly],
  );

  const rows = data?.threads ?? [];

  const unansweredCount = useMemo(
    () => rows.filter((thread) => thread.unanswered).length,
    [rows],
  );

  const columns: Column<Thread>[] = [
    {
      key: 'participant',
      header: 'Person',
      sortable: true,
      value: (row) => row.participantUsername || row.participantId || row.conversationId,
      render: (row) => (
        <div className="flex min-w-0 items-center gap-2">
          {row.unanswered ? (
            <span
              aria-hidden
              className="h-2 w-2 shrink-0 rounded-full bg-danger"
              title="Waiting on a reply"
            />
          ) : (
            <span aria-hidden className="h-2 w-2 shrink-0" />
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">
              {row.participantUsername ? `@${row.participantUsername}` : 'Unknown sender'}
            </p>
            <p className="truncate text-xs text-slate-500">
              {row.messageCount ?? 0} message{row.messageCount === 1 ? '' : 's'}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'windowState',
      header: 'Window',
      sortable: true,
      value: (row) => row.windowState,
      render: (row) => <WindowStateBadge value={row.windowState} />,
    },
    {
      key: 'remaining',
      header: 'Time left',
      align: 'right',
      sortable: true,
      hideBelow: 'sm',
      value: (row) => hoursLeft(row) ?? 999,
      render: (row) => {
        const left = hoursLeft(row);
        if (left === null) return <span className="text-xs text-slate-400">—</span>;
        if (left <= 0) {
          return (
            <Badge tone="danger" title="Nothing can be sent until they message again.">
              window shut
            </Badge>
          );
        }
        return (
          <span
            className={cn(
              'whitespace-nowrap text-xs font-medium tabular-nums',
              left < 4 ? 'text-danger' : left < 10 ? 'text-amber-600' : 'text-slate-500',
            )}
          >
            {left < 1 ? `${Math.round(left * 60)} min` : `${Math.floor(left)} hr`} left
          </span>
        );
      },
    },
    {
      key: 'lastInbound',
      header: 'Last inbound',
      align: 'right',
      sortable: true,
      hideBelow: 'md',
      value: (row) => row.lastInboundAt,
      render: (row) => (
        <span
          className="whitespace-nowrap text-xs text-slate-500"
          title={formatDateTime(row.lastInboundAt)}
        >
          {formatRelative(row.lastInboundAt)}
        </span>
      ),
    },
    {
      key: 'lastOutbound',
      header: 'Last reply',
      align: 'right',
      sortable: true,
      hideBelow: 'lg',
      value: (row) => row.lastOutboundAt,
      render: (row) => (
        <span
          className="whitespace-nowrap text-xs text-slate-500"
          title={formatDateTime(row.lastOutboundAt)}
        >
          {formatRelative(row.lastOutboundAt)}
        </span>
      ),
    },
    {
      key: 'unanswered',
      header: 'State',
      align: 'right',
      sortable: true,
      value: (row) => (row.unanswered ? 1 : 0),
      render: (row) =>
        row.unanswered ? (
          <Badge tone="danger">unanswered</Badge>
        ) : (
          <Badge tone="success">answered</Badge>
        ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="DM threads"
        description="Every conversation the agent has seen, with the Meta messaging window it is currently in."
        onRefresh={reload}
        refreshing={loading}
      />

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-3">
        <FilterSelect
          label="Window state"
          value={windowState}
          onChange={(value) => setWindowState(value as WindowState | '')}
          options={WINDOW_STATES.map((value) => ({
            value,
            label: value.replace('_', ' '),
          }))}
        />
        <label className="flex min-h-touch items-center gap-2 rounded-lg px-1 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={unansweredOnly}
            onChange={(event) => setUnansweredOnly(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
          />
          Unanswered only
        </label>
        {windowState || unansweredOnly ? (
          <button
            type="button"
            onClick={() => {
              setWindowState('');
              setUnansweredOnly(false);
            }}
            className="min-h-touch rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:text-brand"
          >
            Clear filters
          </button>
        ) : null}
        <span className="ml-auto self-center text-xs text-slate-500">
          {rows.length} thread{rows.length === 1 ? '' : 's'}
          {unansweredCount > 0 ? ` · ${unansweredCount} unanswered` : ''}
        </span>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={reload} context="your DM threads" />
      ) : loading && !data ? (
        <SkeletonRows rows={6} />
      ) : rows.length === 0 ? (
        <EmptyState
          title={
            windowState || unansweredOnly
              ? 'No threads match these filters'
              : 'No DM threads have synced yet'
          }
          description={
            windowState || unansweredOnly
              ? 'Clear the filters to see every conversation the agent has seen.'
              : 'Threads appear here once the laptop agent has read your Instagram inbox. Nothing is sent on your behalf without a rule or your approval.'
          }
          icon={<MessageSquare className="h-5 w-5" />}
          action={
            windowState || unansweredOnly ? (
              <button
                type="button"
                onClick={() => {
                  setWindowState('');
                  setUnansweredOnly(false);
                }}
                className="min-h-touch rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-light"
              >
                Clear filters
              </button>
            ) : null
          }
        />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(row) => row.conversationId}
            initialSort={{ key: 'remaining', direction: 'asc' }}
            rowClassName={(row) => (row.unanswered ? 'bg-red-50/50' : undefined)}
            caption="Instagram DM threads"
          />
          <p className="mt-3 text-xs text-slate-500">
            Rows tinted red are waiting on a reply. A CLOSED window cannot be messaged at
            all until that person writes again — a story asking them to reply is the only
            way to reopen it.
          </p>
        </>
      )}
    </div>
  );
}
