import { useState } from 'react';
import { Shield, Edit, Save, X, Download, CheckCircle, XCircle, Clock } from 'lucide-react';
import { api } from '../../services/api';
import type { FlatDetails } from '../../types/admin';

interface VerificationTabProps {
  flat: FlatDetails;
  onUpdate: () => void;
}

export default function VerificationTab({ flat, onUpdate }: VerificationTabProps) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    status: flat.verifications?.[0]?.status || 'pending' as 'done' | 'pending' | 'not_done',
    verificationDate: flat.verifications?.[0]?.verificationDate || '',
    documentFile: null as File | null,
  });

  const handleSave = async () => {
    try {
      await api.createVerification(flat.flatId, {
        status: form.status,
        verificationDate: form.verificationDate,
      }, form.documentFile || undefined);
      setEditing(false);
      onUpdate();
      alert('Verification saved successfully');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to save verification');
    }
  };

  const verification = flat.verifications?.[0];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'done':
        return <CheckCircle className="w-6 h-6 text-green-600" />;
      case 'not_done':
        return <XCircle className="w-6 h-6 text-red-600" />;
      default:
        return <Clock className="w-6 h-6 text-yellow-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'done':
        return 'bg-green-100 text-green-800';
      case 'not_done':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Police Verification</h2>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Edit className="w-4 h-4" />
            {verification ? 'Update' : 'Add Verification'}
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status *</label>
              <select
                value={form.status}
                onChange={(e) =>
                  setForm({
                    ...form,
                    status: e.target.value as 'done' | 'pending' | 'not_done',
                  })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="pending">Pending</option>
                <option value="done">Done</option>
                <option value="not_done">Not Done</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Verification Date</label>
              <input
                type="date"
                value={form.verificationDate}
                onChange={(e) => setForm({ ...form, verificationDate: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Verification Document</label>
            <input
              type="file"
              accept=".pdf,image/*"
              onChange={(e) => setForm({ ...form, documentFile: e.target.files?.[0] || null })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">Upload PDF or image</p>
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
      ) : verification ? (
        <div className="space-y-4">
          <div className="flex items-center gap-4 mb-6">
            {getStatusIcon(verification.status)}
            <div>
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(verification.status)}`}>
                {verification.status.replace('_', ' ').toUpperCase()}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Status</p>
              <p className="font-medium capitalize">{verification.status.replace('_', ' ')}</p>
            </div>
            {verification.verificationDate && (
              <div>
                <p className="text-sm text-gray-600">Verification Date</p>
                <p className="font-medium">{(() => {
                  const date = new Date(verification.verificationDate);
                  const day = date.getDate().toString().padStart(2, '0');
                  const month = (date.getMonth() + 1).toString().padStart(2, '0');
                  const year = date.getFullYear();
                  return `${day}/${month}/${year}`;
                })()}</p>
              </div>
            )}
          </div>

          {verification.documentUrl && (
            <div className="mt-6">
              <p className="text-sm text-gray-600 mb-2">Verification Document</p>
              <a
                href={verification.documentUrl}
                download
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"
              >
                <Download className="w-4 h-4" />
                Download Document
              </a>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          <Shield className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p>No verification record added yet</p>
        </div>
      )}
    </div>
  );
}
