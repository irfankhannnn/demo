import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MapPin, ArrowLeft, Save, Trash2, Youtube } from 'lucide-react';
import { api } from '../../services/api';
import { RealEstateArea } from '../../types/realEstate';
import MediaUploadSection from '../../components/MediaUploadSection';

export default function RealEstateAreaDetails() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === 'new';

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<RealEstateArea>>({
    name: '',
    city: '',
    country: 'India',
    description: '',
    status: 'active',
    youtubeVideoUrl: '',
    images: [],
    videos: [],
  });

  useEffect(() => {
    if (isNew) {
      setLoading(false);
      return;
    }
    if (!isNew && id) {
      loadArea();
    }
  }, [id, isNew]);

  const loadArea = async () => {
    try {
      setLoading(true);
      const data = await api.getRealEstateArea(id!);
      setFormData(data);
    } catch (error) {
      console.error('Error loading area:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      if (isNew) {
        await api.createRealEstateArea(formData);
      } else {
        await api.updateRealEstateArea(id!, formData);
      }
      navigate('/crm/real-estate-areas');
    } catch (error) {
      console.error('Error saving area:', error);
      alert('Failed to save area');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this area?')) return;
    try {
      await api.deleteRealEstateArea(id!);
      navigate('/crm/real-estate-areas');
    } catch (error) {
      console.error('Error deleting area:', error);
    }
  };

  const handleImagesUpload = async (files: File[]) => {
    if (!id || isNew) return;
    await api.uploadAreaImages(id, files);
    await loadArea();
  };

  const handleImagesDelete = async (s3Key: string) => {
    if (!id || isNew) return;
    await api.deleteAreaImage(id, s3Key);
    await loadArea();
  };

  const handleVideosUpload = async (files: File[]) => {
    if (!id || isNew) return;
    await api.uploadAreaVideos(id, files);
    await loadArea();
  };

  const handleVideosDelete = async (s3Key: string) => {
    if (!id || isNew) return;
    await api.deleteAreaVideo(id, s3Key);
    await loadArea();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50">
      <header className="bg-white/70 backdrop-blur-xl shadow-lg border-b border-white/20 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <button onClick={() => navigate('/crm/real-estate-areas')} className="p-2 hover:bg-white/80 rounded-xl">
                <ArrowLeft className="h-6 w-6" />
              </button>
              <MapPin className="h-8 w-8 text-emerald-600" />
              <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                {isNew ? 'New Area' : 'Edit Area'}
              </h1>
            </div>
            {!isNew && (
              <button onClick={handleDelete} className="px-4 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 flex items-center gap-2">
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <form onSubmit={handleSubmit} className="bg-white/70 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-white/20">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Area Name *</label>
              <input
                type="text"
                required
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">City *</label>
              <input
                type="text"
                required
                value={formData.city || ''}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full px-4 py-3 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Country *</label>
              <select
                required
                value={formData.country || 'India'}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                className="w-full px-4 py-3 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/30"
              >
                <option value="India">India</option>
                <option value="UAE">UAE</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Status</label>
              <select
                value={formData.status || 'active'}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full px-4 py-3 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/30"
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
                className="w-full px-4 py-3 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <Youtube className="h-5 w-5 text-red-600" />
                YouTube Video URL
              </label>
              <input
                type="url"
                value={formData.youtubeVideoUrl || ''}
                onChange={(e) => setFormData({ ...formData, youtubeVideoUrl: e.target.value })}
                placeholder="https://youtube.com/watch?v=..."
                className="w-full px-4 py-3 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>
          </div>

          <div className="mt-8 flex justify-end gap-4">
            <button
              type="button"
              onClick={() => navigate('/crm/real-estate-areas')}
              className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl hover:shadow-xl flex items-center gap-2 font-semibold disabled:opacity-50"
            >
              <Save className="h-5 w-5" />
              {saving ? 'Saving...' : 'Save Area'}
            </button>
          </div>
        </form>

        {/* Media Upload Sections - Only show for existing areas */}
        {!isNew && id && (
          <>
            <div className="mt-6">
              <MediaUploadSection
                title="Area Images"
                type="images"
                items={formData.images || []}
                onUpload={handleImagesUpload}
                onDelete={handleImagesDelete}
                maxFiles={20}
              />
            </div>

            <div className="mt-6">
              <MediaUploadSection
                title="Area Videos"
                type="videos"
                items={formData.videos || []}
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
              💡 Save the area first to upload images and videos
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
