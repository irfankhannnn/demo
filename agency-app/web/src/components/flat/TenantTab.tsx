import { useState, useEffect } from 'react';
import { Users, Edit, Save, X, Download } from 'lucide-react';
import { api } from '../../services/api';
import type { FlatDetails } from '../../types/admin';

interface TenantTabProps {
  flat: FlatDetails;
  onUpdate: () => void;
}

export default function TenantTab({ flat, onUpdate }: TenantTabProps) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: flat.tenant?.name || '',
    email: flat.tenant?.email || '',
    phone: flat.tenant?.phone || '',
    address: flat.tenant?.address || '',
    photoFile: null as File | null,
    panFile: null as File | null,
    aadharFile: null as File | null,
  });

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLabel, setPreviewLabel] = useState<string | null>(null);

  // Close preview on Escape key
  useEffect(() => {
    if (!previewUrl) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPreviewUrl(null);
        setPreviewLabel(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewUrl]);

  const openPreview = (url: string, label: string) => {
    setPreviewUrl(url);
    setPreviewLabel(label);
  };

  const handleSave = async () => {
    try {
      await api.saveTenant(flat.flatId, {
        name: form.name,
        email: form.email,
        phone: form.phone,
        address: form.address,
      }, {
        photo: form.photoFile || undefined,
        pan: form.panFile || undefined,
        aadhar: form.aadharFile || undefined,
      });
      setEditing(false);
      onUpdate();
      alert('Tenant saved successfully');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to save tenant');
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Tenant Information</h2>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Edit className="w-4 h-4" />
            {flat.tenant ? 'Edit' : 'Add Tenant'}
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Photo</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setForm({ ...form, photoFile: e.target.files?.[0] || null })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">PAN Card</label>
              <input
                type="file"
                accept=".pdf,image/*"
                onChange={(e) => setForm({ ...form, panFile: e.target.files?.[0] || null })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Aadhar Card</label>
              <input
                type="file"
                accept=".pdf,image/*"
                onChange={(e) => setForm({ ...form, aadharFile: e.target.files?.[0] || null })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
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
      ) : flat.tenant ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Name</p>
              <p className="font-medium">{flat.tenant.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Email</p>
              <p className="font-medium">{flat.tenant.email}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Phone</p>
              <p className="font-medium">{flat.tenant.phone}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Address</p>
              <p className="font-medium">{flat.tenant.address || 'N/A'}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            {flat.tenant.photoUrl && (
              <div>
                <p className="text-sm text-gray-600 mb-2">Photo</p>
                <img
                  src={flat.tenant.photoUrl}
                  alt="Tenant"
                  className="w-32 h-32 object-cover rounded-lg border cursor-pointer"
                  onClick={() => openPreview(flat.tenant!.photoUrl!, 'Tenant photo')}
                />
                <div className="flex items-center gap-3 mt-2">
                  <button
                    type="button"
                    className="text-sm text-blue-600 hover:text-blue-700 underline"
                    onClick={() => openPreview(flat.tenant!.photoUrl!, 'Tenant photo')}
                  >
                    View
                  </button>
                  <a
                    href={flat.tenant.photoUrl}
                    download
                    className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </a>
                </div>
              </div>
            )}
            {flat.tenant.panUrl && (
              <div>
                <p className="text-sm text-gray-600 mb-2">PAN Card</p>
                <div className="flex items-center gap-3 mt-2">
                  <button
                    type="button"
                    className="text-sm text-blue-600 hover:text-blue-700 underline"
                    onClick={() => openPreview(flat.tenant!.panUrl!, 'Tenant PAN')}
                  >
                    View PAN
                  </button>
                  <a
                    href={flat.tenant.panUrl}
                    download
                    className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"
                  >
                    <Download className="w-4 h-4" />
                    Download PAN
                  </a>
                </div>
              </div>
            )}
            {flat.tenant.aadharUrl && (
              <div>
                <p className="text-sm text-gray-600 mb-2">Aadhar Card</p>
                <div className="flex items-center gap-3 mt-2">
                  <button
                    type="button"
                    className="text-sm text-blue-600 hover:text-blue-700 underline"
                    onClick={() => openPreview(flat.tenant!.aadharUrl!, 'Tenant Aadhar')}
                  >
                    View Aadhar
                  </button>
                  <a
                    href={flat.tenant.aadharUrl}
                    download
                    className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"
                  >
                    <Download className="w-4 h-4" />
                    Download Aadhar
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p>No tenant information added yet</p>
        </div>
      )}

      {previewUrl && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => {
            setPreviewUrl(null);
            setPreviewLabel(null);
          }}
        >
          <div className="relative max-w-4xl max-h-full">
            <button
              type="button"
              onClick={() => {
                setPreviewUrl(null);
                setPreviewLabel(null);
              }}
              className="absolute top-4 right-4 p-2 bg-white rounded-full hover:bg-gray-100"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={previewUrl}
              alt={previewLabel || 'Preview'}
              className="max-w-full max-h-[90vh] rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            {previewLabel && (
              <p className="mt-2 text-center text-sm text-white">{previewLabel}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
