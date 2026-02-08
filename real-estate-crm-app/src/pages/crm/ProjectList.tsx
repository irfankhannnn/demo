import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, Plus, Eye, ArrowLeft, RefreshCw, TrendingUp, Building, Zap, DollarSign } from 'lucide-react';
import { api } from '../../services/api';
import { Project, ProjectMetrics } from '../../types/realEstate';
import GlassDataTable, { Column } from '../../components/GlassDataTable';

export default function ProjectList() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [metrics, setMetrics] = useState<ProjectMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [lifecycleFilter, setLifecycleFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [projects, searchQuery, statusFilter, lifecycleFilter]);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const projectsData = await api.getProjects();
      setProjects(projectsData);
      
      try {
        const metricsData = await api.getProjectMetrics();
        setMetrics(metricsData);
      } catch (metricsError) {
        console.warn('Metrics endpoint not available yet:', metricsError);
      }
    } catch (error) {
      console.error('Error loading projects:', error);
      if (error instanceof Error && error.message.includes('token')) {
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...projects];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.developerName?.toLowerCase().includes(query) ||
          p.areaName?.toLowerCase().includes(query)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((p) => p.status === statusFilter);
    }

    if (lifecycleFilter !== 'all') {
      filtered = filtered.filter((p) => p.constructionStatus === lifecycleFilter);
    }

    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setFilteredProjects(filtered);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'planned': return 'bg-gray-100 text-gray-700';
      case 'booking-open': return 'bg-blue-100 text-blue-700';
      case 'under-construction': return 'bg-amber-100 text-amber-700';
      case 'nearing-completion': return 'bg-orange-100 text-orange-700';
      case 'completed': return 'bg-emerald-100 text-emerald-700';
      case 'delivered': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const columns: Column<Project>[] = [
    {
      key: 'name',
      header: 'Project',
      sortable: true,
      render: (project) => (
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 via-pink-500 to-rose-500 flex items-center justify-center shadow-xl shadow-purple-500/30">
            <Briefcase className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-base">{project.name}</p>
            <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
              <Building className="h-3.5 w-3.5" />
              {project.developerName} • {project.areaName}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'constructionStatus',
      header: 'Status',
      sortable: true,
      render: (project) => (
        <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${getStatusColor(project.constructionStatus)}`}>
          {project.constructionStatus?.replace('-', ' ').toUpperCase()}
        </span>
      ),
    },
    {
      key: 'startingPrice',
      header: 'Starting Price',
      sortable: true,
      render: (project) => (
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-emerald-500" />
          <span className="font-bold text-emerald-600">
            {new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(project.startingPrice || 0)}
          </span>
        </div>
      ),
    },
    {
      key: 'unitsAvailable',
      header: 'Inventory',
      sortable: true,
      render: (project) => (
        <div className="flex flex-col">
          <span className="text-2xl font-bold text-purple-600">{project.unitsAvailable || 0}</span>
          <span className="text-xs text-gray-500">{project.totalUnits || 0} total</span>
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (project) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/crm/projects/${project.projectId}`);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-xl hover:shadow-lg hover:shadow-purple-500/30 transition-all hover:scale-105"
        >
          <Eye className="h-4 w-4" />
          <span className="font-medium">View</span>
        </button>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-rose-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-600 mx-auto shadow-lg"></div>
          <p className="mt-6 text-gray-600 font-medium">Loading projects...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-rose-50">
      <header className="bg-white/70 backdrop-blur-xl shadow-lg border-b border-white/20 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <button onClick={() => navigate('/crm')} className="p-2.5 hover:bg-white/80 rounded-xl transition-all">
                <ArrowLeft className="h-6 w-6 text-gray-700" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-xl shadow-purple-500/30">
                  <Briefcase className="h-7 w-7 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                    Real Estate Projects
                  </h1>
                  <p className="text-sm text-gray-600 font-medium">{filteredProjects.length} projects</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={loadProjects}
                className="flex items-center gap-2 px-4 py-2.5 bg-white/80 border border-gray-200 text-gray-700 rounded-xl hover:shadow-lg transition-all hover:scale-105"
              >
                <RefreshCw className="h-5 w-5" />
                <span className="hidden sm:inline font-medium">Refresh</span>
              </button>
              <button
                onClick={() => navigate('/crm/projects/new')}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-xl hover:shadow-xl hover:shadow-purple-500/40 transition-all hover:scale-105"
              >
                <Plus className="h-5 w-5" />
                <span className="font-semibold">Add Project</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {metrics && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white/70 backdrop-blur-xl rounded-3xl shadow-xl p-6 border border-white/20 hover:shadow-2xl transition-all hover:scale-105">
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg">
                  <Briefcase className="h-6 w-6 text-white" />
                </div>
                <TrendingUp className="h-5 w-5 text-purple-500" />
              </div>
              <div className="text-3xl font-bold text-gray-900">{metrics.totalProjects}</div>
              <div className="text-sm text-gray-600 font-medium mt-1">Total Projects</div>
            </div>

            <div className="bg-white/70 backdrop-blur-xl rounded-3xl shadow-xl p-6 border border-white/20 hover:shadow-2xl transition-all hover:scale-105">
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500 to-pink-600 flex items-center justify-center shadow-lg">
                  <Zap className="h-6 w-6 text-white" />
                </div>
                <TrendingUp className="h-5 w-5 text-pink-500" />
              </div>
              <div className="text-3xl font-bold text-gray-900">{metrics.activeProjects || 0}</div>
              <div className="text-sm text-gray-600 font-medium mt-1">Active Projects</div>
            </div>

            <div className="bg-white/70 backdrop-blur-xl rounded-3xl shadow-xl p-6 border border-white/20 hover:shadow-2xl transition-all hover:scale-105">
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500 to-rose-600 flex items-center justify-center shadow-lg">
                  <Building className="h-6 w-6 text-white" />
                </div>
                <TrendingUp className="h-5 w-5 text-rose-500" />
              </div>
              <div className="text-3xl font-bold text-gray-900">{metrics.totalUnits || 0}</div>
              <div className="text-sm text-gray-600 font-medium mt-1">Total Units</div>
            </div>

            <div className="bg-white/70 backdrop-blur-xl rounded-3xl shadow-xl p-6 border border-white/20 hover:shadow-2xl transition-all hover:scale-105">
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg">
                  <DollarSign className="h-6 w-6 text-white" />
                </div>
                <TrendingUp className="h-5 w-5 text-amber-500" />
              </div>
              <div className="text-3xl font-bold text-gray-900">{metrics.availableUnits || 0}</div>
              <div className="text-sm text-gray-600 font-medium mt-1">Available Units</div>
            </div>
          </div>
        )}

        <div className="bg-white/70 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 overflow-hidden">
          <GlassDataTable
            data={filteredProjects}
            columns={columns}
            keyExtractor={(project) => project.projectId}
            onRowClick={(project) => navigate(`/crm/projects/${project.projectId}`)}
            searchPlaceholder="Search projects by name, developer, area..."
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            emptyMessage="No projects found"
            emptyIcon={<Briefcase className="h-16 w-16 text-gray-300" />}
            filters={
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500/30"
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Construction Status</label>
                  <select
                    value={lifecycleFilter}
                    onChange={(e) => setLifecycleFilter(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500/30"
                  >
                    <option value="all">All Stages</option>
                    <option value="planned">Planned</option>
                    <option value="booking-open">Booking Open</option>
                    <option value="under-construction">Under Construction</option>
                    <option value="nearing-completion">Nearing Completion</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>
            }
            showFilters={showFilters}
            onToggleFilters={() => setShowFilters(!showFilters)}
          />
        </div>
      </main>
    </div>
  );
}
