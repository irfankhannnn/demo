import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, MessageSquare, Phone, Users } from 'lucide-react';
import { getEnquiries, patchEnquiry } from '../api/insta';
import { ApiError, CRM_URL } from '../api/client';
import {
  ENQUIRY_STATUSES,
  TEMPERATURES,
  type Enquiry,
  type EnquiryListResponse,
  type EnquiryStatus,
  type Temperature,
} from '../api/types';
import { useApi } from '../lib/useApi';
import { cn, formatRelative, humanise, truncate } from '../lib/format';
import { Badge, CrmSyncBadge, LeadScoreBadge, statusTone } from '../components/Badge';
import { DataTable, type Column } from '../components/DataTable';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { FilterSelect } from '../components/FilterSelect';
import { PageHeader } from '../components/PageHeader';
import { SkeletonRows, Spinner } from '../components/Spinner';

const PAGE_SIZE = 50;
const SCORE_ORDER = { very_hot: 3, hot: 2, cold: 1 } as const;
const HEAT_LABEL: Record<Temperature, string> = { hot: 'Very hot', warm: 'Hot', cold: 'Cold' };

function requirement(row: Enquiry): string {
  return [row.propertyType, row.dealType && humanise(row.dealType), row.preferredArea, row.budgetText].filter(Boolean).join(' · ');
}

