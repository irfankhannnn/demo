import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Users,
  ArrowLeft,
  Save,
  Phone,
  Mail,
  MapPin,
  User,
  CreditCard,
  FileText,
  Building,
  Home,
  ShoppingCart,
  Key,
  Tag,
  Plus,
  Trash2,
  Edit3,
  Check,
  AlertCircle,
} from 'lucide-react';
import { api } from '../../services/api';
import { CRMContact, CRMContactNote } from '../../types/crm';

export default function ContactDetails() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === 'new';

  const [contact, setContact] = useState<Partial<CRMContact>>({
    name: '',
    phone: '',
    email: '',
    address: '',
    roles: { owner: false, buyer: false, tenant: false },
    status: 'active',
    notes: '',
    panNumber: '',
    aadharNumber: '',
    bankName: '',
    accountNumber: '',
    ifscCode: '',
    source: '',
    tags: [],
  });
  const [notes, setNotes] = useState<CRMContactNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'roles' | 'documents' | 'notes'>('profile');
  const [newNote, setNewNote] = useState('');
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [editNoteContent, setEditNoteContent] = useState('');

  useEffect(() => {
    if (isNew) {
      setLoading(false);
      return;
    }
    
    if (id) {
      loadContact();
    }
  }, [id, isNew]);

  const loadContact = async () => {
    try {
      setLoading(true);
      const [contactData, notesData] = await Promise.all([
        api.getContactWithDocuments(id!),
        api.getContactNotes(id!),
      ]);
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

  const handleSave = async () => {
    if (!contact.name || !contact.phone) {
      alert('Name and phone are required');
      return;
    }

    try {
      setSaving(true);
      if (isNew) {
        await api.createContact({
          name: contact.name,
          phone: contact.phone,
          email: contact.email,
          address: contact.address,
          roles: contact.roles,
          status: contact.status as 'active' | 'inactive',
          notes: contact.notes,
          panNumber: contact.panNumber,
          aadharNumber: contact.aadharNumber,
          bankName: contact.bankName,
          accountNumber: contact.accountNumber,
          ifscCode: contact.ifscCode,
          source: contact.source,
          tags: contact.tags,
        });
      } else {
        await api.updateContact(id!, contact);
      }
      navigate('/crm/contacts');
    } catch (error) {
      console.error('Error saving contact:', error);
      alert('Failed to save contact');
    } finally {
      setSaving(false);
    }
  };

  const handleRoleToggle = async (role: 'owner' | 'buyer' | 'tenant') => {
    const newRoles = {
      ...contact.roles,
      [role]: !contact.roles?.[role],
    };
    setContact({ ...contact, roles: newRoles as CRMContact['roles'] });

    if (!isNew && id) {
      try {
        await api.updateContactRole(id, role, !contact.roles?.[role]);
      } catch (error) {
        console.error('Error updating role:', error);
        // Revert on error
        setContact({ ...contact });
      }
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

  const handleUpdateNote = async (noteId: string) => {
    if (!editNoteContent.trim() || !id) return;

    try {
      await api.updateContactNote(id, noteId, { content: editNoteContent });
      setNotes(notes.map((n) => (n.noteId === noteId ? { ...n, content: editNoteContent } : n)));
      setEditingNote(null);
      setEditNoteContent('');
    } catch (error) {
      console.error('Error updating note:', error);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!id) return;

    try {
      await api.deleteContactNote(id, noteId);
      setNotes(notes.filter((n) => n.noteId !== noteId));
    } catch (error) {
      console.error('Error deleting note:', error);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner': return Home;
      case 'buyer': return ShoppingCart;
      case 'tenant': return Key;
      default: return User;
    }
  };

  const getRoleColor = (role: string, active: boolean) => {
    if (!active) return 'bg-gray-100 text-gray-400 border-gray-200';
    switch (role) {
      case 'owner': return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'buyer': return 'bg-orange-100 text-orange-700 border-orange-300';
      case 'tenant': return 'bg-teal-100 text-teal-700 border-teal-300';
      default: return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto">
            <div className="absolute inset-0 rounded-full border-4 border-gray-200"></div>
            <div className="absolute inset-0 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin"></div>
          </div>
          <p className="mt-4 text-gray-600 animate-pulse">Loading contact...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <header className="bg-white/70 backdrop-blur-xl border-b border-white/20 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 lg:px-8 py-3 sm:py-4">
          <div className="flex justify-between items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <button
                onClick={() => navigate('/crm/contacts')}
                className="p-1.5 sm:p-2 hover:bg-white/50 rounded-xl transition-colors flex-shrink-0"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </button>
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 flex-shrink-0">
                  <Users className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 truncate">
                    {isNew ? 'New Contact' : contact.name || 'Contact Details'}
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
              className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl hover:from-indigo-600 hover:to-purple-700 transition-all shadow-lg shadow-indigo-500/30 disabled:opacity-50 font-medium"
            >
              <Save className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="text-sm sm:text-base">{saving ? 'Saving...' : 'Save'}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6">
        {/* Tabs */}
        <div className="bg-white/60 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-white/20 shadow-xl mb-4">
          <div className="flex border-b border-white/20 overflow-x-auto">
            {(['profile', 'roles', 'documents', 'notes'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 min-w-[80px] px-4 py-3 text-sm font-medium capitalize whitespace-nowrap transition-all ${
                  activeTab === tab
                    ? 'text-indigo-600 border-b-2 border-indigo-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="bg-white/60 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-white/20 shadow-xl p-4 sm:p-6 space-y-6">
            {/* Basic Info */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <User className="h-5 w-5 mr-2 text-indigo-600" />
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
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
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
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
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="Email address"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={contact.status || 'active'}
                    onChange={(e) => setContact({ ...contact, status: e.target.value as 'active' | 'inactive' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
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
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="Full address"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
                  <input
                    type="text"
                    value={contact.source || ''}
                    onChange={(e) => setContact({ ...contact, source: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g., Referral, Website, Walk-in"
                  />
                </div>
              </div>
            </div>

            {/* Bank Details */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Building className="h-5 w-5 mr-2 text-indigo-600" />
                Bank Details
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
                  <input
                    type="text"
                    value={contact.bankName || ''}
                    onChange={(e) => setContact({ ...contact, bankName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="Bank name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
                  <input
                    type="text"
                    value={contact.accountNumber || ''}
                    onChange={(e) => setContact({ ...contact, accountNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="Account number"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">IFSC Code</label>
                  <input
                    type="text"
                    value={contact.ifscCode || ''}
                    onChange={(e) => setContact({ ...contact, ifscCode: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="IFSC code"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Roles Tab */}
        {activeTab === 'roles' && (
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Roles</h3>
            <p className="text-sm text-gray-500 mb-6">
              A contact can have multiple roles. Toggle the roles that apply to this contact.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {(['owner', 'buyer', 'tenant'] as const).map((role) => {
                const Icon = getRoleIcon(role);
                const isActive = contact.roles?.[role] || false;
                return (
                  <button
                    key={role}
                    onClick={() => handleRoleToggle(role)}
                    className={`p-4 rounded-lg border-2 transition-all ${getRoleColor(role, isActive)} ${
                      isActive ? 'ring-2 ring-offset-2' : ''
                    }`}
                  >
                    <Icon className="h-8 w-8 mx-auto mb-2" />
                    <div className="text-sm font-medium capitalize">{role}</div>
                    <div className="text-xs mt-1">
                      {isActive ? (
                        <span className="flex items-center justify-center">
                          <Check className="h-3 w-3 mr-1" /> Active
                        </span>
                      ) : (
                        'Inactive'
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Role-specific profiles would go here */}
            {contact.roles?.buyer && contact.buyerProfile && (
              <div className="mt-6 p-4 bg-orange-50 rounded-lg">
                <h4 className="font-medium text-orange-800 mb-2">Buyer Profile</h4>
                <div className="text-sm text-orange-700">
                  {contact.buyerProfile.requirement && <p>Requirement: {contact.buyerProfile.requirement}</p>}
                  {contact.buyerProfile.budget && <p>Budget: ₹{contact.buyerProfile.budget.toLocaleString()}</p>}
                  {contact.buyerProfile.preferredArea && <p>Preferred Area: {contact.buyerProfile.preferredArea}</p>}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Documents Tab */}
        {activeTab === 'documents' && (
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <FileText className="h-5 w-5 mr-2 text-indigo-600" />
              Identity Documents
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">PAN Number</label>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={contact.panNumber || ''}
                    onChange={(e) => setContact({ ...contact, panNumber: e.target.value.toUpperCase() })}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 uppercase"
                    placeholder="ABCDE1234F"
                    maxLength={10}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Aadhar Number</label>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={contact.aadharNumber || ''}
                    onChange={(e) => setContact({ ...contact, aadharNumber: e.target.value.replace(/\D/g, '') })}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="1234 5678 9012"
                    maxLength={12}
                  />
                </div>
              </div>
            </div>

            {/* Document uploads and display would go here */}
            {(contact.photoUrl || contact.panDocUrl || contact.aadharDocUrl) && (
              <div className="mt-6">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Uploaded Documents</h4>
                <div className="grid grid-cols-3 gap-4">
                  {contact.photoUrl && (
                    <div className="text-center">
                      <img src={contact.photoUrl} alt="Photo" className="w-20 h-20 object-cover rounded-lg mx-auto" />
                      <p className="text-xs text-gray-500 mt-1">Photo</p>
                    </div>
                  )}
                  {contact.panDocUrl && (
                    <div className="text-center">
                      <a href={contact.panDocUrl} target="_blank" rel="noopener noreferrer" className="block">
                        <FileText className="h-12 w-12 text-gray-400 mx-auto" />
                        <p className="text-xs text-indigo-600 mt-1">View PAN</p>
                      </a>
                    </div>
                  )}
                  {contact.aadharDocUrl && (
                    <div className="text-center">
                      <a href={contact.aadharDocUrl} target="_blank" rel="noopener noreferrer" className="block">
                        <FileText className="h-12 w-12 text-gray-400 mx-auto" />
                        <p className="text-xs text-indigo-600 mt-1">View Aadhar</p>
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Notes Tab */}
        {activeTab === 'notes' && (
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Notes</h3>

            {/* Add Note */}
            {!isNew && (
              <div className="mb-6">
                <div className="flex gap-2">
                  <textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Add a note..."
                    rows={2}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    onClick={handleAddNote}
                    disabled={!newNote.trim()}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                </div>
              </div>
            )}

            {/* Notes List */}
            {notes.length === 0 ? (
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No notes yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {notes.map((note) => (
                  <div key={note.noteId} className="p-4 bg-gray-50 rounded-lg">
                    {editingNote === note.noteId ? (
                      <div className="space-y-2">
                        <textarea
                          value={editNoteContent}
                          onChange={(e) => setEditNoteContent(e.target.value)}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleUpdateNote(note.noteId)}
                            className="px-3 py-1 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setEditingNote(null);
                              setEditNoteContent('');
                            }}
                            className="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-gray-700 whitespace-pre-wrap">{note.content}</p>
                        <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-200">
                          <span className="text-xs text-gray-500">
                            {note.createdBy} • {new Date(note.createdAt).toLocaleDateString()}
                          </span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setEditingNote(note.noteId);
                                setEditNoteContent(note.content);
                              }}
                              className="p-1 text-gray-400 hover:text-indigo-600"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteNote(note.noteId)}
                              className="p-1 text-gray-400 hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
