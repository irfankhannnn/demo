import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Building2,
  Filter,
} from 'lucide-react';
import { api } from '../../services/api';
import type { KhataSummary, KhataPropertySummary } from '../../types/khata';

export default function KhataSettlement() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<KhataSummary | null>(null);
  const [bifurcation, setBifurcation] = useState<KhataPropertySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSettled, setShowSettled] = useState(false);

  useEffect(() => {
    loadData();
  }, [showSettled]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [summaryData, bifurcationData] = await Promise.all([
        api.getKhataSummary(),
        api.getKhataBifurcation(showSettled ? undefined : 'PENDING'),
      ]);
      setSummary(summaryData);
      setBifurcation(bifurcationData);
    } catch (error) {
      console.error('Error loading settlement data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto">
            <div className="absolute inset-0 rounded-full border-4 border-gray-200"></div>
            <div className="absolute inset-0 rounded-full border-4 border-purple-500 border-t-transparent animate-spin"></div>
          </div>
          <p className="mt-4 text-gray-600 animate-pulse">Loading settlement data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-indigo-50">
      {/* Header */}
      <div className="bg-white/70 backdrop-blur-xl border-b border-white/20 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/crm/khata')}
                className="p-2 hover:bg-white/50 rounded-xl transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Settlement View</h1>
                <p className="text-sm text-gray-600">Property-wise transaction breakdown</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/crm/khata')}
              className="px-4 py-2 text-purple-600 hover:bg-purple-50 rounded-xl transition-colors"
            >
              Back to Khata Book
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Overall Summary */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-2xl shadow-2xl p-6 text-white border border-white/20">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Total To Give</h3>
                <TrendingDown className="h-8 w-8 opacity-80" />
              </div>
              <p className="text-3xl font-bold">{formatCurrency(summary.totalToGive)}</p>
              <p className="text-sm opacity-80 mt-2">Amount to pay out</p>
            </div>

            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl shadow-2xl p-6 text-white border border-white/20">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Total To Take</h3>
                <TrendingUp className="h-8 w-8 opacity-80" />
              </div>
              <p className="text-3xl font-bold">{formatCurrency(summary.totalToTake)}</p>
              <p className="text-sm opacity-80 mt-2">Amount to collect</p>
            </div>

            <div className={`bg-gradient-to-br ${summary.netBalance >= 0 ? 'from-blue-500 to-blue-600' : 'from-orange-500 to-orange-600'} rounded-2xl shadow-2xl p-6 text-white border border-white/20`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Net Balance</h3>
                <DollarSign className="h-8 w-8 opacity-80" />
              </div>
              <p className="text-3xl font-bold">{formatCurrency(Math.abs(summary.netBalance))}</p>
              <p className="text-sm opacity-80 mt-2">
                {summary.netBalance >= 0 ? 'Net receivable' : 'Net payable'}
              </p>
            </div>
          </div>
        )}

        {/* Filter Toggle */}
        <div className="bg-white/60 backdrop-blur-xl rounded-2xl border border-white/20 shadow-xl p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Filter className="h-5 w-5 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">Show:</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowSettled(false)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  !showSettled
                    ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Pending Only
              </button>
              <button
                onClick={() => setShowSettled(true)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  showSettled
                    ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All Transactions
              </button>
            </div>
          </div>
        </div>

        {/* Property-wise Bifurcation */}
        <div className="bg-white/60 backdrop-blur-xl rounded-2xl border border-white/20 shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 px-6 py-4 border-b border-purple-100">
            <h2 className="text-lg font-semibold text-gray-900">Property-wise Breakdown</h2>
            <p className="text-sm text-gray-600 mt-1">
              {showSettled ? 'All transactions' : 'Pending transactions only'}
            </p>
          </div>

          {bifurcation.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No transactions found</p>
              <button
                onClick={() => navigate('/crm/khata/new')}
                className="mt-4 text-purple-600 hover:text-purple-700 font-medium"
              >
                Add your first transaction
              </button>
            </div>
          ) : (
            <div className="divide-y divide-purple-100">
              {bifurcation.map((property) => (
                <div key={property.propertyId} className="p-6 hover:bg-purple-50/30 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Building2 className="h-5 w-5 text-purple-600" />
                        <h3 className="text-lg font-semibold text-gray-900">
                          {property.propertyTitle}
                        </h3>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span>{property.area}</span>
                        {property.flatNumber && (
                          <>
                            <span>•</span>
                            <span>Flat {property.flatNumber}</span>
                          </>
                        )}
                        <span>•</span>
                        <span>{property.entriesCount} {property.entriesCount === 1 ? 'entry' : 'entries'}</span>
                      </div>
                    </div>

                    <div className="flex gap-6 text-right">
                      <div>
                        <p className="text-xs text-gray-600 mb-1">To Give</p>
                        <p className="text-lg font-semibold text-red-600">
                          {formatCurrency(property.toGive)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 mb-1">To Take</p>
                        <p className="text-lg font-semibold text-green-600">
                          {formatCurrency(property.toTake)}
                        </p>
                      </div>
                      <div className="min-w-[120px]">
                        <p className="text-xs text-gray-600 mb-1">Net Balance</p>
                        <p className={`text-lg font-bold ${
                          property.netBalance >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {formatCurrency(Math.abs(property.netBalance))}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {property.netBalance >= 0 ? 'To Receive' : 'To Pay'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={() => {
                        navigate('/crm/khata', { 
                          state: { propertyId: property.propertyId }
                        });
                      }}
                      className="text-sm px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl hover:from-purple-600 hover:to-indigo-700 transition-all shadow-md"
                    >
                      View transactions →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Summary Stats */}
        {bifurcation.length > 0 && (
          <div className="mt-6 bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-2xl p-6 shadow-xl">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-sm text-purple-600 font-medium mb-1">Properties</p>
                <p className="text-2xl font-bold text-purple-900">{bifurcation.length}</p>
              </div>
              <div>
                <p className="text-sm text-purple-600 font-medium mb-1">Total Entries</p>
                <p className="text-2xl font-bold text-purple-900">
                  {bifurcation.reduce((sum, p) => sum + p.entriesCount, 0)}
                </p>
              </div>
              <div>
                <p className="text-sm text-purple-600 font-medium mb-1">Properties to Pay</p>
                <p className="text-2xl font-bold text-purple-900">
                  {bifurcation.filter(p => p.netBalance < 0).length}
                </p>
              </div>
              <div>
                <p className="text-sm text-purple-600 font-medium mb-1">Properties to Receive</p>
                <p className="text-2xl font-bold text-purple-900">
                  {bifurcation.filter(p => p.netBalance > 0).length}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
