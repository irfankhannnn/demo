import { useState } from 'react';
import { FileText, Edit, Save, X, Download } from 'lucide-react';
import { api } from '../../services/api';
import type { FlatDetails } from '../../types/admin';

interface AgreementTabProps {
  flat: FlatDetails;
  onUpdate: () => void;
}

export default function AgreementTab({ flat, onUpdate }: AgreementTabProps) {
  const [editing, setEditing] = useState(false);
  const agreement = flat.agreements?.[0];
  const [form, setForm] = useState({
    startDate: agreement?.startDate || '',
    endDate: agreement?.endDate || '',
    rentAmount: agreement?.rentAmount || 0,
    depositAmount: agreement?.depositAmount || 0,
    documentFile: null as File | null,
  });

  const handleSave = async () => {
    try {
      await api.createAgreement(flat.flatId, {
        startDate: form.startDate,
        endDate: form.endDate,
        rentAmount: form.rentAmount,
        depositAmount: form.depositAmount,
      }, form.documentFile || undefined);
      setEditing(false);
      onUpdate();
      alert('Agreement saved successfully');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to save agreement');
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Agreement Details</h2>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Edit className="w-4 h-4" />
            {agreement ? 'Edit' : 'Add Agreement'}
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date *</label>
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rent Amount (₹) *</label>
              <input
                type="number"
                value={form.rentAmount}
                onChange={(e) => setForm({ ...form, rentAmount: parseFloat(e.target.value) || 0 })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Deposit Amount (₹) *</label>
              <input
                type="number"
                value={form.depositAmount}
                onChange={(e) => setForm({ ...form, depositAmount: parseFloat(e.target.value) || 0 })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Agreement Document</label>
            <input
              type="file"
              accept=".pdf"
              onChange={(e) => setForm({ ...form, documentFile: e.target.files?.[0] || null })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">Upload PDF document</p>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Save className="w-4 h-4" />
              Save
            </button>
            <button
              onClick={() => setEditing(false)}
              className="flex items-center gap-2 px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          </div>
        </div>
      ) : agreement ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Start Date</p>
              <p className="font-medium">{(() => {
                const date = new Date(agreement.startDate);
                const day = date.getDate().toString().padStart(2, '0');
                const month = (date.getMonth() + 1).toString().padStart(2, '0');
                const year = date.getFullYear();
                return `${day}/${month}/${year}`;
              })()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">End Date</p>
              <p className="font-medium">{(() => {
                const date = new Date(agreement.endDate);
                const day = date.getDate().toString().padStart(2, '0');
                const month = (date.getMonth() + 1).toString().padStart(2, '0');
                const year = date.getFullYear();
                return `${day}/${month}/${year}`;
              })()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Rent Amount</p>
              <p className="font-medium text-green-600">₹{agreement.rentAmount.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Deposit Amount</p>
              <p className="font-medium text-blue-600">₹{agreement.depositAmount.toLocaleString()}</p>
            </div>
          </div>

          {agreement.documentUrl && (
            <div className="mt-6">
              <p className="text-sm text-gray-600 mb-2">Agreement Document</p>
              <a
                href={agreement.documentUrl}
                download
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"
              >
                <Download className="w-4 h-4" />
                Download Agreement
              </a>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p>No agreement added yet</p>
        </div>
      )}
    </div>
  );
}
