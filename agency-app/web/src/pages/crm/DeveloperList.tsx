import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Plus,
  Eye,
  ArrowLeft,
  RefreshCw,
  MapPin,
  Star,
  TrendingUp,
  Briefcase,
  Globe,
  Award,
} from 'lucide-react';
import { api } from '../../services/api';
import { Developer, DeveloperMetrics } from '../../types/realEstate';
import GlassDataTable, { Column } from '../../components/GlassDataTable';

type StatusFilter = 'all' | 'active' | 'inactive';
type CountryFilter = 'all' | 'India' | 'UAE';

export default function DeveloperList() {
  const navigate = useNavigate();
  const [developers, setDevelopers] = useState<Developer[]>([]);
  const [filteredDevelopers, setFilteredDevelopers] = useState<Developer[]>([]);
  const [metrics, setMetrics] = useState<DeveloperMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [countryFilter, setCountryFilter] = useState<CountryFilter>('all');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadDevelopers();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [developers, searchQuery, statusFilter, countryFilter]);

  const loadDevelopers = async () => {
    try {
      setLoading(true);
      const devsData = await api.getDevelopers();
      setDevelopers(devsData);
      
      try {
        const metricsData = await api.getDeveloperMetrics();
        setMetrics(metricsData);
      } catch (metricsError) {
        console.warn('Metrics endpoint not available yet:', metricsError);
      }
    } catch (error) {
      console.error('Error loading developers:', error);
      if (error instanceof Error && error.message.includes('token')) {
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...developers];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (d) =>
          d.name.toLowerCase().includes(query) ||
          d.description?.toLowerCase().includes(query) ||
          d.headquarters?.toLowerCase().includes(query)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((d) => d.status === statusFilter);
    }

    if (countryFilter !== 'all') {
      filtered = filtered.filter((d) => d.country === countryFilter);
    }

    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setFilteredDevelopers(filtered);
  };

  const columns: Column<Developer>[] = [
    {
      key: 'name',
      header: 'Developer',
      sortable: true,
      render: (dev) => (
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 via-blue-600 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-xl shadow-blue-500/30">
            <Building2 className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-base">{dev.name}</p>
            {dev.headquarters && (
              <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                <MapPin className="h-3.5 w-3.5" />
                {dev.headquarters}
              </p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'country',
      header: 'Market',
      sortable: true,
      render: (dev) => (
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-gray-400" />
          <span className="font-medium">{dev.country}</span>
        </div>
      ),
    },
    {
      key: 'totalProjects',
      header: 'Projects',
      sortable: true,
      render: (dev) => (
        <div className="flex flex-col">
          <span className="text-2xl font-bold text-blue-600">{dev.totalProjects || 0}</span>
          <span className="text-xs text-gray-500">
            {dev.ongoingProjects || 0} active
          </span>
        </div>
      ),
    },
    {
      key: 'establishedYear',
      header: 'Established',
      sortable: true,
      render: (dev) => (
        <div className="flex items-center gap-2">
          <Award className="h-4 w-4 text-amber-500" />
          <span className="font-medium">{dev.establishedYear || 'N/A'}</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (dev) => (
        <span
          className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
            dev.status === 'active'
              ? 'bg-emerald-100 text-emerald-700 shadow-sm shadow-emerald-100'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          {dev.status === 'active' ? '● Active' : '○ Inactive'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (dev) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/crm/developers/${dev.developerId}`);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl hover:shadow-lg hover:shadow-blue-500/30 transition-all duration-300 hover:scale-105"
        >
          <Eye className="h-4 w-4" />
          <span className="font-medium">View</span>
        </button>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto shadow-lg"></div>
          <p className="mt-6 text-gray-600 font-medium">Loading developers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Glass Header */}
      <header className="bg-white/70 backdrop-blur-xl shadow-lg shadow-gray-200/50 border-b border-white/20 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center gap-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/crm')}
                className="p-2.5 hover:bg-white/80 rounded-xl transition-all duration-300 hover:shadow-md backdrop-blur-sm"
              >
                <ArrowLeft className="h-6 w-6 text-gray-700" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 via-blue-600 to-purple-600 flex items-center justify-center shadow-xl shadow-blue-500/30">
                  <Building2 className="h-7 w-7 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    Real Estate Developers
                  </h1>
                  <p className="text-sm text-gray-600 font-medium">{filteredDevelopers.length} developers</p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={loadDevelopers}
                className="flex items-center space-x-2 px-4 py-2.5 bg-white/80 backdrop-blur-sm border border-gray-200 text-gray-700 rounded-xl hover:shadow-lg transition-all duration-300 hover:scale-105"
              >
                <RefreshCw className="h-5 w-5" />
                <span className="hidden sm:inline font-medium">Refresh</span>
              </button>
              <button
                onClick={() => navigate('/crm/developers/new')}
                className="flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-blue-500 via-blue-600 to-purple-600 text-white rounded-xl hover:shadow-xl hover:shadow-blue-500/40 transition-all duration-300 hover:scale-105"
              >
                <Plus className="h-5 w-5" />
                <span className="font-semibold">Add Developer</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Glass Metrics Cards */}
        {metrics && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white/70 backdrop-blur-xl rounded-3xl shadow-xl shadow-blue-100/50 p-6 border border-white/20 hover:shadow-2xl transition-all duration-300 hover:scale-105">
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                  <Building2 className="h-6 w-6 text-white" />
                </div>
                <TrendingUp className="h-5 w-5 text-blue-500" />
              </div>
              <div className="text-3xl font-bold text-gray-900">{metrics.totalDevelopers}</div>
              <div className="text-sm text-gray-600 font-medium mt-1">Total Developers</div>
            </div>

            <div className="bg-white/70 backdrop-blur-xl rounded-3xl shadow-xl shadow-emerald-100/50 p-6 border border-white/20 hover:shadow-2xl transition-all duration-300 hover:scale-105">
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                  <Star className="h-6 w-6 text-white" />
                </div>
                <TrendingUp className="h-5 w-5 text-emerald-500" />
              </div>
              <div className="text-3xl font-bold text-gray-900">{metrics.activeDevelopers || 0}</div>
              <div className="text-sm text-gray-600 font-medium mt-1">Active Developers</div>
            </div>

            <div className="bg-white/70 backdrop-blur-xl rounded-3xl shadow-xl shadow-purple-100/50 p-6 border border-white/20 hover:shadow-2xl transition-all duration-300 hover:scale-105">
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
                  <Briefcase className="h-6 w-6 text-white" />
                </div>
                <TrendingUp className="h-5 w-5 text-purple-500" />
              </div>
              <div className="text-3xl font-bold text-gray-900">{metrics.totalProjects || 0}</div>
              <div className="text-sm text-gray-600 font-medium mt-1">Total Projects</div>
            </div>

            <div className="bg-white/70 backdrop-blur-xl rounded-3xl shadow-xl shadow-amber-100/50 p-6 border border-white/20 hover:shadow-2xl transition-all duration-300 hover:scale-105">
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
                  <Globe className="h-6 w-6 text-white" />
                </div>
                <TrendingUp className="h-5 w-5 text-amber-500" />
              </div>
              <div className="text-3xl font-bold text-gray-900">{metrics.activeProjects || 0}</div>
              <div className="text-sm text-gray-600 font-medium mt-1">Active Projects</div>
            </div>
          </div>
        )}

        {/* Glass Data Table */}
        <div className="bg-white/70 backdrop-blur-xl rounded-3xl shadow-2xl shadow-gray-200/50 border border-white/20 overflow-hidden">
          <GlassDataTable
            data={filteredDevelopers}
            columns={columns}
            keyExtractor={(dev) => dev.developerId}
            onRowClick={(dev) => navigate(`/crm/developers/${dev.developerId}`)}
            searchPlaceholder="Search developers by name, location..."
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            emptyMessage="No developers found"
            emptyIcon={<Building2 className="h-16 w-16 text-gray-300" />}
            filters={
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                    className="w-full px-4 py-2.5 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Country</label>
                  <select
                    value={countryFilter}
                    onChange={(e) => setCountryFilter(e.target.value as CountryFilter)}
                    className="w-full px-4 py-2.5 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
                  >
                    <option value="all">All Countries</option>
                    <option value="India">India</option>
                    <option value="UAE">UAE</option>
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
