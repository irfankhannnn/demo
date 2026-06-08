import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ShoppingCart,
  ArrowLeft,
  Save,
  Phone,
  Mail,
  MapPin,
  User,
  IndianRupee,
  Building2,
  Tag,
  Key,
  AlertCircle,
  Plus,
} from 'lucide-react';
import { api } from '../../services/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import SpeechToTextButton from '../../components/SpeechToTextButton';
import { CRMContact, CRMContactNote } from '../../types/crm';

export default function BuyerDetails() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === 'new';

  const [contact, setContact] = useState<Partial<CRMContact>>({
    name: '',
    phone: '',
    email: '',
    address: '',
    roles: { owner: false, buyer: true, tenant: false },
    status: 'active',
  });
  const [notes, setNotes] = useState<CRMContactNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [draftActivityNote, setDraftActivityNote] = useState('');
  const [properties, setProperties] = useState<any[]>([]);

  useEffect(() => {
    if (isNew) {
      setLoading(false);
      return;
    }
    
    if (id) {
      loadContact();
      loadAssociatedProperties();
    }
  }, [id, isNew]);

  const loadContact = async () => {
    try {
      setLoading(true);
      const [contactData, notesData] = await Promise.all([
        api.getContactWithDocuments(id!),
        api.getContactNotes(id!),
      ]);
      
      if (!contactData.roles?.buyer) {
        contactData.roles = { ...contactData.roles, buyer: true };
      }
      
      setContact(contactData);
      setNotes(notesData);
    } catch (error) {
      console.error('Error loading contact:', error);
      if (error instanceof Error && error.message.includes('token')) {
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadAssociatedProperties = async () => {
    try {
      const allProperties = await api.getCRMProperties();
      // Filter properties that might be associated with this buyer
      const filtered = allProperties.filter((p: any) => 
        p.status === 'available' || p.status === 'on_hold'
      );
      setProperties(filtered);
    } catch (error) {
      console.error('Error loading properties:', error);
    }
  };

  const handleSave = async () => {
    if (!contact.name || !contact.phone) {
      alert('Name and phone are required');
      return;
    }

    try {
      setSaving(true);
      if (isNew) {
        const created = await api.createContact({
          name: contact.name,
          phone: contact.phone,
          email: contact.email,
          address: contact.address,
          roles: { ...contact.roles, buyer: true },
          status: contact.status as 'active' | 'inactive',
          source: contact.source,
          tags: contact.tags,
          notes: contact.notes,
        });
        if (draftActivityNote.trim()) {
          try {
            await api.createContactNote(created.contactId, { content: draftActivityNote });
          } catch (e) {
            console.error('Error adding initial buyer note:', e);
          }
        }
        navigate(`/crm/buyers/${created.contactId}`, { replace: true });
      } else {
        await api.updateContact(id!, {
          ...contact,
          roles: { ...contact.roles, buyer: true },
        });
        await loadContact();
      }
    } catch (error) {
      console.error('Error saving contact:', error);
      alert('Failed to save buyer');
    } finally {
      setSaving(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim() || !id) return;

    try {
      const note = await api.createContactNote(id, { content: newNote });
      setNotes([note, ...notes]);
      setNewNote('');
    } catch (error) {
      console.error('Error adding note:', error);
    }
  };

  const getOtherRoles = () => {
    const roles = [];
    if (contact.roles?.owner) roles.push({ name: 'Owner', icon: Building2, color: 'blue' });
    if (contact.roles?.tenant) roles.push({ name: 'Tenant', icon: Key, color: 'teal' });
    return roles;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50 to-amber-50 flex items-center justify-center">
        <LoadingSpinner message="Loading buyer..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50 to-amber-50">
      <header className="bg-white/70 backdrop-blur-xl border-b border-white/20 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 lg:px-8 py-3 sm:py-4">
          <div className="flex justify-between items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <button
                onClick={() => navigate('/crm/buyers')}
                className="p-1.5 sm:p-2 hover:bg-white/50 rounded-xl transition-colors flex-shrink-0"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </button>
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg shadow-orange-500/30 flex-shrink-0">
                  <ShoppingCart className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 truncate">
                    {isNew ? 'New Buyer' : contact.name || 'Buyer Details'}
                  </h1>
                  {!isNew && contact.phone && (
                    <p className="text-xs sm:text-sm text-gray-500">{contact.phone}</p>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-orange-500 to-amber-600 text-white rounded-xl hover:from-orange-600 hover:to-amber-700 transition-all shadow-lg shadow-orange-500/30 hover:shadow-xl hover:shadow-orange-500/40 disabled:opacity-50 font-medium"
            >
              <Save className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="text-sm sm:text-base">{saving ? 'Saving...' : 'Save'}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6">
        {/* Other Roles Badge */}
        {!isNew && getOtherRoles().length > 0 && (
          <div className="mb-4 p-3 bg-white/60 backdrop-blur-xl border border-white/20 rounded-xl shadow-lg">
            <p className="text-sm text-blue-800 font-medium mb-2">This contact also has other roles:</p>
            <div className="flex flex-wrap gap-2">
              {getOtherRoles().map((role) => (
                <button
                  key={role.name}
                  onClick={() => navigate(`/crm/${role.name.toLowerCase()}s/${contact.contactId}`)}
                  className={`inline-flex items-center px-3 py-1 rounded-xl text-sm bg-${role.color}-100 text-${role.color}-700 hover:bg-${role.color}-200 transition-colors`}
                >
                  <role.icon className="h-4 w-4 mr-1" />
                  {role.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* All Sections in Single Page */}
        {/* Profile Section */}
        <div className="bg-white/60 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-white/20 shadow-xl p-4 sm:p-6 space-y-6 mb-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <User className="h-5 w-5 mr-2 text-orange-600" />
            Basic Information
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={contact.name || ''}
                    onChange={(e) => setContact({ ...contact, name: e.target.value })}
                    className="w-full px-3 py-2 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400 transition-all"
                    placeholder="Full name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="tel"
                      value={contact.phone || ''}
                      onChange={(e) => setContact({ ...contact, phone: e.target.value })}
                      className="w-full pl-10 pr-3 py-2 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400 transition-all"
                      placeholder="Phone number"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="email"
                      value={contact.email || ''}
                      onChange={(e) => setContact({ ...contact, email: e.target.value })}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                      placeholder="Email address"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={contact.status || 'active'}
                    onChange={(e) => setContact({ ...contact, status: e.target.value as 'active' | 'inactive' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <textarea
                      value={contact.address || ''}
                      onChange={(e) => setContact({ ...contact, address: e.target.value })}
                      rows={2}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                      placeholder="Full address"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <div className="flex gap-2">
                    <textarea
                      value={contact.notes || ''}
                      onChange={(e) => setContact({ ...contact, notes: e.target.value })}
                      rows={3}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                      placeholder="General notes about this buyer..."
                    />
                    <SpeechToTextButton
                      onText={(text) =>
                        setContact((prev) => ({
                          ...prev,
                          notes: `${(prev.notes || '').trim()}${(prev.notes || '').trim() ? ' ' : ''}${text}`,
                        }))
                      }
                    />
                  </div>
                </div>
              </div>
        </div>

        {/* Purchased Properties Section */}
        {!isNew && (
          <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <Building2 className="h-5 w-5 mr-2 text-orange-600" />
                Purchased Properties
              </h3>
            </div>
            <div className="text-center py-12">
              <AlertCircle className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-2">No purchase records yet</p>
              <p className="text-sm text-gray-400">Purchases will be recorded when converting leads or through the API</p>
            </div>
          </div>
        )}

        {/* Notes Section */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Notes</h3>

          <div className="mb-6">
            <div className="flex gap-2">
              <textarea
                value={isNew ? draftActivityNote : newNote}
                onChange={(e) => (isNew ? setDraftActivityNote(e.target.value) : setNewNote(e.target.value))}
                placeholder={isNew ? 'Add a note (will be saved after creating buyer)...' : 'Add a note...'}
                rows={2}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              />
              <SpeechToTextButton
                onText={(text) =>
                  (isNew ? setDraftActivityNote : setNewNote)((prev) => `${prev.trim()}${prev.trim() ? ' ' : ''}${text}`)
                }
              />
              {!isNew && (
                <button
                  onClick={handleAddNote}
                  disabled={!newNote.trim()}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
                 aria-label="Add">
                  <Plus className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>

          {notes.length === 0 ? (
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No notes yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {notes.map((note) => (
                  <div key={note.noteId} className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-gray-700 whitespace-pre-wrap">{note.content}</p>
                    <div className="text-xs text-gray-500 mt-2">
                      {note.createdBy} • {new Date(note.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
