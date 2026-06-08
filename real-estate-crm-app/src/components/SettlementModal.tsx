import { useState } from 'react';
import { X, CheckCircle, CreditCard } from 'lucide-react';

interface SettlementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: SettlementData) => void;
  entryAmount: number;
  entryId: string;
  partyName: string;
}

export interface SettlementData {
  amount: number;
  paymentMode: 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE';
  referenceId?: string;
  settlementDate: string;
  notes?: string;
}

export default function SettlementModal({
  isOpen,
  onClose,
  onConfirm,
  entryAmount,
  entryId,
  partyName,
}: SettlementModalProps) {
  const [formData, setFormData] = useState<SettlementData>({
    amount: entryAmount,
    paymentMode: 'CASH',
    settlementDate: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onConfirm(formData);
      onClose();
    } catch (error) {
      console.error('Settlement failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />
        
        {/* Modal */}
        <div className="relative w-full max-w-md transform rounded-2xl bg-white p-6 shadow-2xl transition-all">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Settle Payment</h3>
                <p className="text-sm text-gray-600">{partyName}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Settlement Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Settlement Amount
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">₹</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                  className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500/30 focus:border-green-400 transition-all"
                  required
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Original amount: {formatCurrency(entryAmount)}
              </p>
            </div>

            {/* Payment Mode */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payment Mode
              </label>
              <select
                value={formData.paymentMode}
                onChange={(e) => setFormData({ ...formData, paymentMode: e.target.value as any })}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500/30 focus:border-green-400 transition-all"
                required
              >
                <option value="CASH">Cash</option>
                <option value="UPI">UPI</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="CHEQUE">Cheque</option>
              </select>
            </div>

            {/* Reference ID */}
            {formData.paymentMode !== 'CASH' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {formData.paymentMode === 'UPI' ? 'Transaction ID' : 
                   formData.paymentMode === 'BANK_TRANSFER' ? 'Reference Number' : 
                   'Cheque Number'}
                </label>
                <input
                  type="text"
                  value={formData.referenceId || ''}
                  onChange={(e) => setFormData({ ...formData, referenceId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500/30 focus:border-green-400 transition-all"
                  placeholder={`Enter ${formData.paymentMode === 'UPI' ? 'transaction ID' : 
                                     formData.paymentMode === 'BANK_TRANSFER' ? 'reference number' : 
                                     'cheque number'}`}
                />
              </div>
            )}

            {/* Settlement Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Settlement Date
              </label>
              <input
                type="date"
                value={formData.settlementDate}
                onChange={(e) => setFormData({ ...formData, settlementDate: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500/30 focus:border-green-400 transition-all"
                required
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes (Optional)
              </label>
              <textarea
                value={formData.notes || ''}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500/30 focus:border-green-400 transition-all resize-none"
                placeholder="Add any settlement notes..."
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Settling...' : 'Settle Payment'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
