import { useState, useEffect, FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  ArrowLeft,
  Save,
  Plus,
  X,
  Building2,
} from 'lucide-react';
import { api } from '../../services/api';
import type { KhataEntry, KhataCategory, KhataPartyType } from '../../types/khata';
import type { CRMProperty } from '../../types/crm';
import Toast from '../../components/Toast';
import NumericInput from '../../components/NumericInput';
import PartySearchSelector from '../../components/PartySearchSelector';

const PREDEFINED_CATEGORIES = [
  'Brokerage',
  'Maintenance',
  'Deep Cleaning',
  'Repair',
  'Security Deposit',
  'Rent',
  'Utility Bills',
  'Other',
];

export default function KhataEntryForm() {
  const navigate = useNavigate();
  const { entryId } = useParams();
  const isEditing = !!entryId;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [properties, setProperties] = useState<CRMProperty[]>([]);
  const [loadingProperties, setLoadingProperties] = useState(false);
  const [categories, setCategories] = useState<KhataCategory[]>([]);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [selectedParty, setSelectedParty] = useState<{ id: string; name: string; phone: string } | null>(null);

  const [lineItems, setLineItems] = useState<Array<{ categoryId: string; amount: number }>>([
    { categoryId: '', amount: 0 },
  ]);

  const [formData, setFormData] = useState({
    propertyId: '',
    partyType: 'OWNER' as KhataPartyType,
    partyId: '',
    transactionType: 'TO_TAKE' as 'TO_GIVE' | 'TO_TAKE',
    description: '',
    reminderAt: '',
    reminderNote: '',
  });

  useEffect(() => {
    loadData();
  }, [entryId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const categoriesData = await api.getKhataCategories();
      
      // Combine predefined and custom categories
      const allCategories = [
        ...PREDEFINED_CATEGORIES.map((name, idx) => ({
          categoryId: `predefined-${idx}`,
          tenantId: 'default',
          name,
          isDefault: true,
          createdAt: '',
          updatedAt: '',
        })),
        ...categoriesData,
      ];
      setCategories(allCategories);

      // Load existing entry if editing
      if (isEditing && entryId) {
        const entry: KhataEntry = await api.getKhataEntry(entryId);
        setFormData({
          propertyId: entry.propertyId,
          partyType: entry.partyType,
          partyId: entry.partyId,
          transactionType: entry.transactionType,
          description: entry.description || '',
          reminderAt: entry.reminderAt || '',
          reminderNote: entry.reminderNote || '',
        });
        setSelectedParty({
          id: entry.partyId,
          name: entry.partyName,
          phone: '',
        });
        // Load properties for this party
        if (entry.partyId && entry.partyType) {
          loadPartyProperties(entry.partyType, entry.partyId);
        }

        if (Array.isArray(entry.lineItems) && entry.lineItems.length > 0) {
          setLineItems(entry.lineItems.map((li) => ({
            categoryId: li.categoryId,
            amount: Number(li.amount) || 0,
          })));
        } else {
          setLineItems([
            {
              categoryId: entry.categoryId,
              amount: Number(entry.amount) || 0,
            },
          ]);
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
      setToast({ message: 'Failed to load data', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const loadPartyProperties = async (partyType: KhataPartyType, partyId: string) => {
    try {
      setLoadingProperties(true);
      const props = await api.getKhataPartyProperties(partyType, partyId);
      setProperties(props);
    } catch (error) {
      console.error('Error loading properties:', error);
      setToast({ message: 'Failed to load properties', type: 'error' });
    } finally {
      setLoadingProperties(false);
    }
  };

  const handlePartySelect = (party: { id: string; name: string; phone: string; type: KhataPartyType }) => {
    setSelectedParty({ id: party.id, name: party.name, phone: party.phone });
    setFormData({ ...formData, partyId: party.id, partyType: party.type, propertyId: '' });
    if (party.id) {
      loadPartyProperties(party.type, party.id);
    } else {
      setProperties([]);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      setToast({ message: 'Category name is required', type: 'error' });
      return;
    }

    try {
      const newCategory = await api.createKhataCategory(newCategoryName.trim());
      setCategories([...categories, newCategory]);
      setLineItems((prev) => {
        const next = [...prev];
        const idx = next.findIndex((li) => !li.categoryId);
        if (idx >= 0) {
          next[idx] = { ...next[idx], categoryId: newCategory.categoryId };
          return next;
        }
        return [...next, { categoryId: newCategory.categoryId, amount: 0 }];
      });
      setNewCategoryName('');
      setShowAddCategory(false);
      setToast({ message: 'Category added successfully', type: 'success' });
    } catch (error) {
      console.error('Error adding category:', error);
      setToast({ message: 'Failed to add category', type: 'error' });
    }
  };

  const totalAmount = lineItems.reduce((sum, li) => sum + (Number(li.amount) || 0), 0);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const validLineItems = lineItems
      .filter((li) => li.categoryId && Number(li.amount) > 0)
      .map((li) => {
        const category = categories.find((c) => c.categoryId === li.categoryId);
        return {
          categoryId: li.categoryId,
          categoryName: category?.name || '',
          amount: Number(li.amount),
        };
      });

    if (!formData.propertyId || !formData.partyId || validLineItems.length === 0 || totalAmount <= 0) {
      setToast({ message: 'Please fill all required fields', type: 'error' });
      return;
    }

    try {
      setSaving(true);

      // Get party name from selectedParty
      if (!selectedParty || !selectedParty.name) {
        throw new Error('Party not selected');
      }

      const partyName = selectedParty.name;
      const requestData = {
        ...formData,
        partyName,
        lineItems: validLineItems,
        amount: totalAmount,
        categoryId: validLineItems[0]?.categoryId,
        categoryName: validLineItems[0]?.categoryName,
        reminderAt: formData.reminderAt || undefined,
        reminderNote: formData.reminderNote || undefined,
      };

      if (isEditing && entryId) {
        await api.updateKhataEntry(entryId, requestData);
        setToast({ message: 'Entry updated successfully', type: 'success' });
      } else {
        await api.createKhataEntry(requestData);
        setToast({ message: 'Entry created successfully', type: 'success' });
      }

      setTimeout(() => {
        navigate('/crm/khata');
      }, 1500);
    } catch (error) {
      console.error('Error saving entry:', error);
      setToast({ message: 'Failed to save entry', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const addLineItem = () => {
    setLineItems((prev) => [...prev, { categoryId: '', amount: 0 }]);
  };

  const removeLineItem = (index: number) => {
    setLineItems((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-indigo-50 flex items-center justify-center">
        <LoadingSpinner message="Loading..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-indigo-50">
      {/* Header */}
      <div className="bg-white/70 backdrop-blur-xl border-b border-white/20 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/crm/khata')}
              className="p-2 hover:bg-white/50 rounded-xl transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-slate-500" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {isEditing ? 'Edit Khata Entry' : 'Add Khata Entry'}
              </h1>
              <p className="text-sm text-gray-600">
                {isEditing ? 'Update transaction details' : 'Record a new transaction'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form onSubmit={handleSubmit} className="bg-white/60 backdrop-blur-xl rounded-2xl border border-white/20 shadow-xl p-6 space-y-6">
          {/* Party Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Party Type <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={formData.partyType}
              onChange={(e) => {
                const newType = e.target.value as KhataPartyType;
                setFormData({ ...formData, partyType: newType, partyId: '', propertyId: '' });
                setSelectedParty(null);
                setProperties([]);
              }}
              className="w-full px-4 py-3 bg-white/80 backdrop-blur-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-all"
            >
              <option value="OWNER">Owner</option>
              <option value="TENANT">Tenant</option>
              <option value="BUYER">Buyer</option>
              <option value="SELLER">Seller</option>
            </select>
          </div>

          {/* Party Search Selector */}
          <PartySearchSelector
            partyType={formData.partyType}
            selectedParty={selectedParty}
            onSelect={handlePartySelect}
            required
          />

          {/* Property Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Property <span className="text-red-500">*</span>
            </label>
            {loadingProperties ? (
              <div className="w-full px-4 py-3 bg-white/80 backdrop-blur-sm border border-gray-300 rounded-xl flex items-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600"></div>
                <span className="text-gray-600">Loading properties...</span>
              </div>
            ) : (
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <select
                  required
                  value={formData.propertyId}
                  onChange={(e) => setFormData({ ...formData, propertyId: e.target.value })}
                  disabled={!selectedParty || !selectedParty.id || properties.length === 0}
                  className="w-full pl-10 pr-4 py-3 bg-white/80 backdrop-blur-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">Select Property</option>
                  {properties.map((property) => (
                    <option key={property.propertyId} value={property.propertyId}>
                      {property.title} - {property.area} {property.flatNumber ? `(${property.flatNumber})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {selectedParty && selectedParty.id && properties.length === 0 && !loadingProperties && (
              <p className="mt-2 text-sm text-gray-500">No properties available for this party</p>
            )}
          </div>

          {/* Transaction Type */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Transaction Type <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.transactionType}
                onChange={(e) => setFormData({ ...formData, transactionType: e.target.value as any })}
                className="w-full px-4 py-3 bg-white/80 backdrop-blur-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-all"
              >
                <option value="TO_TAKE">To Take (Receive Money)</option>
                <option value="TO_GIVE">To Give (Pay Money)</option>
              </select>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-4 shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-purple-600 font-medium">Total Amount</p>
                  <p className="text-2xl font-bold text-purple-900">₹{Math.round(totalAmount).toLocaleString('en-IN')}</p>
                </div>
                <div className="text-xs text-purple-700">Auto calculated</div>
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Items <span className="text-red-500">*</span>
            </label>

            <div className="space-y-3">
              {lineItems.map((li, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                  <div className="md:col-span-7">
                    <label className="block text-xs text-gray-600 mb-1">Category</label>
                    <select
                      required
                      value={li.categoryId}
                      onChange={(e) =>
                        setLineItems((prev) =>
                          prev.map((row, i) => (i === index ? { ...row, categoryId: e.target.value } : row))
                        )
                      }
                      className="w-full px-4 py-2 bg-white/80 backdrop-blur-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-all"
                    >
                      <option value="">Select Category</option>
                      {categories.map((category) => (
                        <option key={category.categoryId} value={category.categoryId}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-4">
                    <label className="block text-xs text-gray-600 mb-1">Amount (₹)</label>
                    <NumericInput
                      required
                      min={0}
                      value={li.amount}
                      onChange={(val) =>
                        setLineItems((prev) =>
                          prev.map((row, i) => (i === index ? { ...row, amount: val || 0 } : row))
                        )
                      }
                      className="w-full px-4 py-2 bg-white/80 backdrop-blur-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-all"
                      placeholder="Enter amount"
                    />
                  </div>

                  <div className="md:col-span-1 flex md:justify-end">
                    <button
                      type="button"
                      onClick={() => removeLineItem(index)}
                      disabled={lineItems.length <= 1}
                      className="p-2 border border-gray-300 rounded-xl text-gray-600 hover:bg-red-50 hover:text-red-600 hover:border-red-300 disabled:opacity-50 transition-colors"
                      title="Remove"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={addLineItem}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl hover:from-purple-600 hover:to-indigo-700 transition-all shadow-md"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Item</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowAddCategory(true)}
                  className="flex items-center gap-2 px-4 py-2 border border-purple-300 text-purple-700 rounded-xl hover:bg-purple-50 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Category</span>
                </button>
              </div>
            </div>

            {showAddCategory && (
              <div className="mt-4 bg-white/80 backdrop-blur-sm border border-purple-200 rounded-xl p-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">New Category</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Enter category name"
                    className="flex-1 px-4 py-2 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-all"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleAddCategory}
                    className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all shadow-md"
                    title="Save"
                   aria-label="Save">
                    <Save className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddCategory(false);
                      setNewCategoryName('');
                    }}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors"
                    title="Cancel"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description <span className="text-gray-400 text-xs">(Optional)</span>
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 bg-white/80 backdrop-blur-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-all"
              placeholder="Add any notes or details about this transaction..."
            />
          </div>

          {/* Reminder Section */}
          <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-4 shadow-md">
            <h3 className="text-sm font-semibold text-purple-800 mb-3">
              🔔 Payment Reminder <span className="text-purple-500 text-xs font-normal">(Optional)</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Remind me on
                </label>
                <input
                  type="datetime-local"
                  value={formData.reminderAt ? formData.reminderAt.slice(0, 16) : ''}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    reminderAt: e.target.value ? new Date(e.target.value).toISOString() : '' 
                  })}
                  min={new Date().toISOString().slice(0, 16)}
                  className="w-full px-4 py-2 bg-white/80 backdrop-blur-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reminder Note
                </label>
                <input
                  type="text"
                  value={formData.reminderNote}
                  onChange={(e) => setFormData({ ...formData, reminderNote: e.target.value })}
                  placeholder="e.g., Call owner for payment"
                  className="w-full px-4 py-2 bg-white/80 backdrop-blur-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-all"
                />
              </div>
            </div>
            {formData.reminderAt && (
              <div className="mt-3 flex items-center justify-between">
                <p className="text-xs text-purple-600">
                  You'll be notified on {new Date(formData.reminderAt).toLocaleString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, reminderAt: '', reminderNote: '' })}
                  className="text-xs text-red-600 hover:text-red-700 font-medium"
                >
                  Clear Reminder
                </button>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-purple-100">
            <button
              type="button"
              onClick={() => navigate('/crm/khata')}
              className="px-6 py-2 border border-gray-300 rounded-xl text-gray-700 hover:bg-white/80 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl hover:from-purple-600 hover:to-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-purple-500/30"
            >
              <Save className="h-4 w-4" />
              <span>{saving ? 'Saving...' : isEditing ? 'Update Entry' : 'Create Entry'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
