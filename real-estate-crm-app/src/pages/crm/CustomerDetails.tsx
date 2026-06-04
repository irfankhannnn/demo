import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  MessageSquare,
  Calendar,
  User,
  AlertCircle,
  Upload,
} from 'lucide-react';
import { api } from '../../services/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import Toast from '../../components/Toast';
import { CRMCustomerNote } from '../../types/crm';
import { isValidEmail, isValidIndianMobile, isValidName, normalizeEmail, normalizeIndianPhone, normalizeName } from '../../utils/validation';
import DocumentUploadSection from '../../components/DocumentUploadSection';

type CustomerStatus = 'active' | 'inactive' | 'closed';
type CustomerPriority = 'low' | 'medium' | 'high';

export default function CustomerDetails() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' = 'error') => {
    setToast({ message, type });
  };
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState<CRMCustomerNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [customer, setCustomer] = useState<any>(null);
  const [formData, setFormData] = useState<{
    name: string;
    phone: string;
    email: string;
    requirement: string;
    budget: number;
    preferredArea: string;
    status: CustomerStatus;
    priority: CustomerPriority;
  }>({
    name: '',
    phone: '',
    email: '',
    requirement: '',
    budget: 0,
    preferredArea: '',
    status: 'active',
    priority: 'medium',
  });

  useEffect(() => {
    if (isEditing && id) {
      loadCustomer();
      loadNotes();
    }
  }, [id, isEditing]);

  const loadCustomer = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const customer = await api.getCustomerWithDocuments(id);
      setCustomer(customer);
      setFormData({
        name: customer.name,
        phone: customer.phone,
        email: customer.email || '',
        requirement: customer.requirement || '',
        budget: customer.budget || 0,
        preferredArea: customer.preferredArea || '',
        status: customer.status,
        priority: customer.priority,
      });
    } catch (error) {
      console.error('Error loading customer:', error);
      if (error instanceof Error && error.message.includes('token')) {
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneBlur = () => {
    const normalized = normalizeIndianPhone(formData.phone);
    if (normalized) {
      setFormData((prev) => ({ ...prev, phone: normalized }));
    }
  };

  const loadNotes = async () => {
    if (!id) return;
    try {
      const data = await api.getCustomerNotes(id);
      setNotes(data);
    } catch (error) {
      console.error('Error loading notes:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanedName = normalizeName(formData.name);
    const cleanedPhone = normalizeIndianPhone(formData.phone);
    const cleanedEmail = formData.email ? normalizeEmail(formData.email) : '';

    if (!isValidName(cleanedName)) {
      showToast('Please enter a valid full name.', 'error');
      return;
    }

    if (!isValidIndianMobile(formData.phone)) {
      showToast('Please enter a valid Indian mobile number (10 digits).', 'error');
      return;
    }

    if (cleanedEmail && !isValidEmail(cleanedEmail)) {
      showToast('Please enter a valid email address.', 'error');
      return;
    }

    try {
      setSaving(true);
      if (isEditing && id) {
        await api.updateCustomer(id, {
          ...formData,
          name: cleanedName,
          phone: cleanedPhone || formData.phone,
          email: cleanedEmail,
        });
      } else {
        await api.createCustomer({
          ...formData,
          name: cleanedName,
          phone: cleanedPhone || formData.phone,
          email: cleanedEmail,
        });
      }
      navigate('/crm/customers');
    } catch (error) {
      console.error('Error saving customer:', error);
      showToast('Failed to save customer', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim() || !id) return;

    try {
      await api.createCustomerNote(id, {
        content: newNote,
        createdBy: 'Admin',
      });
      setNewNote('');
      await loadNotes();
    } catch (error) {
      console.error('Error adding note:', error);
      showToast('Failed to add note', 'error');
    }
  };

  const handleDocumentUpload = async (docType: string, file: File) => {
    if (!id) return;
    setUploadingDoc(docType);
    try {
      const files: { photo?: File; pan?: File; aadhar?: File } = {};

      if (docType === 'photo') {
        files.photo = file;
      } else if (docType === 'pan') {
        files.pan = file;
      } else if (docType === 'aadhar') {
        files.aadhar = file;
      }

      await api.uploadCustomerDocuments(id, files);

      // Reload customer data to get updated document URLs
      await loadCustomer();

      showToast(`${docType.charAt(0).toUpperCase() + docType.slice(1)} uploaded successfully`, 'success');
    } catch (error) {
      console.error('Error uploading document:', error);
      showToast('Failed to upload document. Please try again.', 'error');
    } finally {
      setUploadingDoc(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50 to-emerald-50 flex items-center justify-center">
        <LoadingSpinner message="Loading customer..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50 to-emerald-50">
      {/* Header */}
      <header className="glass-premium border-b border-white/30 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <button
                onClick={() => navigate('/crm/customers')}
                className="p-1.5 sm:p-2 hover:bg-white/60 rounded-xl transition-all duration-200 flex-shrink-0"
              >
                <ArrowLeft className="h-5 w-5 text-slate-500" />
              </button>
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-teal-500/30 flex-shrink-0">
                  <User className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 truncate">
                    {isEditing ? 'Edit Customer' : 'New Customer'}
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-400 font-semibold">
                    {isEditing ? 'Update customer information' : 'Add a new customer to CRM'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
          {/* Customer Form */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit} className="glass-premium rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Customer Information</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 transition-all"
                    placeholder="John Doe"
                    autoComplete="name"
                    maxLength={80}
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="+91 98765 43210"
                    onBlur={handlePhoneBlur}
                    inputMode="tel"
                    autoComplete="tel"
                    maxLength={16}
                    pattern="^(?:\\+?91[ -]?)?[6-9][0-9]{9}$"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="john@example.com"
                    autoComplete="email"
                    inputMode="email"
                    maxLength={254}
                  />
                </div>

                {/* Preferred Area */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Preferred Area
                  </label>
                  <input
                    type="text"
                    value={formData.preferredArea}
                    onChange={(e) => setFormData({ ...formData, preferredArea: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Andheri, Bandra, etc."
                  />
                </div>

                {/* Budget */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Budget (₹/month)
                  </label>
                  <input
                    type="number"
                    value={formData.budget}
                    onChange={(e) =>
                      setFormData({ ...formData, budget: Number(e.target.value) })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="25000"
                    min="0"
                  />
                </div>

                {/* Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        status: e.target.value as 'active' | 'inactive' | 'closed',
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Priority
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        priority: e.target.value as 'low' | 'medium' | 'high',
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>

              {/* Requirement */}
              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Requirement Details
                </label>
                <textarea
                  value={formData.requirement}
                  onChange={(e) => setFormData({ ...formData, requirement: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="2 BHK apartment, near metro station, parking required..."
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-4 mt-6">
                <button
                  type="button"
                  onClick={() => navigate('/crm/customers')}
                  className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  <Save className="h-5 w-5" />
                  <span>{saving ? 'Saving...' : 'Save Customer'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Documents Section */}
            {isEditing && id && (
              <DocumentUploadSection
                entityId={id}
                entityType="customer"
                documents={{
                  photoUrl: customer?.photoUrl,
                  panDocUrl: customer?.panDocUrl,
                  aadharDocUrl: customer?.aadharDocUrl,
                }}
                onUpload={handleDocumentUpload}
                uploadingDoc={uploadingDoc}
                isNew={false}
              />
            )}

            {/* Notes Section */}
            {isEditing && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <MessageSquare className="h-5 w-5 mr-2 text-blue-600" />
                  Discussion Notes
                </h2>

                {/* Add Note Form */}
                <form onSubmit={handleAddNote} className="mb-6">
                  <textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-2"
                    placeholder="Add a note about this customer..."
                  />
                  <button
                    type="submit"
                    disabled={!newNote.trim()}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    Add Note
                  </button>
                </form>

                {/* Notes Timeline */}
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {notes.length === 0 ? (
                    <div className="text-center py-8">
                      <AlertCircle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">No notes yet</p>
                    </div>
                  ) : (
                    notes.map((note) => (
                      <div key={note.noteId} className="border-l-2 border-blue-500 pl-4 pb-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center text-sm text-gray-600">
                            <User className="h-4 w-4 mr-1" />
                            {note.createdBy}
                          </div>
                          <div className="flex items-center text-xs text-gray-500">
                            <Calendar className="h-3 w-3 mr-1" />
                            {(() => {
                              const date = new Date(note.createdAt);
                              const day = date.getDate().toString().padStart(2, '0');
                              const month = (date.getMonth() + 1).toString().padStart(2, '0');
                              const year = date.getFullYear();
                              return `${day}/${month}/${year}`;
                            })()}
                          </div>
                        </div>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{note.content}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
          )}
          </div>
        </div>
      </main>
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
