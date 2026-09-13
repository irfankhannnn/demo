import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Film, Phone, Users } from 'lucide-react';
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
import { Badge, TemperatureBadge, statusTone } from '../components/Badge';
import { DataTable, type Column } from '../components/DataTable';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { FilterSelect } from '../components/FilterSelect';
import { PageHeader } from '../components/PageHeader';
import { SkeletonRows, Spinner } from '../components/Spinner';

const PAGE_SIZE = 50;

export default function Enquiries() {
  const [status, setStatus] = useState<EnquiryStatus | ''>('');
  const [temperature, setTemperature] = useState<Temperature | ''>('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  /** enquiryId currently being PATCHed, so its row can show a spinner. */
  const [saving, setSaving] = useState<string | null>(null);

  const { data, loading, error, reload, setData } = useApi<EnquiryListResponse>(
    (signal) =>
      getEnquiries({ status, temperature, limit: PAGE_SIZE }, signal),
    ['enquiries', status, temperature],
  );

  const rows = data?.enquiries ?? [];
  const cursor = data?.cursor ?? null;

  async function changeStatus(enquiry: Enquiry, next: EnquiryStatus) {
    if (next === enquiry.status) return;
    setSaving(enquiry.enquiryId);
    setPageError(null);

    const previous = data;
    // Optimistic: the dropdown must not sit on the old value while the
    // request is in flight, or the owner clicks it a second time.
    setData({
      enquiries: rows.map((row) =>
        row.enquiryId === enquiry.enquiryId ? { ...row, status: next } : row,
      ),
      cursor,
    });

    try {
      const updated = await patchEnquiry(enquiry.enquiryId, { status: next });
      setData({
        enquiries: rows.map((row) =>
          row.enquiryId === enquiry.enquiryId ? { ...row, ...updated, status: next } : row,
        ),
        cursor,
      });
    } catch (err) {
      if (previous) setData(previous);
      setPageError(
        err instanceof ApiError
          ? `${err.message}${err.details ? ` — ${err.details}` : ''}`
          : 'Could not update that enquiry.',
      );
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
      setData({
        enquiries: [...rows, ...next.enquiries],
        cursor: next.cursor ?? null,
      });
    } catch (err) {
      setPageError(
        err instanceof ApiError ? err.message : 'Could not load any more enquiries.',
      );
    } finally {
      setLoadingMore(false);
    }
  }

  const columns: Column<Enquiry>[] = [
    {
      key: 'person',
      header: 'Person',
      sortable: true,
      value: (row) => row.name || row.igUsername || row.enquiryId,
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">
            {row.name || row.igUsername || 'Unnamed'}
          </p>
          <p className="truncate text-xs text-slate-500">
            {row.igUsername ? `@${row.igUsername}` : 'Instagram DM'}
          </p>
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'Phone',
      hideBelow: 'md',
      value: (row) => row.phone,
      render: (row) =>
        row.phone ? (
          <a
            href={`tel:${row.phone}`}
            className="inline-flex items-center gap-1 text-sm text-brand hover:underline"
          >
            <Phone className="h-3.5 w-3.5" />
            {row.phone}
          </a>
        ) : (
          <span className="text-xs text-slate-400">not captured</span>
        ),
    },
    {
      key: 'intent',
      header: 'Intent',
      hideBelow: 'lg',
      sortable: true,
      value: (row) => row.intent,
      render: (row) =>
        row.intent ? <Badge tone="neutral">{humanise(row.intent)}</Badge> : <span className="text-slate-400">—</span>,
    },
    {
      key: 'budget',
      header: 'Budget / area',
      hideBelow: 'lg',
      value: (row) => row.budgetBracket,
      render: (row) => (
        <div className="text-xs text-slate-600">
          <p>{row.budgetBracket || '—'}</p>
          <p className="text-slate-400">{row.preferredArea || 'area unknown'}</p>
        </div>
      ),
    },
    {
      key: 'temperature',
      header: 'Temp',
      align: 'center',
      sortable: true,
      value: (row) =>
        row.temperature === 'hot' ? 3 : row.temperature === 'warm' ? 2 : 1,
      render: (row) => <TemperatureBadge value={row.temperature} />,
    },
    {
      key: 'source',
      header: 'Source reel',
      hideBelow: 'lg',
      value: (row) => row.sourceMediaId,
      render: (row) =>
        row.sourceMediaId ? (
          <Link
            to="/reels"
            className="inline-flex items-center gap-1 text-xs text-brand hover:underline"
            title={row.sourceMediaId}
          >
            <Film className="h-3.5 w-3.5" />
            {truncate(row.sourceMediaId, 12)}
          </Link>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        ),
    },
    {
      key: 'created',
      header: 'Age',
      align: 'right',
      hideBelow: 'sm',
      sortable: true,
      value: (row) => row.createdAt,
      render: (row) => (
        <span className="whitespace-nowrap text-xs text-slate-500">
          {formatRelative(row.createdAt)}
        </span>
      ),
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
            onChange={(event) =>
              changeStatus(row, event.target.value as EnquiryStatus)
            }
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
        description="Every lead the agent extracted from Instagram DMs and comments, as it was captured. Anyone with a name and phone number is also created as a lead in the CRM, where the AI qualification call and the rest of the pipeline run."
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
          label="Temperature"
          value={temperature}
          onChange={(value) => setTemperature(value as Temperature | '')}
          options={TEMPERATURES.map((value) => ({ value, label: humanise(value) }))}
        />
        {status || temperature ? (
          <button
            type="button"
            onClick={() => {
              setStatus('');
              setTemperature('');
            }}
            className="min-h-touch rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:text-brand"
          >
            Clear filters
          </button>
        ) : null}
        <span className="ml-auto self-center text-xs text-slate-500">
          {rows.length} shown
          {cursor ? '+' : ''}
        </span>
      </div>

      {pageError ? (
        <p
          role="alert"
          className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {pageError}
        </p>
      ) : null}

      {error ? (
        <ErrorState error={error} onRetry={reload} context="your enquiries" />
      ) : loading && !data ? (
        <SkeletonRows rows={6} />
      ) : rows.length === 0 ? (
        <EmptyState
          title={
            status || temperature
              ? 'No enquiries match these filters'
              : 'No enquiries captured yet'
          }
          description={
            status || temperature
              ? 'Clear the filters to see everything the agent has captured.'
              : 'An enquiry is written the moment the agent captures a phone number in a DM. Set up keyword rules so comments turn into DMs automatically.'
          }
          icon={<Users className="h-5 w-5" />}
          action={
            status || temperature ? (
              <button
                type="button"
                onClick={() => {
                  setStatus('');
                  setTemperature('');
                }}
                className="min-h-touch rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-light"
              >
                Clear filters
              </button>
            ) : (
              <Link
                to="/rules"
                className="inline-flex min-h-touch items-center rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-light"
              >
                Set up keyword rules
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
            rowClassName={(row) =>
              row.temperature === 'hot' ? 'bg-red-50/40' : undefined
            }
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
              <p className="text-xs text-slate-400">
                That is every enquiry for this filter.
              </p>
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
