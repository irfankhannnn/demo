import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  Search,
  RefreshCw,
  AlertCircle,
  ArrowUpDown,
  Clock,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Calendar,
  User,
  Filter,
  Eye,
} from 'lucide-react';
import { api } from '../../services/api';
import type {
  KhataPropertySummary,
  AgingData,
  AgingBucket,
  SettlementTrendsData,
  SettlementHistoryData,
  SettlementHistoryEntry,
} from '../../types/khata';

type ActiveTab = 'aging' | 'properties' | 'history';
type SortOption = 'balanceDesc' | 'balanceAsc' | 'nameAsc' | 'nameDesc' | 'entriesDesc';
type SettlementFilter = 'PENDING' | 'SETTLED' | 'ALL';

const AGING_COLORS: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  '0-30':  { bg: 'bg-green-50',  border: 'border-green-200', text: 'text-green-700',  badge: 'bg-green-100 text-green-800' },
  '31-60': { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', badge: 'bg-yellow-100 text-yellow-800' },
  '61-90': { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-800' },
  '90+':   { bg: 'bg-red-50',    border: 'border-red-200',   text: 'text-red-700',    badge: 'bg-red-100 text-red-800' },
};

export default function KhataSettlement() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<ActiveTab>('aging');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [agingData, setAgingData] = useState<AgingData | null>(null);
  const [trendsData, setTrendsData] = useState<SettlementTrendsData | null>(null);
  const [historyData, setHistoryData] = useState<SettlementHistoryData | null>(null);
  const [bifurcation, setBifurcation] = useState<KhataPropertySummary[]>([]);

  // UI states
  const [expandedBucket, setExpandedBucket] = useState<string | null>(null);
  const [propertySearch, setPropertySearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('balanceDesc');
  const [propertyFilter, setPropertyFilter] = useState<SettlementFilter>('PENDING');

  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    loadBifurcation();
  }, [propertyFilter]);

  const loadAllData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [aging, trends, history, bif] = await Promise.all([
        api.getKhataAging(),
        api.getKhataSettlementTrends(),
        api.getKhataSettlementHistory(20),
        api.getKhataBifurcation('PENDING'),
      ]);
      setAgingData(aging);
      setTrendsData(trends);
      setHistoryData(history);
      setBifurcation(bif);
    } catch (err) {
      console.error('Error loading settlement data:', err);
      setError('Failed to load settlement data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadBifurcation = async () => {
    try {
      const bif = await api.getKhataBifurcation(propertyFilter === 'ALL' ? undefined : propertyFilter);
      setBifurcation(bif);
    } catch (err) {
      console.error('Error loading bifurcation:', err);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  };

  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
  };

  // Filter and sort properties
  const filteredProperties = useMemo(() => {
    let filtered = [...bifurcation];
    if (propertySearch.trim()) {
      const q = propertySearch.toLowerCase();
      filtered = filtered.filter(p =>
        p.propertyTitle?.toLowerCase().includes(q) ||
        p.area?.toLowerCase().includes(q) ||
        p.flatNumber?.toLowerCase().includes(q)
      );
    }
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'balanceDesc': return Math.abs(b.netBalance) - Math.abs(a.netBalance);
        case 'balanceAsc':  return Math.abs(a.netBalance) - Math.abs(b.netBalance);
        case 'nameAsc':     return (a.propertyTitle || '').localeCompare(b.propertyTitle || '');
        case 'nameDesc':    return (b.propertyTitle || '').localeCompare(a.propertyTitle || '');
        case 'entriesDesc': return b.entriesCount - a.entriesCount;
        default: return 0;
      }
    });
    return filtered;
  }, [bifurcation, propertySearch, sortBy]);

  // ======================== LOADING / ERROR ========================
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto">
            <div className="absolute inset-0 rounded-full border-4 border-gray-200" />
            <div className="absolute inset-0 rounded-full border-4 border-purple-500 border-t-transparent animate-spin" />
          </div>
          <p className="mt-4 text-gray-600 animate-pulse">Loading settlement intelligence...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Data</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button onClick={loadAllData} className="px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl hover:from-purple-600 hover:to-indigo-700 transition-all shadow-lg">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // ======================== RENDER HELPERS ========================

  const renderKpiCards = () => {
    if (!agingData || !trendsData) return null;

    const overdueCount = agingData.buckets
      .filter(b => b.bucket === '61-90' || b.bucket === '90+')
      .reduce((sum, b) => sum + b.count, 0);
    const overdueAmount = agingData.buckets
      .filter(b => b.bucket === '61-90' || b.bucket === '90+')
      .reduce((sum, b) => sum + b.amount, 0);

    const monthChange = trendsData.previousMonth.settledCount > 0
      ? Math.round(((trendsData.currentMonth.settledCount - trendsData.previousMonth.settledCount) / trendsData.previousMonth.settledCount) * 100)
      : trendsData.currentMonth.settledCount > 0 ? 100 : 0;

    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Avg Days Pending */}
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <Clock className="h-5 w-5 text-purple-600" />
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              agingData.avgDaysPending <= 30 ? 'bg-green-100 text-green-700' :
              agingData.avgDaysPending <= 60 ? 'bg-yellow-100 text-yellow-700' :
              'bg-red-100 text-red-700'
            }`}>
              {agingData.avgDaysPending <= 30 ? 'Good' : agingData.avgDaysPending <= 60 ? 'Moderate' : 'Critical'}
            </span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{agingData.avgDaysPending}<span className="text-sm font-normal text-gray-500 ml-1">days</span></p>
          <p className="text-sm text-gray-600 mt-1">Avg Pending Age</p>
        </div>

        {/* Overdue Items */}
        <div className={`bg-white/70 backdrop-blur-xl rounded-2xl border shadow-lg p-5 ${overdueCount > 0 ? 'border-red-200' : 'border-white/20'}`}>
          <div className="flex items-center justify-between mb-3">
            <AlertTriangle className={`h-5 w-5 ${overdueCount > 0 ? 'text-red-600' : 'text-gray-400'}`} />
            {overdueCount > 0 && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">Action Required</span>}
          </div>
          <p className="text-3xl font-bold text-gray-900">{overdueCount}</p>
          <p className="text-sm text-gray-600 mt-1">Overdue (60+ days)</p>
          {overdueAmount > 0 && <p className="text-xs text-red-600 font-medium mt-1">{formatCurrency(overdueAmount)} at risk</p>}
        </div>

        {/* Settlement Rate */}
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              trendsData.settlementRate >= 70 ? 'bg-green-100 text-green-700' :
              trendsData.settlementRate >= 40 ? 'bg-yellow-100 text-yellow-700' :
              'bg-red-100 text-red-700'
            }`}>
              {trendsData.settlementRate}%
            </span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{trendsData.totalSettled}<span className="text-sm font-normal text-gray-500 ml-1">/ {trendsData.totalSettled + trendsData.totalPending}</span></p>
          <p className="text-sm text-gray-600 mt-1">Settlement Rate</p>
        </div>

        {/* This Month vs Last */}
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg p-5">
          <div className="flex items-center justify-between mb-3">
            {monthChange >= 0 ? <TrendingUp className="h-5 w-5 text-green-600" /> : <TrendingDown className="h-5 w-5 text-red-600" />}
            {monthChange !== 0 && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${monthChange > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {monthChange > 0 ? '+' : ''}{monthChange}%
              </span>
            )}
          </div>
          <p className="text-3xl font-bold text-gray-900">{trendsData.currentMonth.settledCount}</p>
          <p className="text-sm text-gray-600 mt-1">Settled This Month</p>
          <p className="text-xs text-gray-500 mt-1">vs {trendsData.previousMonth.settledCount} last month</p>
        </div>
      </div>
    );
  };

  const renderAgingTab = () => {
    if (!agingData) return <p className="text-center text-gray-500 py-12">No aging data available</p>;

    return (
      <div className="space-y-4">
        {/* Aging Buckets */}
        {agingData.buckets.map((bucket: AgingBucket) => {
          const colors = AGING_COLORS[bucket.bucket] || AGING_COLORS['0-30'];
          const isExpanded = expandedBucket === bucket.bucket;
          const pct = agingData.totalAmount > 0 ? Math.round((bucket.amount / agingData.totalAmount) * 100) : 0;

          return (
            <div key={bucket.bucket} className={`${colors.bg} border ${colors.border} rounded-2xl overflow-hidden transition-all`}>
              <button
                onClick={() => setExpandedBucket(isExpanded ? null : bucket.bucket)}
                className="w-full px-6 py-4 flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-4">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${colors.badge}`}>
                    {bucket.label}
                  </span>
                  <div>
                    <span className="text-lg font-bold text-gray-900">{bucket.count}</span>
                    <span className="text-sm text-gray-600 ml-1">{bucket.count === 1 ? 'entry' : 'entries'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className={`text-lg font-bold ${colors.text}`}>{formatCurrency(bucket.amount)}</p>
                    <p className="text-xs text-gray-500">{pct}% of total</p>
                  </div>
                  {bucket.count > 0 && (isExpanded ? <ChevronUp className="h-5 w-5 text-gray-500" /> : <ChevronDown className="h-5 w-5 text-gray-500" />)}
                </div>
              </button>

              {/* Progress bar */}
              <div className="px-6 pb-3">
                <div className="w-full bg-white/50 rounded-full h-2">
                  <div className={`h-2 rounded-full transition-all ${
                    bucket.bucket === '0-30' ? 'bg-green-500' :
                    bucket.bucket === '31-60' ? 'bg-yellow-500' :
                    bucket.bucket === '61-90' ? 'bg-orange-500' : 'bg-red-500'
                  }`} style={{ width: `${pct}%` }} />
                </div>
              </div>

              {/* Expanded entries */}
              {isExpanded && bucket.entries.length > 0 && (
                <div className="border-t border-white/50 bg-white/30">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-gray-500 uppercase tracking-wider">
                          <th className="px-6 py-3">Party</th>
                          <th className="px-6 py-3">Property</th>
                          <th className="px-6 py-3">Type</th>
                          <th className="px-6 py-3">Amount</th>
                          <th className="px-6 py-3">Days</th>
                          <th className="px-6 py-3">Created</th>
                          <th className="px-6 py-3"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {bucket.entries.map(entry => (
                          <tr key={entry.entryId} className="hover:bg-white/50">
                            <td className="px-6 py-3">
                              <p className="font-medium text-gray-900">{entry.partyName}</p>
                              <p className="text-xs text-gray-500">{entry.partyType}</p>
                            </td>
                            <td className="px-6 py-3 text-gray-700">{entry.propertyTitle}</td>
                            <td className="px-6 py-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                entry.transactionType === 'TO_GIVE' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                              }`}>
                                {entry.transactionType === 'TO_GIVE' ? 'To Give' : 'To Take'}
                              </span>
                            </td>
                            <td className={`px-6 py-3 font-semibold ${entry.transactionType === 'TO_GIVE' ? 'text-red-600' : 'text-green-600'}`}>
                              {formatCurrency(entry.amount)}
                            </td>
                            <td className="px-6 py-3">
                              <span className={`font-bold ${
                                entry.daysPending <= 30 ? 'text-green-600' :
                                entry.daysPending <= 60 ? 'text-yellow-600' :
                                entry.daysPending <= 90 ? 'text-orange-600' : 'text-red-600'
                              }`}>
                                {entry.daysPending}d
                              </span>
                            </td>
                            <td className="px-6 py-3 text-gray-500">{formatDate(entry.createdAt)}</td>
                            <td className="px-6 py-3">
                              <button
                                onClick={() => navigate('/crm/khata', { state: { propertyId: entry.propertyId } })}
                                className="p-1.5 text-purple-600 hover:bg-purple-100 rounded-lg transition-colors"
                                title="View in Khata Book"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Aging Summary Footer */}
        {agingData.totalPending > 0 && (
          <div className="bg-white/60 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Pending</p>
                <p className="text-2xl font-bold text-gray-900">{agingData.totalPending}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Amount</p>
                <p className="text-2xl font-bold text-purple-700">{formatCurrency(agingData.totalAmount)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Avg Age</p>
                <p className="text-2xl font-bold text-gray-900">{agingData.avgDaysPending} <span className="text-sm font-normal">days</span></p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Oldest Entry</p>
                <p className="text-2xl font-bold text-gray-900">{agingData.oldestEntryDays} <span className="text-sm font-normal">days</span></p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderPropertiesTab = () => (
    <div className="space-y-4">
      {/* Property Controls */}
      <div className="bg-white/60 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-gray-600" />
            <div className="flex gap-2">
              {(['PENDING', 'SETTLED', 'ALL'] as SettlementFilter[]).map(f => (
                <button
                  key={f}
                  onClick={() => setPropertyFilter(f)}
                  className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
                    propertyFilter === f
                      ? f === 'PENDING' ? 'bg-amber-100 text-amber-700 border border-amber-300'
                        : f === 'SETTLED' ? 'bg-green-100 text-green-700 border border-green-300'
                        : 'bg-purple-100 text-purple-700 border border-purple-300'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search properties..."
              value={propertySearch}
              onChange={e => setPropertySearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white/80 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-all text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4 text-gray-600" />
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as SortOption)}
              className="px-3 py-2 bg-white/80 border border-gray-300 rounded-xl text-sm"
            >
              <option value="balanceDesc">Highest Balance</option>
              <option value="balanceAsc">Lowest Balance</option>
              <option value="nameAsc">Name (A-Z)</option>
              <option value="nameDesc">Name (Z-A)</option>
              <option value="entriesDesc">Most Entries</option>
            </select>
          </div>
        </div>
      </div>

      {/* Property List */}
      {filteredProperties.length === 0 ? (
        <div className="bg-white/60 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg p-12 text-center">
          <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">
            {bifurcation.length === 0
              ? propertyFilter === 'PENDING' ? 'No pending transactions' : 'No transactions found'
              : `No properties match "${propertySearch}"`
            }
          </p>
          {bifurcation.length === 0 && propertyFilter === 'PENDING' && (
            <button onClick={() => setPropertyFilter('ALL')} className="mt-3 text-purple-600 hover:text-purple-700 font-medium text-sm">
              View all transactions
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white/60 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg overflow-hidden divide-y divide-purple-100">
          {filteredProperties.map(property => (
            <div key={property.propertyId} className="p-5 hover:bg-purple-50/30 transition-colors">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <Building2 className="h-5 w-5 text-purple-600 shrink-0" />
                    <h3 className="text-base font-semibold text-gray-900 truncate">{property.propertyTitle || 'Unknown Property'}</h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500 ml-8">
                    {property.area && <span>{property.area}</span>}
                    {property.flatNumber && <><span>-</span><span>Flat {property.flatNumber}</span></>}
                    <span>-</span>
                    <span>{property.entriesCount} {property.entriesCount === 1 ? 'entry' : 'entries'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-center min-w-[70px]">
                    <p className="text-xs text-gray-500">To Give</p>
                    <p className="text-sm font-semibold text-red-600">{formatCurrency(property.toGive)}</p>
                  </div>
                  <div className="text-center min-w-[70px]">
                    <p className="text-xs text-gray-500">To Take</p>
                    <p className="text-sm font-semibold text-green-600">{formatCurrency(property.toTake)}</p>
                  </div>
                  <div className="text-center min-w-[90px]">
                    <p className="text-xs text-gray-500">Net</p>
                    <p className={`text-base font-bold ${property.netBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(Math.abs(property.netBalance))}
                    </p>
                    <p className="text-xs text-gray-400">{property.netBalance >= 0 ? 'Receive' : 'Pay'}</p>
                  </div>
                  <button
                    onClick={() => navigate('/crm/khata', { state: { propertyId: property.propertyId } })}
                    className="text-sm px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl hover:from-purple-600 hover:to-indigo-700 transition-all shadow-md shrink-0"
                  >
                    View
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderHistoryTab = () => {
    if (!historyData || historyData.history.length === 0) {
      return (
        <div className="bg-white/60 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg p-12 text-center">
          <CheckCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">No settlement history yet</p>
          <p className="text-sm text-gray-500 mt-2">Settled entries will appear here with full audit trail</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Trends Summary */}
        {trendsData && trendsData.trends.length > 0 && (
          <div className="bg-white/60 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg p-6">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">Monthly Settlement Trend</h3>
            <div className="flex items-end gap-2 h-32">
              {trendsData.trends.map((t, i) => {
                const maxAmount = Math.max(...trendsData.trends.map(x => x.settledAmount), 1);
                const height = Math.max((t.settledAmount / maxAmount) * 100, 4);
                return (
                  <div key={t.month} className="flex-1 flex flex-col items-center gap-1" title={`${formatMonth(t.month)}: ${formatCurrency(t.settledAmount)} (${t.settledCount} entries, avg ${t.avgDaysToSettle}d)`}>
                    <div className="w-full bg-purple-200 rounded-t-lg transition-all hover:bg-purple-300" style={{ height: `${height}%` }}>
                      <div className="w-full bg-gradient-to-t from-purple-600 to-indigo-500 rounded-t-lg h-full" />
                    </div>
                    <span className="text-[10px] text-gray-500 whitespace-nowrap">{formatMonth(t.month)}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
              <div className="text-sm text-gray-600">
                Avg settlement time: <span className="font-bold text-gray-900">{trendsData.overallAvgDaysToSettle} days</span>
              </div>
              <div className="text-sm text-gray-600">
                This month: <span className="font-bold text-purple-700">{formatCurrency(trendsData.currentMonth.settledAmount)}</span>
              </div>
            </div>
          </div>
        )}

        {/* History Table */}
        <div className="bg-white/60 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Recent Settlements</h3>
            <p className="text-xs text-gray-500 mt-1">Showing last {historyData.history.length} of {historyData.total} settled entries</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase tracking-wider bg-gray-50/50">
                  <th className="px-6 py-3">Settled On</th>
                  <th className="px-6 py-3">Property</th>
                  <th className="px-6 py-3">Party</th>
                  <th className="px-6 py-3">Amount</th>
                  <th className="px-6 py-3">Days Taken</th>
                  <th className="px-6 py-3">Settled By</th>
                  <th className="px-6 py-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {historyData.history.map((entry: SettlementHistoryEntry) => (
                  <tr key={entry.entryId} className="hover:bg-purple-50/30">
                    <td className="px-6 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5 text-gray-400" />
                        <span className="text-gray-900">{formatDate(entry.settledAt)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-gray-700 max-w-[150px] truncate">{entry.propertyTitle}</td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <User className="h-3.5 w-3.5 text-gray-400" />
                        <span className="text-gray-900">{entry.partyName}</span>
                      </div>
                    </td>
                    <td className={`px-6 py-3 font-semibold ${entry.transactionType === 'TO_GIVE' ? 'text-red-600' : 'text-green-600'}`}>
                      {formatCurrency(entry.amount)}
                    </td>
                    <td className="px-6 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        entry.daysToSettle <= 7 ? 'bg-green-100 text-green-800' :
                        entry.daysToSettle <= 30 ? 'bg-yellow-100 text-yellow-800' :
                        entry.daysToSettle <= 60 ? 'bg-orange-100 text-orange-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {entry.daysToSettle}d
                      </span>
                    </td>
                    <td className="px-6 py-3 text-gray-600 text-xs">{entry.settledBy}</td>
                    <td className="px-6 py-3 text-gray-500 text-xs max-w-[150px] truncate" title={entry.settlementNotes}>
                      {entry.settlementNotes || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // ======================== MAIN RENDER ========================
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-indigo-50">
      {/* Header */}
      <div className="bg-white/70 backdrop-blur-xl border-b border-white/20 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => navigate('/crm/khata')} className="p-2 hover:bg-white/50 rounded-xl transition-colors">
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Settlement Intelligence</h1>
                <p className="text-sm text-gray-500">Aging analysis, trends & settlement history</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={loadAllData}
                disabled={loading}
                className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all text-sm disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
              <button
                onClick={() => navigate('/crm/khata')}
                className="px-4 py-2 text-purple-600 hover:bg-purple-50 rounded-xl transition-colors text-sm font-medium"
              >
                Back to Khata Book
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* KPI Cards */}
        {renderKpiCards()}

        {/* Tab Navigation */}
        <div className="flex gap-1 mb-6 bg-white/40 backdrop-blur-xl rounded-2xl p-1.5 border border-white/20 shadow-sm">
          {([
            { key: 'aging' as ActiveTab, label: 'Aging Analysis', icon: Clock, count: agingData?.totalPending },
            { key: 'properties' as ActiveTab, label: 'Properties', icon: Building2, count: bifurcation.length },
            { key: 'history' as ActiveTab, label: 'Settlement History', icon: CheckCircle, count: historyData?.total },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? 'bg-white shadow-md text-purple-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  activeTab === tab.key ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'aging' && renderAgingTab()}
        {activeTab === 'properties' && renderPropertiesTab()}
        {activeTab === 'history' && renderHistoryTab()}
      </div>
    </div>
  );
}
