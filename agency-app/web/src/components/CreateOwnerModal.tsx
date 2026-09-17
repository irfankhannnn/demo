import { useEffect, useState, FormEvent } from 'react';
import { X, Save, User } from 'lucide-react';
import { api } from '../services/api';
import { isValidEmail, isValidIndianMobile, isValidName, normalizeEmail, normalizeIndianPhone, normalizeName } from '../utils/validation';

interface CreateOwnerModalProps {
  onClose: () => void;
  onOwnerCreated: (ownerId: string, ownerName: string) => void;
}

export default function CreateOwnerModal({ onClose, onOwnerCreated }: CreateOwnerModalProps) {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    status: 'active' as const,
  });

  const handlePhoneBlur = () => {
    const normalized = normalizeIndianPhone(formData.phone);
    if (normalized) {
      setFormData((prev) => ({ ...prev, phone: normalized }));
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const cleanedName = normalizeName(formData.name);
    const cleanedPhone = normalizeIndianPhone(formData.phone);
    const cleanedEmail = formData.email ? normalizeEmail(formData.email) : '';

    if (!isValidName(cleanedName)) {
      alert('Please enter a valid full name.');
      return;
    }

    if (!isValidIndianMobile(formData.phone)) {
      alert('Please enter a valid Indian mobile number (10 digits).');
      return;
    }

    if (cleanedEmail && !isValidEmail(cleanedEmail)) {
      alert('Please enter a valid email address.');
      return;
    }
    
    try {
      setSaving(true);
      const newOwner = await api.createOwner({
        ...formData,
        name: cleanedName,
        phone: cleanedPhone || formData.phone,
        email: cleanedEmail,
      });
      onOwnerCreated(newOwner.ownerId, newOwner.name);
      onClose();
    } catch (error) {
      console.error('Error creating owner:', error);
      alert('Failed to create owner. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <User className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Add New Owner</h2>
              <p className="text-sm text-gray-500">Create a property owner quickly</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Owner Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="Enter owner's full name"
              autoComplete="name"
              maxLength={80}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Phone Number <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              required
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              onBlur={handlePhoneBlur}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="+91 98765 43210"
              inputMode="tel"
              autoComplete="tel"
              maxLength={16}
              pattern="^(?:\\+?91[ -]?)?[6-9][0-9]{9}$"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email <span className="text-gray-400 text-xs">(Optional)</span>
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="owner@example.com"
              autoComplete="email"
              inputMode="email"
              maxLength={254}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              <Save className="h-4 w-4" />
              <span>{saving ? 'Creating...' : 'Create Owner'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
