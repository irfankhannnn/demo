import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Briefcase, ArrowLeft, Save, Trash2, Youtube } from 'lucide-react';
import { api } from '../../services/api';
import { PermissionGuard } from '../../components/PermissionGuard';
import { Project, Developer, RealEstateArea } from '../../types/realEstate';
import MediaUploadSection from '../../components/MediaUploadSection';
import PDFUploadSection from '../../components/PDFUploadSection';

export default function ProjectDetails() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === 'new';

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [developers, setDevelopers] = useState<Developer[]>([]);
  const [areas, setAreas] = useState<RealEstateArea[]>([]);
  const [formData, setFormData] = useState<Partial<Project>>({
    name: '',
    developerId: '',
    areaId: '',
    projectType: 'residential',
    constructionStatus: 'planned',
    status: 'active',
    country: 'India',
    city: '',
    youtubeVideoUrl: '',
    images: [],
    videos: [],
  });

  useEffect(() => {
    loadReferenceData();
    if (isNew) {
      setLoading(false);
      return;
    }
    if (!isNew && id) {
      loadProject();
    }
  }, [id, isNew]);

  const loadReferenceData = async () => {
    try {
      const [devsData, areasData] = await Promise.all([
        api.getDevelopers(),
        api.getRealEstateAreas(),
      ]);
      setDevelopers(devsData);
      setAreas(areasData);
    } catch (error) {
      console.error('Error loading reference data:', error);
    }
  };

  const loadProject = async () => {
    try {
      setLoading(true);
      const data = await api.getProject(id!);
      setFormData(data);
    } catch (error) {
      console.error('Error loading project:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      if (isNew) {
        await api.createProject(formData);
      } else {
        await api.updateProject(id!, formData);
      }
      navigate('/crm/projects');
    } catch (error) {
      console.error('Error saving project:', error);
      alert('Failed to save project');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this project?')) return;
    try {
      await api.deleteProject(id!);
      navigate('/crm/projects');
    } catch (error) {
      console.error('Error deleting project:', error);
    }
  };

  const handleImagesUpload = async (files: File[]) => {
    if (!id || isNew) return;
    await api.uploadProjectImages(id, files);
    await loadProject();
  };

  const handleImagesDelete = async (s3Key: string) => {
    if (!id || isNew) return;
    await api.deleteProjectImage(id, s3Key);
    await loadProject();
  };

  const handleVideosUpload = async (files: File[]) => {
    if (!id || isNew) return;
    await api.uploadProjectVideos(id, files);
    await loadProject();
  };

  const handleVideosDelete = async (s3Key: string) => {
    if (!id || isNew) return;
    await api.deleteProjectVideo(id, s3Key);
    await loadProject();
  };

  const handleBrochureUpload = async (files: File[]) => {
    if (!id || isNew || files.length === 0) return;
    await api.uploadProjectBrochure(id, files[0]);
    await loadProject();
  };

  const handleBrochureDelete = async (s3Key: string) => {
    if (!id || isNew) return;
    // Note: Brochure delete needs special handling - update documents object
    await api.deleteProjectFloorPlan(id, s3Key); // Using this endpoint for now
    await loadProject();
  };

  const handleFloorPlansUpload = async (files: File[]) => {
    if (!id || isNew) return;
    await api.uploadProjectFloorPlans(id, files);
    await loadProject();
  };

  const handleFloorPlansDelete = async (s3Key: string) => {
    if (!id || isNew) return;
    await api.deleteProjectFloorPlan(id, s3Key);
    await loadProject();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-rose-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-rose-50">
      <header className="bg-white/70 backdrop-blur-xl shadow-lg border-b border-white/20 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <button onClick={() => navigate('/crm/projects')} className="p-2 hover:bg-white/80 rounded-xl">
                <ArrowLeft className="h-6 w-6" />
              </button>
              <Briefcase className="h-8 w-8 text-purple-600" />
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                {isNew ? 'New Project' : 'Edit Project'}
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
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Project Name *</label>
              <input
                type="text"
                required
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500/30"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Developer *</label>
              <select
                required
                value={formData.developerId || ''}
                onChange={(e) => setFormData({ ...formData, developerId: e.target.value })}
                className="w-full px-4 py-3 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500/30"
              >
                <option value="">Select Developer</option>
                {developers.map((dev) => (
                  <option key={dev.developerId} value={dev.developerId}>
                    {dev.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Area *</label>
              <select
                required
                value={formData.areaId || ''}
                onChange={(e) => setFormData({ ...formData, areaId: e.target.value })}
                className="w-full px-4 py-3 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500/30"
              >
                <option value="">Select Area</option>
                {areas.map((area) => (
                  <option key={area.areaId} value={area.areaId}>
                    {area.name} ({area.city})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Project Type</label>
              <select
                value={formData.projectType || 'residential'}
                onChange={(e) => setFormData({ ...formData, projectType: e.target.value as any })}
                className="w-full px-4 py-3 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500/30"
              >
                <option value="residential">Residential</option>
                <option value="commercial">Commercial</option>
                <option value="mixed-use">Mixed-Use</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Construction Status</label>
              <select
                value={formData.constructionStatus || 'planned'}
                onChange={(e) => setFormData({ ...formData, constructionStatus: e.target.value as any })}
                className="w-full px-4 py-3 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500/30"
              >
                <option value="planned">Planned</option>
                <option value="booking-open">Booking Open</option>
                <option value="under-construction">Under Construction</option>
                <option value="nearing-completion">Nearing Completion</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Starting Price</label>
              <input
                type="number"
                value={formData.startingPrice || ''}
                onChange={(e) => setFormData({ ...formData, startingPrice: parseFloat(e.target.value) })}
                className="w-full px-4 py-3 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500/30"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Total Units</label>
              <input
                type="number"
                value={formData.totalUnits || ''}
                onChange={(e) => setFormData({ ...formData, totalUnits: parseInt(e.target.value) })}
                className="w-full px-4 py-3 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500/30"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Status</label>
              <select
                value={formData.status || 'active'}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full px-4 py-3 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500/30"
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
                className="w-full px-4 py-3 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500/30"
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
                className="w-full px-4 py-3 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500/30"
              />
            </div>
          </div>

          <div className="mt-8 flex justify-end gap-4">
            <button
              type="button"
              onClick={() => navigate('/crm/projects')}
              className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-xl hover:shadow-xl flex items-center gap-2 font-semibold disabled:opacity-50"
            >
              <Save className="h-5 w-5" />
              {saving ? 'Saving...' : 'Save Project'}
            </button>
          </div>
        </form>

        {/* Media Upload Sections - Only show for existing projects */}
        {!isNew && id && (
          <>
            <div className="mt-6">
              <MediaUploadSection
                title="Project Images"
                type="images"
                items={formData.images || []}
                onUpload={handleImagesUpload}
                onDelete={handleImagesDelete}
                maxFiles={20}
              />
            </div>

            <div className="mt-6">
              <MediaUploadSection
                title="Project Videos"
                type="videos"
                items={formData.videos || []}
                onUpload={handleVideosUpload}
                onDelete={handleVideosDelete}
                maxFiles={10}
              />
            </div>

            <div className="mt-6">
              <PDFUploadSection
                title="Project Brochure"
                description="Upload project brochure PDF (marketing material)"
                items={formData.documents?.brochure ? [formData.documents.brochure as any] : []}
                onUpload={handleBrochureUpload}
                onDelete={handleBrochureDelete}
                singleFile={true}
              />
            </div>

            <div className="mt-6">
              <PDFUploadSection
                title="Floor Plans"
                description="Upload floor plan PDFs for different unit types"
                items={(formData.documents?.floorPlans || []) as any}
                onUpload={handleFloorPlansUpload}
                onDelete={handleFloorPlansDelete}
                maxFiles={15}
              />
            </div>
          </>
        )}

        {isNew && (
          <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-sm text-amber-800">
              💡 Save the project first to upload images, videos, brochure, and floor plans
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
