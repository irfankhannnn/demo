import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Building2, ArrowLeft, Save, Trash2, Upload, Youtube } from 'lucide-react';
import { api } from '../../services/api';
import Toast from '../../components/Toast';
import { PermissionGuard } from '../../components/PermissionGuard';
import { Developer } from '../../types/realEstate';
import MediaUploadSection from '../../components/MediaUploadSection';

export default function DeveloperDetails() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === 'new';

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' = 'error') => {
    setToast({ message, type });
  };
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState<Partial<Developer>>({
    name: '',
    country: 'India',
    headquarters: '',
    description: '',
    establishedYear: new Date().getFullYear(),
    companyType: 'Private',
    status: 'active',
    website: '',
    email: '',
    phone: '',
    youtubeChannel: '',
    images: [],
    videos: [],
  });

  useEffect(() => {
    if (isNew) {
      setLoading(false);
      return;
    }
    if (!isNew && id) {
      loadDeveloper();
    }
  }, [id, isNew]);

  const loadDeveloper = async () => {
    try {
      setLoading(true);
      const data = await api.getDeveloper(id!);
      setFormData(data);
    } catch (error) {
      console.error('Error loading developer:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      if (isNew) {
        await api.createDeveloper(formData);
      } else {
        await api.updateDeveloper(id!, formData);
      }
      navigate('/crm/developers');
    } catch (error) {
      console.error('Error saving developer:', error);
      showToast('Failed to save developer', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this developer?')) return;
    try {
      await api.deleteDeveloper(id!);
      navigate('/crm/developers');
    } catch (error) {
      console.error('Error deleting developer:', error);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0] || !id || isNew) return;
    try {
      setUploadingLogo(true);
      await api.uploadDeveloperLogo(id, e.target.files[0]);
      await loadDeveloper();
    } catch (error) {
      console.error('Error uploading logo:', error);
      showToast('Failed to upload logo', 'error');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleImagesUpload = async (files: File[]) => {
    if (!id || isNew) return;
    await api.uploadDeveloperImages(id, files);
    await loadDeveloper();
  };

  const handleImagesDelete = async (s3Key: string) => {
    if (!id || isNew) return;
    await api.deleteDeveloperImage(id, s3Key);
    await loadDeveloper();
  };

  const handleVideosUpload = async (files: File[]) => {
    if (!id || isNew) return;
    await api.uploadDeveloperVideos(id, files);
    await loadDeveloper();
  };

  const handleVideosDelete = async (s3Key: string) => {
    if (!id || isNew) return;
    await api.deleteDeveloperVideo(id, s3Key);
    await loadDeveloper();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <header className="bg-white/70 backdrop-blur-xl shadow-lg border-b border-white/20 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <button onClick={() => navigate('/crm/developers')} className="p-2 hover:bg-white/80 rounded-xl">
                <ArrowLeft className="h-6 w-6" />
              </button>
              <Building2 className="h-8 w-8 text-blue-600" />
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                {isNew ? 'New Developer' : 'Edit Developer'}
              </h1>
            </div>
            {!isNew && (
              <PermissionGuard permission="delete">
                <button onClick={handleDelete} className="px-4 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 flex items-center gap-2">
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </PermissionGuard>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <form onSubmit={handleSubmit} className="bg-white/70 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-white/20">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Developer Name *</label>
              <input
                type="text"
                required
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/30"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Country *</label>
              <select
                required
                value={formData.country || 'India'}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                className="w-full px-4 py-3 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/30"
              >
                <option value="India">India</option>
                <option value="UAE">UAE</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Headquarters</label>
              <input
                type="text"
                value={formData.headquarters || ''}
                onChange={(e) => setFormData({ ...formData, headquarters: e.target.value })}
                className="w-full px-4 py-3 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/30"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Established Year</label>
              <input
                type="number"
                value={formData.establishedYear || ''}
                onChange={(e) => setFormData({ ...formData, establishedYear: parseInt(e.target.value) })}
                className="w-full px-4 py-3 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/30"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Website</label>
              <input
                type="url"
                value={formData.website || ''}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                className="w-full px-4 py-3 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/30"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
              <input
                type="email"
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/30"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Phone</label>
              <input
                type="tel"
                value={formData.phone || ''}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-3 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/30"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Status</label>
              <select
                value={formData.status || 'active'}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
                className="w-full px-4 py-3 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/30"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
              <textarea
                rows={4}
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-3 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/30"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <Youtube className="h-5 w-5 text-red-600" />
                YouTube Channel URL
              </label>
              <input
                type="url"
                value={formData.youtubeChannel || ''}
                onChange={(e) => setFormData({ ...formData, youtubeChannel: e.target.value })}
                placeholder="https://youtube.com/@channel"
                className="w-full px-4 py-3 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
          </div>

          <div className="mt-8 flex justify-end gap-4">
            <button
              type="button"
              onClick={() => navigate('/crm/developers')}
              className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl hover:shadow-xl flex items-center gap-2 font-semibold disabled:opacity-50"
            >
              <Save className="h-5 w-5" />
              {saving ? 'Saving...' : 'Save Developer'}
            </button>
          </div>
        </form>

        {/* Logo Upload Section - Only show for existing developers */}
        {!isNew && id && (
          <div className="mt-6 bg-white/70 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-white/20">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Developer Logo</h2>
            <div className="flex items-center gap-6">
              {formData.logoUrl && (
                <div className="relative group">
                  <img
                    src={formData.logoUrl}
                    alt="Developer Logo"
                    className="w-32 h-32 object-contain rounded-xl border-2 border-gray-200 bg-white"
                  />
                </div>
              )}
              <div>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                  disabled={uploadingLogo}
                />
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={uploadingLogo}
                  className="px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 flex items-center gap-2 disabled:opacity-50"
                >
                  <Upload className="h-4 w-4" />
                  {uploadingLogo ? 'Uploading...' : formData.logoUrl ? 'Change Logo' : 'Upload Logo'}
                </button>
                <p className="text-xs text-gray-500 mt-2">PNG, JPG up to 10MB</p>
              </div>
            </div>
          </div>
        )}

        {/* Media Upload Sections - Only show for existing developers */}
        {!isNew && id && (
          <>
            <div className="mt-6">
              <MediaUploadSection
                title="Developer Images"
                type="images"
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                items={(formData.images || []) as any}
                onUpload={handleImagesUpload}
                onDelete={handleImagesDelete}
                maxFiles={20}
              />
            </div>

            <div className="mt-6">
              <MediaUploadSection
                title="Developer Videos"
                type="videos"
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                items={(formData.videos || []) as any}
                onUpload={handleVideosUpload}
                onDelete={handleVideosDelete}
                maxFiles={10}
              />
            </div>
          </>
        )}

        {isNew && (
          <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-sm text-amber-800">
              💡 Save the developer first to upload logo, images, and videos
            </p>
          </div>
        )}
      </main>
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