export default function Enquiries() {
  const [status, setStatus] = useState<EnquiryStatus | ''>('');
  const [temperature, setTemperature] = useState<Temperature | ''>('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  /** enquiryId currently being PATCHed, so its row can show a spinner. */
  const [saving, setSaving] = useState<string | null>(null);

  const { data, loading, error, reload, setData } = useApi<EnquiryListResponse>(
    (signal) => getEnquiries({ status, temperature, limit: PAGE_SIZE }, signal),
    ['enquiries', status, temperature],
  );

  const rows = data?.enquiries ?? [];
  const cursor = data?.cursor ?? null;
  const filtered = Boolean(status || temperature);

  async function changeStatus(enquiry: Enquiry, next: EnquiryStatus) {
    if (next === enquiry.status) return;
    setSaving(enquiry.enquiryId);
    setPageError(null);

    const previous = data;
    // Optimistic: the dropdown must not sit on the old value while the request
    // is in flight, or the owner clicks it a second time.
    setData({ enquiries: rows.map((row) => (row.enquiryId === enquiry.enquiryId ? { ...row, status: next } : row)), cursor });

    try {
      const updated = await patchEnquiry(enquiry.enquiryId, { status: next });
      setData({
        enquiries: rows.map((row) => (row.enquiryId === enquiry.enquiryId ? { ...row, ...updated, status: next } : row)),
        cursor,
      });
    } catch (err) {
      if (previous) setData(previous);
      setPageError(err instanceof ApiError ? `${err.message}${err.details ? ` — ${err.details}` : ''}` : 'Could not update that enquiry.');
    } finally {
      setSaving(null);
    }
  }

  async function loadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    setPageError(null);
    try {
      const next = await getEnquiries({ status, temperature, limit: PAGE_SIZE, cursor });
      setData({ enquiries: [...rows, ...next.enquiries], cursor: next.cursor ?? null });
    } catch (err) {
      setPageError(err instanceof ApiError ? err.message : 'Could not load any more enquiries.');
    } finally {
      setLoadingMore(false);
    }
  }

  const clear = () => {
    setStatus('');
    setTemperature('');
  };

  const columns: Column<Enquiry>[] = [
    {
      key: 'person',
      header: 'Lead',
      sortable: true,
      width: '34%',
      value: (row) => row.name || row.igUsername || row.enquiryId,
      render: (row) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-ink">{row.name || row.igUsername || 'Unnamed'}</p>
            {row.needsReview ? <Badge tone="warning" title="The analysis may be wrong — read the conversation.">check</Badge> : null}
          </div>
          <p className="truncate text-xs text-slate-500">
            {row.igUsername ? `@${row.igUsername}` : 'Instagram DM'}
            {requirement(row) ? ` · ${requirement(row)}` : ''}
          </p>
          {row.summary ? <p className="mt-1 line-clamp-2 text-xs text-slate-500">{truncate(row.summary, 160)}</p> : null}
          {row.threadId ? (
            <Link
              to={`/threads/${encodeURIComponent(row.threadId)}`}
              className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Open conversation
            </Link>
          ) : null}
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'Phone',
      hideBelow: 'md',
      value: (row) => row.phone ?? '',
      render: (row) =>
        row.phone ? (
          <a href={`tel:${row.phone}`} className="inline-flex items-center gap-1 whitespace-nowrap text-sm text-brand hover:underline">
            <Phone className="h-3.5 w-3.5" />
            {row.phone}
          </a>
        ) : (
          <span className="text-xs text-slate-400">not shared</span>
        ),
    },
    {
      key: 'score',
      header: 'Score',
      sortable: true,
      value: (row) => SCORE_ORDER[row.leadScore ?? 'cold'] ?? 0,
      render: (row) => <LeadScoreBadge value={row.leadScore} />,
    },
    {
      key: 'crm',
      header: 'CRM',
      hideBelow: 'lg',
      value: (row) => row.crmSync?.status ?? '',
      render: (row) => <CrmSyncBadge value={row.crmSync} />,
    },
    {
      key: 'created',
      header: 'Age',
      align: 'right',
      hideBelow: 'sm',
      sortable: true,
      value: (row) => row.createdAt,
      render: (row) => <span className="whitespace-nowrap text-xs text-slate-500">{formatRelative(row.createdAt)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      align: 'right',
      sortable: true,
      value: (row) => ENQUIRY_STATUSES.indexOf(row.status ?? 'new'),
      render: (row) => (
        <div className="flex items-center justify-end gap-2">
          {saving === row.enquiryId ? <Spinner className="h-4 w-4" /> : null}
          <select
            value={row.status ?? 'new'}
            disabled={saving === row.enquiryId}
            onChange={(event) => changeStatus(row, event.target.value as EnquiryStatus)}
            onClick={(event) => event.stopPropagation()}
            aria-label={`Status for ${row.name || row.enquiryId}`}
            className={cn(
              'min-h-touch rounded-lg border px-2 py-1.5 text-xs font-medium capitalize transition focus:outline-none focus:ring-2 focus:ring-brand',
              'border-slate-300 bg-white text-slate-700 disabled:opacity-60',
            )}
          >
            {ENQUIRY_STATUSES.map((value) => (
              <option key={value} value={value}>
                {humanise(value)}
              </option>
            ))}
          </select>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Enquiries"
        description="Leads found in Instagram DMs, scored with a summary and next step. Anyone with a name, phone number and a buy, rent or sell requirement is also created as a CRM lead."
        onRefresh={reload}
        refreshing={loading}
        actions={
          CRM_URL ? (
            <a
              href={`${CRM_URL}/crm/leads?source=Instagram`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <ExternalLink className="h-4 w-4" />
              Open in CRM
            </a>
          ) : null
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-3">
        <FilterSelect
          label="Status"
          value={status}
          onChange={(value) => setStatus(value as EnquiryStatus | '')}
          options={ENQUIRY_STATUSES.map((value) => ({ value, label: humanise(value) }))}
        />
        <FilterSelect
          label="Score"
          value={temperature}
          onChange={(value) => setTemperature(value as Temperature | '')}
          options={TEMPERATURES.map((value) => ({ value, label: HEAT_LABEL[value] }))}
        />
        {filtered ? (
          <button type="button" onClick={clear} className="min-h-touch rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:text-brand">
            Clear filters
          </button>
        ) : null}
        <span className="ml-auto self-center text-xs text-slate-500">
          {rows.length} shown
          {cursor ? '+' : ''}
        </span>
      </div>

      {pageError ? (
        <p role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {pageError}
        </p>
      ) : null}

      {error ? (
        <ErrorState error={error} onRetry={reload} context="your enquiries" />
      ) : loading && !data ? (
        <SkeletonRows rows={6} />
      ) : rows.length === 0 ? (
        <EmptyState
          title={filtered ? 'No enquiries match these filters' : 'No enquiries yet'}
          description={
            filtered
              ? 'Clear the filters to see everything captured.'
              : 'An enquiry appears when a DM reads as a property requirement. Connect an Instagram account, and add keyword rules so commenters get a DM.'
          }
          icon={<Users className="h-5 w-5" />}
          action={
            filtered ? (
              <button type="button" onClick={clear} className="min-h-touch rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-light">
                Clear filters
              </button>
            ) : (
              <Link to="/accounts" className="inline-flex min-h-touch items-center rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-light">
                Instagram accounts
              </Link>
            )
          }
        />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(row) => row.enquiryId}
            initialSort={{ key: 'created', direction: 'desc' }}
            rowClassName={(row) => (row.leadScore === 'very_hot' ? 'bg-red-50/40' : undefined)}
            caption="Instagram enquiries"
          />

          <div className="mt-4 flex items-center justify-center gap-3">
            {cursor ? (
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="inline-flex min-h-touch items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-brand hover:text-brand disabled:opacity-60"
              >
                {loadingMore ? <Spinner className="h-4 w-4" /> : null}
                Load more
              </button>
            ) : (
              <p className="text-xs text-slate-400">That is every enquiry for this filter.</p>
            )}
          </div>
        </>
      )}

      <p className="mt-4 text-xs text-slate-500">
        Statuses follow the same vocabulary as the CRM:{' '}
        {ENQUIRY_STATUSES.map((value) => (
          <Badge key={value} tone={statusTone(value)} className="mr-1">
            {humanise(value)}
          </Badge>
        ))}
      </p>
    </div>
  );
}
