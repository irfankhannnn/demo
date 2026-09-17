import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import { getThreads } from '../api/insta';
import { WINDOW_STATES, type Thread, type WindowState } from '../api/types';
import { useApi } from '../lib/useApi';
import { cn, formatDateTime, formatRelative, truncate } from '../lib/format';
import { Badge, LeadScoreBadge, WindowStateBadge } from '../components/Badge';
import { DataTable, type Column } from '../components/DataTable';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { FilterSelect } from '../components/FilterSelect';
import { PageHeader } from '../components/PageHeader';
import { SkeletonRows } from '../components/Spinner';

/**
 * The DM inbox, worked newest-down. The countdown matters more than the list:
 * a thread stops being answerable 24 hours after the person's last message,
 * so anything under four hours left is called out in red.
 */

const HOUR_MS = 3_600_000;

function hoursLeft(thread: Thread): number | null {
  if (thread.windowState === 'CLOSED') return 0;
  if (!thread.windowExpiresAt) return null;
  const remaining = Date.parse(thread.windowExpiresAt) - Date.now();
  if (Number.isNaN(remaining)) return null;
  return remaining <= 0 ? 0 : remaining / HOUR_MS;
}

const WINDOW_FILTER_LABEL: Record<string, string> = {
  STANDARD: 'Can reply',
  COMMENT_REPLY: 'Comment only',
  CLOSED: 'Window closed',
};

export default function Threads() {
  const navigate = useNavigate();
  const [windowState, setWindowState] = useState<WindowState | ''>('');
  const [unansweredOnly, setUnansweredOnly] = useState(false);

  const { data, loading, error, reload } = useApi(
    (signal) => getThreads({ windowState, unanswered: unansweredOnly }, signal),
    ['threads', windowState, unansweredOnly],
  );

  const rows = data?.threads ?? [];
  const unansweredCount = useMemo(() => rows.filter((thread) => thread.unanswered).length, [rows]);
  const filtered = Boolean(windowState || unansweredOnly);

  const clear = () => {
    setWindowState('');
    setUnansweredOnly(false);
  };

  const columns: Column<Thread>[] = [
    {
      key: 'participant',
      header: 'Conversation',
      sortable: true,
      value: (row) => row.participantUsername || row.participantId,
      render: (row) => (
        <div className="flex min-w-0 items-start gap-2">
          <span aria-hidden className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', row.unanswered ? 'bg-danger' : 'bg-transparent')} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">
              {row.participantUsername ? `@${row.participantUsername}` : `Instagram user ${row.participantId ?? ''}`}
            </p>
            <p className="truncate text-xs text-slate-500">
              {row.lastMessageDirection === 'out' ? 'You: ' : ''}
              {truncate(row.lastMessageText, 70) || `${row.messageCount ?? 0} messages`}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'lead',
      header: 'Lead',
      sortable: true,
      hideBelow: 'sm',
      value: (row) => ({ very_hot: 3, hot: 2, cold: 1 })[row.analysis?.leadScore ?? 'cold'] ?? 0,
      render: (row) =>
        row.analysis ? (
          <LeadScoreBadge value={row.analysis.leadScore} />
        ) : row.needsAnalysis ? (
          <span className="text-xs text-slate-400">analysing…</span>
        ) : (
          <span className="text-xs text-slate-400">—</span>
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
      hideBelow: 'md',
      value: (row) => hoursLeft(row) ?? 999,
      render: (row) => {
        const left = hoursLeft(row);
        if (left === null) return <span className="text-xs text-slate-400">—</span>;
        if (left <= 0) {
          return (
            <Badge tone="danger" title="Nothing can be sent until they message again.">
              shut
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
      key: 'lastMessage',
      header: 'Last message',
      align: 'right',
      sortable: true,
      hideBelow: 'lg',
      value: (row) => row.lastMessageAt,
      render: (row) => (
        <span className="whitespace-nowrap text-xs text-slate-500" title={formatDateTime(row.lastMessageAt)}>
          {formatRelative(row.lastMessageAt)}
        </span>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="DM inbox"
        description="Every Instagram conversation, scored as a lead, with the time left to reply. Open one to read it and send a reply."
        onRefresh={reload}
        refreshing={loading}
      />

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-3">
        <FilterSelect
          label="Window"
          value={windowState}
          onChange={(value) => setWindowState(value as WindowState | '')}
          options={WINDOW_STATES.map((value) => ({ value, label: WINDOW_FILTER_LABEL[value] ?? value }))}
        />
        <label className="flex min-h-touch items-center gap-2 rounded-lg px-1 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={unansweredOnly}
            onChange={(event) => setUnansweredOnly(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
          />
          Waiting on us
        </label>
        {filtered ? (
          <button type="button" onClick={clear} className="min-h-touch rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:text-brand">
            Clear filters
          </button>
        ) : null}
        <span className="ml-auto self-center text-xs text-slate-500">
          {rows.length} conversation{rows.length === 1 ? '' : 's'}
          {unansweredCount > 0 ? ` · ${unansweredCount} waiting on us` : ''}
        </span>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={reload} context="your DM inbox" />
      ) : loading && !data ? (
        <SkeletonRows rows={6} />
      ) : rows.length === 0 ? (
        <EmptyState
          title={filtered ? 'No conversations match these filters' : 'No DMs synced yet'}
          description={
            filtered
              ? 'Clear the filters to see every conversation.'
              : 'Conversations appear here a few minutes after an Instagram account is connected. Nothing is sent on your behalf unless you reply or a keyword rule fires.'
          }
          icon={<MessageSquare className="h-5 w-5" />}
          action={
            filtered ? (
              <button type="button" onClick={clear} className="min-h-touch rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-light">
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
            rowKey={(row) => row.threadId}
            initialSort={{ key: 'lastMessage', direction: 'desc' }}
            onRowClick={(row) => navigate(`/threads/${encodeURIComponent(row.threadId)}`)}
            rowClassName={(row) => (row.unanswered ? 'bg-red-50/50' : undefined)}
            caption="Instagram DM conversations"
          />
          <p className="mt-3 text-xs text-slate-500">
            A red dot means their last message is waiting on us. A closed window cannot be messaged at all until that person writes again.
          </p>
        </>
      )}
    </div>
  );
}
