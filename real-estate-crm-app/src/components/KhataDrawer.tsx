import { useState, useEffect } from 'react';
import { X, IndianRupee, Calendar, User, Building2, FileText, CheckCircle, Clock } from 'lucide-react';
import { api } from '../services/api';
import { KhataEntry } from '../types/khata';

interface KhataDrawerProps {
  entryId: string | null;
  onClose: () => void;
  onUpdate: () => void;
}

export default function KhataDrawer({ entryId, onClose, onUpdate }: KhataDrawerProps) {
  const [entry, setEntry] = useState<KhataEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [settling, setSettling] = useState(false);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [settlementNotes, setSettlementNotes] = useState('');

  useEffect(() => {
    if (entryId) {
      loadEntry();
    }
  }, [entryId]);

  const loadEntry = async () => {
    if (!entryId) return;
    
    try {
      setLoading(true);
      const data = await api.getKhataEntry(entryId);
      setEntry(data);
    } catch (error) {
      console.error('Error loading khata entry:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSettle = async () => {
    if (!entryId) return;

    try {
      setSettling(true);
      await api.settleKhataEntry(entryId, settlementNotes);
      setShowSettleModal(false);
      setSettlementNotes('');
      onUpdate();
      onClose();
    } catch (error) {
      console.error('Error settling entry:', error);
      alert('Failed to settle entry');
    } finally {
      setSettling(false);
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

  const getPartyTypeLabel = (type: string) => {
    switch (type) {
      case 'OWNER':
        return 'Owner';
      case 'TENANT':
        return 'Tenant';
      case 'BUYER':
        return 'Buyer';
      case 'SELLER':
        return 'Seller';
      default:
        return type;
    }
  };

  if (!entryId) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 w-full sm:w-[600px] bg-gradient-to-br from-white/95 to-purple-50/95 backdrop-blur-xl shadow-2xl z-50 overflow-y-auto border-l border-white/20">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading...</p>
            </div>
          </div>
        ) : entry ? (
          <div className="h-full flex flex-col">
            {/* Header */}
            <div className="sticky top-0 bg-white/80 backdrop-blur-xl border-b border-white/20 px-6 py-4 z-10">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Khata Entry Details</h2>
                  <p className="text-sm text-gray-600">Entry ID: {entry.entryId.slice(0, 8)}</p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white/50 rounded-xl transition-colors"
                >
                  <X className="h-5 w-5 text-gray-600" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
              {/* Status Badge */}
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center px-4 py-2 rounded-xl text-sm font-medium shadow-md ${
                  entry.settlementStatus === 'SETTLED'
                    ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white'
                    : 'bg-gradient-to-r from-amber-500 to-orange-600 text-white'
                }`}>
                  {entry.settlementStatus === 'SETTLED' ? (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Settled
                    </>
                  ) : (
                    <>
                      <Clock className="h-4 w-4 mr-2" />
                      Pending
                    </>
                  )}
                </span>
                <span className={`inline-flex items-center px-4 py-2 rounded-xl text-sm font-medium shadow-md ${
                  entry.transactionType === 'TO_GIVE'
                    ? 'bg-gradient-to-r from-red-500 to-rose-600 text-white'
                    : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white'
                }`}>
                  {entry.transactionType === 'TO_GIVE' ? 'To Give' : 'To Take'}
                </span>
              </div>

              {/* Amount Card */}
              <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl p-6 text-white shadow-xl">
                <p className="text-sm opacity-90 mb-2">Total Amount</p>
                <div className="flex items-center gap-2">
                  <IndianRupee className="h-8 w-8" />
                  <p className="text-4xl font-bold">{formatCurrency(entry.amount).replace('₹', '')}</p>
                </div>
              </div>

              {/* Property Details */}
              {entry.property && (
                <div className="bg-white/60 backdrop-blur-sm rounded-2xl border border-white/20 p-4 shadow-lg">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                      <Building2 className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{entry.property.title}</p>
                      <p className="text-sm text-gray-600">{entry.property.area}</p>
                      {entry.property.flatNumber && (
                        <p className="text-sm text-gray-500">Flat: {entry.property.flatNumber}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Party Details */}
              <div className="bg-white/60 backdrop-blur-sm rounded-2xl border border-white/20 p-4 shadow-lg">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                    <User className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">{getPartyTypeLabel(entry.partyType)}</p>
                    <p className="font-semibold text-gray-900">{entry.partyName}</p>
                  </div>
                </div>
              </div>

              {/* Line Items */}
              <div className="bg-white/60 backdrop-blur-sm rounded-2xl border border-white/20 p-4 shadow-lg">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Items Breakdown</h3>
                <div className="space-y-2">
                  {entry.lineItems && entry.lineItems.length > 0 ? (
                    entry.lineItems.map((item, index) => (
                      <div key={index} className="flex justify-between items-center py-2 border-b border-gray-200 last:border-b-0">
                        <span className="text-sm text-gray-700">{item.categoryName}</span>
                        <span className="text-sm font-semibold text-gray-900">{formatCurrency(item.amount)}</span>
                      </div>
                    ))
                  ) : (
                    <div className="flex justify-between items-center py-2">
                      <span className="text-sm text-gray-700">{entry.categoryName}</span>
                      <span className="text-sm font-semibold text-gray-900">{formatCurrency(entry.amount)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Description */}
              {entry.description && (
                <div className="bg-white/60 backdrop-blur-sm rounded-2xl border border-white/20 p-4 shadow-lg">
                  <div className="flex items-start gap-3">
                    <FileText className="h-5 w-5 text-gray-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-gray-700 mb-1">Description</p>
                      <p className="text-sm text-gray-600">{entry.description}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Dates */}
              <div className="bg-white/60 backdrop-blur-sm rounded-2xl border border-white/20 p-4 shadow-lg">
                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-gray-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-2">
                    <div>
                      <p className="text-xs text-gray-500">Created</p>
                      <p className="text-sm font-medium text-gray-900">{formatDate(entry.createdAt)}</p>
                    </div>
                    {entry.settlementStatus === 'SETTLED' && entry.settledAt && (
                      <div>
                        <p className="text-xs text-gray-500">Settled</p>
                        <p className="text-sm font-medium text-gray-900">{formatDate(entry.settledAt)}</p>
                        {entry.settlementNotes && (
                          <p className="text-xs text-gray-600 mt-1">Notes: {entry.settlementNotes}</p>
                        )}
                      </div>
                    )}
                    {entry.reminderAt && (
                      <div>
                        <p className="text-xs text-gray-500">Reminder</p>
                        <p className="text-sm font-medium text-gray-900">{formatDate(entry.reminderAt)}</p>
                        {entry.reminderNote && (
                          <p className="text-xs text-gray-600 mt-1">{entry.reminderNote}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            {entry.settlementStatus === 'PENDING' && (
              <div className="sticky bottom-0 bg-white/80 backdrop-blur-xl border-t border-white/20 px-6 py-4">
                <button
                  onClick={() => setShowSettleModal(true)}
                  className="w-full px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all shadow-lg font-medium"
                >
                  Mark as Settled
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Settlement Modal */}
      {showSettleModal && (
        <>
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
            onClick={() => setShowSettleModal(false)}
          />
          <div className="fixed inset-0 flex items-center justify-center z-[70] p-4">
            <div className="bg-white/95 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl max-w-md w-full p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Settle Entry</h3>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Settlement Notes (Optional)
                </label>
                <textarea
                  value={settlementNotes}
                  onChange={(e) => setSettlementNotes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 bg-white/80 backdrop-blur-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-all"
                  placeholder="Add any notes about this settlement..."
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowSettleModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-xl text-gray-700 hover:bg-white/80 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSettle}
                  disabled={settling}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 transition-all shadow-lg"
                >
                  {settling ? 'Settling...' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
