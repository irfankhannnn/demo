import { useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { cn } from '../lib/format';

export type SortDirection = 'asc' | 'desc';

export interface Column<T> {
  /** Stable id, also the sort key sent to `onSortChange`. */
  key: string;
  header: ReactNode;
  /** Sort comparator input. Required for a sortable column. */
  value?: (row: T) => string | number | null | undefined;
  render?: (row: T) => ReactNode;
  sortable?: boolean;
  align?: 'left' | 'right' | 'center';
  /** Hide this column below the given breakpoint so phones get a usable table. */
  hideBelow?: 'sm' | 'md' | 'lg';
  headerClassName?: string;
  cellClassName?: string;
  width?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  initialSort?: { key: string; direction: SortDirection };
  /**
   * Set when the server does the sorting (the reel leaderboard). The table then
   * reflects `initialSort` and reports clicks instead of re-ordering locally.
   */
  onSortChange?: (key: string, direction: SortDirection) => void;
  rowClassName?: (row: T) => string | undefined;
  onRowClick?: (row: T) => void;
  /** Rendered in place of the table body when `rows` is empty. */
  empty?: ReactNode;
  caption?: string;
}

const HIDE_BELOW: Record<NonNullable<Column<unknown>['hideBelow']>, string> = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
};

const ALIGN: Record<NonNullable<Column<unknown>['align']>, string> = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
};

function compare(a: unknown, b: unknown): number {
  const aMissing = a === null || a === undefined || a === '';
  const bMissing = b === null || b === undefined || b === '';
  if (aMissing && bMissing) return 0;
  // Missing values always sink, whichever way the column is sorted.
  if (aMissing) return 1;
  if (bMissing) return -1;

  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'en', { numeric: true });
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  initialSort,
  onSortChange,
  rowClassName,
  onRowClick,
  empty,
  caption,
}: DataTableProps<T>) {
  const [localSort, setLocalSort] = useState(initialSort ?? null);
  const sort = onSortChange ? (initialSort ?? null) : localSort;

  const sorted = useMemo(() => {
    if (onSortChange || !sort) return rows;
    const column = columns.find((c) => c.key === sort.key);
    if (!column?.value) return rows;
    const factor = sort.direction === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => factor * compare(column.value!(a), column.value!(b)));
  }, [rows, columns, sort, onSortChange]);

  function toggle(column: Column<T>) {
    if (!column.sortable) return;
    const nextDirection: SortDirection =
      sort?.key === column.key && sort.direction === 'desc' ? 'asc' : 'desc';
    if (onSortChange) onSortChange(column.key, nextDirection);
    else setLocalSort({ key: column.key, direction: nextDirection });
  }

  if (rows.length === 0 && empty) {
    return <>{empty}</>;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] border-collapse text-sm">
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              {columns.map((column) => {
                // Narrowed to a plain value so TypeScript does not have to
                // re-prove `sort` is non-null inside the JSX below.
                const activeDirection: SortDirection | null =
                  sort && sort.key === column.key ? sort.direction : null;
                return (
                  <th
                    key={column.key}
                    scope="col"
                    style={column.width ? { width: column.width } : undefined}
                    aria-sort={
                      activeDirection
                        ? activeDirection === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : undefined
                    }
                    className={cn(
                      'px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500',
                      ALIGN[column.align ?? 'left'],
                      column.hideBelow && HIDE_BELOW[column.hideBelow],
                      column.headerClassName,
                    )}
                  >
                    {column.sortable ? (
                      <button
                        type="button"
                        onClick={() => toggle(column)}
                        className={cn(
                          'inline-flex items-center gap-1 rounded transition hover:text-brand focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-1',
                          column.align === 'right' && 'flex-row-reverse',
                          activeDirection && 'text-brand',
                        )}
                      >
                        {column.header}
                        {activeDirection ? (
                          activeDirection === 'asc' ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : (
                            <ArrowDown className="h-3 w-3" />
                          )
                        ) : (
                          <ChevronsUpDown className="h-3 w-3 opacity-40" />
                        )}
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  'transition',
                  onRowClick && 'cursor-pointer',
                  'hover:bg-slate-50',
                  rowClassName?.(row),
                )}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      'px-3 py-3 align-middle text-slate-700',
                      ALIGN[column.align ?? 'left'],
                      column.hideBelow && HIDE_BELOW[column.hideBelow],
                      column.cellClassName,
                    )}
                  >
                    {column.render
                      ? column.render(row)
                      : String(column.value?.(row) ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
