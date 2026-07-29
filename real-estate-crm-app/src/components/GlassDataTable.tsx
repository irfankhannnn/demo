import { useState, ReactNode } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown, Search, Filter, X } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  width?: string;
  render?: (item: T, index: number) => ReactNode;
  className?: string;
}

interface GlassDataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  emptyMessage?: string;
  emptyIcon?: ReactNode;
  loading?: boolean;
  filters?: ReactNode;
  showFilters?: boolean;
  onToggleFilters?: () => void;
  className?: string;
  headerClassName?: string;
  rowClassName?: (item: T) => string;
  stickyHeader?: boolean;
  tableFixed?: boolean;
  compact?: boolean;
}

export default function GlassDataTable<T>({
  data,
  columns,
  keyExtractor,
  onRowClick,
  searchPlaceholder = 'Search...',
  searchValue = '',
  onSearchChange,
  emptyMessage = 'No data found',
  emptyIcon,
  loading = false,
  filters,
  showFilters = false,
  onToggleFilters,
  className = '',
  headerClassName = '',
  rowClassName,
  stickyHeader = true,
  tableFixed = false,
  compact = false,
}: GlassDataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const sortedData = sortKey
    ? [...data].sort((a, b) => {
        const aVal = (a as Record<string, unknown>)[sortKey];
        const bVal = (b as Record<string, unknown>)[sortKey];
        
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;
        
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return sortDirection === 'asc' 
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
        }
        
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        }
        
        return 0;
      })
    : data;

  return (
    <div className={`glass-table-container ${className}`}>
      {/* Search and Filter Bar */}
      {(onSearchChange || filters) && (
        <div className="mb-5 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            {onSearchChange && (
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input
                  type="text"
                  value={searchValue}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full pl-12 pr-10 py-3 glass-premium border border-white/40 rounded-2xl shadow-lg shadow-black/5 focus:shadow-[0_0_0_4px_rgba(99,102,241,0.10)] focus:border-indigo-400 focus:outline-none transition-all duration-300 text-slate-700 placeholder-slate-400 font-medium"
                />
                {searchValue && (
                  <button
                    onClick={() => onSearchChange('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 hover:bg-slate-100/80 rounded-full transition-colors"
                  >
                    <X className="h-4 w-4 text-slate-400" />
                  </button>
                )}
              </div>
            )}
            {filters && onToggleFilters && (
              <button
                onClick={onToggleFilters}
                className={`flex items-center gap-2 px-4 py-3 rounded-2xl border transition-all duration-300 font-semibold btn-press ${
                  showFilters
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white border-transparent shadow-lg shadow-indigo-500/25'
                    : 'glass-premium border-white/40 text-slate-600 hover:bg-white/80'
                }`}
              >
                <Filter className="h-5 w-5" />
                <span className="hidden sm:inline">Filters</span>
              </button>
            )}
          </div>
          
          {/* Filter Panel */}
          {showFilters && filters && (
            <div className="p-4 glass-premium rounded-2xl border border-white/40 shadow-lg animate-fadeInUp">
              {filters}
            </div>
          )}
        </div>
      )}

      {/* Table Container */}
      <div className="relative overflow-hidden rounded-2xl glass-premium border border-white/40 shadow-xl shadow-black/5">
        <div className={tableFixed ? 'overflow-x-hidden' : 'overflow-x-auto'}>
          <table className={`w-full ${tableFixed ? 'table-fixed' : ''}`}>
            <thead className={`${stickyHeader ? 'sticky top-0 z-10' : ''} ${headerClassName}`}>
              <tr className="bg-gradient-to-r from-slate-50/90 to-white/90 backdrop-blur-xl border-b border-slate-200/50">
                {columns.map((column) => (
                  <th
                    key={column.key}
                    style={{ width: column.width }}
                    className={`${compact ? 'px-3 py-3' : 'px-4 py-4'} text-left text-xs font-bold text-slate-500 uppercase tracking-wider ${
                      column.sortable ? 'cursor-pointer hover:bg-slate-100/50 transition-colors select-none' : ''
                    } ${column.className || ''}`}
                    onClick={() => column.sortable && handleSort(column.key)}
                  >
                    <div className="flex items-center gap-2">
                      <span>{column.header}</span>
                      {column.sortable && (
                        <span className="text-slate-400">
                          {sortKey === column.key ? (
                            sortDirection === 'asc' ? (
                              <ChevronUp className="h-4 w-4 text-indigo-500" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-indigo-500" />
                            )
                          ) : (
                            <ChevronsUpDown className="h-4 w-4 opacity-40" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/50">
              {loading ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-16 text-center">
                    <LoadingSpinner message="Loading..." size="md" />
                  </td>
                </tr>
              ) : sortedData.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center animate-fadeInUp">
                      {emptyIcon || (
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center shadow-sm">
                          <Search className="h-8 w-8 text-slate-400" />
                        </div>
                      )}
                      <p className="mt-4 text-slate-500 font-medium">{emptyMessage}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                sortedData.map((item, index) => (
                  <tr
                    key={keyExtractor(item)}
                    onClick={() => onRowClick?.(item)}
                    className={`
                      group transition-all duration-300
                      ${onRowClick ? 'cursor-pointer hover:bg-gradient-to-r hover:from-indigo-50/60 hover:to-purple-50/40' : 'hover:bg-slate-50/50'}
                      ${index % 2 === 0 ? 'bg-white/30' : 'bg-slate-50/20'}
                      ${rowClassName?.(item) || ''}
                    `}
                    style={{
                      animation: `fadeInUp 0.3s ease-out ${index * 0.03}s both`
                    }}
                  >
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={`${compact ? 'px-3 py-3' : 'px-4 py-4'} text-sm text-slate-700 font-medium ${column.className || ''}`}
                      >
                        {column.render
                          ? column.render(item, index)
                          : String((item as Record<string, unknown>)[column.key] ?? '-')}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Results count */}
      {!loading && sortedData.length > 0 && (
        <div className="mt-4 text-sm text-slate-400 text-center font-medium">
          Showing <span className="font-bold text-slate-700">{sortedData.length}</span> results
        </div>
      )}

      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .glass-table-container {
          perspective: 1000px;
        }
      `}</style>
    </div>
  );
}
