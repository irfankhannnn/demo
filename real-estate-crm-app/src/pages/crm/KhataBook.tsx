import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Plus,
  Filter,
  Search,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  Clock,
  Edit2,
  Eye,
  DollarSign,
  ArrowLeft,
} from 'lucide-react';
import { api } from '../../services/api';
import type { KhataEntry, KhataFilters, KhataSummary } from '../../types/khata';
import Toast from '../../components/Toast';
import KhataDrawer from '../../components/KhataDrawer';

export default function KhataBook() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<KhataEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<KhataEntry[]>([]);
  const [summary, setSummary] = useState<KhataSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

  const [filters, setFilters] = useState<KhataFilters>({
    settlementStatus: 'PENDING', // Default to showing pending entries
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [entries, filters, searchQuery]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [entriesData, summaryData] = await Promise.all([
        api.getKhataEntries(),
        api.getKhataSummary(),
      ]);
      setEntries(entriesData);
      setSummary(summaryData);
    } catch (error) {
      console.error('Error loading khata data:', error);
      setToast({ message: 'Failed to load khata data', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...entries];

    // Apply filters
    if (filters.settlementStatus) {
      filtered = filtered.filter(e => e.settlementStatus === filters.settlementStatus);
    }
    if (filters.transactionType) {
      filtered = filtered.filter(e => e.transactionType === filters.transactionType);
    }
    if (filters.partyType) {
      filtered = filtered.filter(e => e.partyType === filters.partyType);
    }
    if (filters.propertyId) {
      filtered = filtered.filter(e => e.propertyId === filters.propertyId);
    }

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(e =>
        e.partyName.toLowerCase().includes(query) ||
        e.categoryName.toLowerCase().includes(query) ||
        (Array.isArray(e.lineItems) && e.lineItems.some(li => li.categoryName?.toLowerCase().includes(query))) ||
        e.property?.title.toLowerCase().includes(query) ||
        e.description?.toLowerCase().includes(query)
      );
    }

    setFilteredEntries(filtered);
  };

  const handleSettle = async (entryId: string) => {
    const notes = prompt('Settlement notes (optional):');
    if (notes === null) return; // User cancelled

    try {
      await api.settleKhataEntry(entryId, notes);
      setToast({ message: 'Entry settled successfully', type: 'success' });
      loadData();
    } catch (error) {
      console.error('Error settling entry:', error);
      setToast({ message: 'Failed to settle entry', type: 'error' });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto">
            <div className="absolute inset-0 rounded-full border-4 border-gray-200"></div>
            <div className="absolute inset-0 rounded-full border-4 border-purple-500 border-t-transparent animate-spin"></div>
          </div>
          <p className="mt-4 text-gray-600 animate-pulse">Loading Khata Book...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-indigo-50">
      {/* Header */}
      <div className="bg-white/70 backdrop-blur-xl border-b border-white/20 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/crm')}
                className="p-2 hover:bg-white/50 rounded-xl transition-colors"
                title="Back to Dashboard"
              >
                <ArrowLeft className="h-6 w-6 text-gray-600" />
              </button>
              <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl shadow-lg">
                <BookOpen className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Khata Book</h1>
                <p className="text-sm text-gray-600">Track payments with all parties</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => navigate('/crm/khata/settlement')}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all shadow-lg"
              >
                <DollarSign className="h-4 w-4" />
                <span>Settlement View</span>
              </button>
              <button
                onClick={() => navigate('/crm/khata/new')}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl hover:from-purple-600 hover:to-indigo-700 transition-all shadow-lg"
              >
                <Plus className="h-4 w-4" />
                <span>Add Entry</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white/60 backdrop-blur-xl rounded-2xl border border-white/20 shadow-xl p-6 hover:shadow-2xl transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">To Give</p>
                  <p className="text-2xl font-bold text-red-600">{formatCurrency(summary.totalToGive)}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-lg">
                  <TrendingDown className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>

            <div className="bg-white/60 backdrop-blur-xl rounded-2xl border border-white/20 shadow-xl p-6 hover:shadow-2xl transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">To Take</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(summary.totalToTake)}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>

            <div className="bg-white/60 backdrop-blur-xl rounded-2xl border border-white/20 shadow-xl p-6 hover:shadow-2xl transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Net Balance</p>
                  <p className={`text-2xl font-bold ${summary.netBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(Math.abs(summary.netBalance))}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {summary.netBalance >= 0 ? 'To Receive' : 'To Pay'}
                  </p>
                </div>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg ${summary.netBalance >= 0 ? 'bg-gradient-to-br from-green-500 to-emerald-600' : 'bg-gradient-to-br from-red-500 to-rose-600'}`}>
                  <DollarSign className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>

            <div className="bg-white/60 backdrop-blur-xl rounded-2xl border border-white/20 shadow-xl p-6 hover:shadow-2xl transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Pending</p>
                  <p className="text-2xl font-bold text-amber-600">{summary.pendingEntries}</p>
                  <p className="text-xs text-gray-500 mt-1">{summary.settledEntries} settled</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
                  <Clock className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters & Search */}
        <div className="bg-white/60 backdrop-blur-xl rounded-2xl border border-white/20 shadow-xl p-6 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by party, category, property..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white/80 backdrop-blur-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-all"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 border rounded-xl transition-all ${
                showFilters ? 'bg-purple-100 border-purple-300 text-purple-700 shadow-md' : 'border-gray-300 text-gray-700 hover:bg-white/80'
              }`}
            >
              <Filter className="h-4 w-4" />
              <span>Filters</span>
            </button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-200">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Settlement Status</label>
                <select
                  value={filters.settlementStatus || ''}
                  onChange={(e) => setFilters({ ...filters, settlementStatus: e.target.value as any })}
                  className="w-full px-4 py-2 bg-white/80 backdrop-blur-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-all"
                >
                  <option value="">All</option>
                  <option value="PENDING">Pending</option>
                  <option value="SETTLED">Settled</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Transaction Type</label>
                <select
                  value={filters.transactionType || ''}
                  onChange={(e) => setFilters({ ...filters, transactionType: e.target.value as any })}
                  className="w-full px-4 py-2 bg-white/80 backdrop-blur-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-all"
                >
                  <option value="">All</option>
                  <option value="TO_GIVE">To Give</option>
                  <option value="TO_TAKE">To Take</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Party Type</label>
                <select
                  value={filters.partyType || ''}
                  onChange={(e) => setFilters({ ...filters, partyType: e.target.value as any })}
                  className="w-full px-4 py-2 bg-white/80 backdrop-blur-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-all"
                >
                  <option value="">All</option>
                  <option value="OWNER">Owner</option>
                  <option value="TENANT">Tenant</option>
                  <option value="BUYER">Buyer</option>
                  <option value="SELLER">Seller</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Entries List */}
        <div className="bg-white/60 backdrop-blur-xl rounded-2xl border border-white/20 shadow-xl overflow-hidden">
          {filteredEntries.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No entries found</p>
              <button
                onClick={() => navigate('/crm/khata/new')}
                className="mt-4 text-purple-600 hover:text-purple-700 font-medium"
              >
                Add your first entry
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Property</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Party</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredEntries.map((entry) => (
                    <tr key={entry.entryId} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(entry.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{entry.property?.title || 'N/A'}</div>
                        <div className="text-sm text-gray-500">{entry.property?.flatNumber}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{entry.partyName}</div>
                        <div className="text-sm text-gray-500">{entry.partyType}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {Array.isArray(entry.lineItems) && entry.lineItems.length > 0 ? (
                          <div className="text-sm text-gray-900">
                            <div className="font-medium">{entry.lineItems[0].categoryName || entry.categoryName}</div>
                            {entry.lineItems.length > 1 && (
                              <div className="text-xs text-gray-500">
                                +{entry.lineItems.length - 1} more
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-sm text-gray-900">{entry.categoryName}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          entry.transactionType === 'TO_GIVE' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                        }`}>
                          {entry.transactionType === 'TO_GIVE' ? 'To Give' : 'To Take'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-sm font-semibold ${
                          entry.transactionType === 'TO_GIVE' ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {formatCurrency(entry.amount)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          entry.settlementStatus === 'SETTLED' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {entry.settlementStatus === 'SETTLED' ? (
                            <>
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Settled
                            </>
                          ) : (
                            <>
                              <Clock className="h-3 w-3 mr-1" />
                              Pending
                            </>
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setSelectedEntryId(entry.entryId)}
                            className="text-gray-600 hover:text-gray-900"
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {entry.settlementStatus === 'PENDING' && (
                            <>
                              <button
                                onClick={() => navigate(`/crm/khata/${entry.entryId}/edit`)}
                                className="text-purple-600 hover:text-purple-900"
                                title="Edit"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleSettle(entry.entryId)}
                                className="text-green-600 hover:text-green-900"
                                title="Mark as Settled"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Khata Drawer */}
      {selectedEntryId && (
        <KhataDrawer
          entryId={selectedEntryId}
          onClose={() => setSelectedEntryId(null)}
          onUpdate={loadData}
        />
      )}
    </div>
  );
}
