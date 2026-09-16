import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Plus, Eye, ArrowLeft, RefreshCw, TrendingUp, Building, Sparkles, Globe2 } from 'lucide-react';
import { api } from '../../services/api';
import { RealEstateArea, AreaMetrics } from '../../types/realEstate';
import GlassDataTable, { Column } from '../../components/GlassDataTable';

export default function RealEstateAreaList() {
  const navigate = useNavigate();
  const [areas, setAreas] = useState<RealEstateArea[]>([]);
  const [filteredAreas, setFilteredAreas] = useState<RealEstateArea[]>([]);
  const [metrics, setMetrics] = useState<AreaMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [countryFilter, setCountryFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadAreas();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [areas, searchQuery, cityFilter, countryFilter]);

  const loadAreas = async () => {
    try {
      setLoading(true);
      const areasData = await api.getRealEstateAreas();
      setAreas(areasData);
      
      try {
        const metricsData = await api.getRealEstateAreaMetrics();
        setMetrics(metricsData);
      } catch (metricsError) {
        console.warn('Metrics endpoint not available yet:', metricsError);
      }
    } catch (error) {
      console.error('Error loading areas:', error);
      if (error instanceof Error && error.message.includes('token')) {
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...areas];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (a) =>
          a.name.toLowerCase().includes(query) ||
          a.city?.toLowerCase().includes(query) ||
          a.description?.toLowerCase().includes(query)
      );
    }

    if (cityFilter !== 'all') {
      filtered = filtered.filter((a) => a.city === cityFilter);
    }

    if (countryFilter !== 'all') {
      filtered = filtered.filter((a) => a.country === countryFilter);
    }

    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setFilteredAreas(filtered);
  };

  const columns: Column<RealEstateArea>[] = [
    {
      key: 'name',
      header: 'Area / Community',
      sortable: true,
      render: (area) => (
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 flex items-center justify-center shadow-xl shadow-emerald-500/30">
            <MapPin className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-base">{area.name}</p>
            <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
              <Globe2 className="h-3.5 w-3.5" />
              {area.city}, {area.country}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'totalProjects',
      header: 'Projects',
      sortable: true,
      render: (area) => (
        <div className="flex flex-col">
          <span className="text-2xl font-bold text-emerald-600">{area.totalProjects || 0}</span>
          <span className="text-xs text-gray-500">{area.activeProjects || 0} active</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (area) => (
        <span
          className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
            area.status === 'active'
              ? 'bg-emerald-100 text-emerald-700 shadow-sm'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          {area.status === 'active' ? '● Active' : '○ Inactive'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (area) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/crm/real-estate-areas/${area.areaId}`);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl hover:shadow-lg hover:shadow-emerald-500/30 transition-all hover:scale-105"
        >
          <Eye className="h-4 w-4" />
          <span className="font-medium">View</span>
        </button>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-emerald-600 mx-auto shadow-lg"></div>
          <p className="mt-6 text-gray-600 font-medium">Loading areas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50">
      <header className="bg-white/70 backdrop-blur-xl shadow-lg border-b border-white/20 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <button onClick={() => navigate('/crm')} className="p-2.5 hover:bg-white/80 rounded-xl transition-all">
                <ArrowLeft className="h-6 w-6 text-gray-700" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-xl shadow-emerald-500/30">
                  <MapPin className="h-7 w-7 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                    Real Estate Areas & Communities
                  </h1>
                  <p className="text-sm text-gray-600 font-medium">{filteredAreas.length} areas</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={loadAreas}
                className="flex items-center gap-2 px-4 py-2.5 bg-white/80 border border-gray-200 text-gray-700 rounded-xl hover:shadow-lg transition-all hover:scale-105"
              >
                <RefreshCw className="h-5 w-5" />
                <span className="hidden sm:inline font-medium">Refresh</span>
              </button>
              <button
                onClick={() => navigate('/crm/real-estate-areas/new')}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl hover:shadow-xl hover:shadow-emerald-500/40 transition-all hover:scale-105"
              >
                <Plus className="h-5 w-5" />
                <span className="font-semibold">Add Area</span>
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
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg">
                  <MapPin className="h-6 w-6 text-white" />
                </div>
                <TrendingUp className="h-5 w-5 text-emerald-500" />
              </div>
              <div className="text-3xl font-bold text-gray-900">{metrics.totalAreas}</div>
              <div className="text-sm text-gray-600 font-medium mt-1">Total Areas</div>
            </div>

            <div className="bg-white/70 backdrop-blur-xl rounded-3xl shadow-xl p-6 border border-white/20 hover:shadow-2xl transition-all hover:scale-105">
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center shadow-lg">
                  <Sparkles className="h-6 w-6 text-white" />
                </div>
                <TrendingUp className="h-5 w-5 text-teal-500" />
              </div>
              <div className="text-3xl font-bold text-gray-900">{metrics.activeAreas || 0}</div>
              <div className="text-sm text-gray-600 font-medium mt-1">Active Areas</div>
            </div>

            <div className="bg-white/70 backdrop-blur-xl rounded-3xl shadow-xl p-6 border border-white/20 hover:shadow-2xl transition-all hover:scale-105">
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center shadow-lg">
                  <Building className="h-6 w-6 text-white" />
                </div>
                <TrendingUp className="h-5 w-5 text-cyan-500" />
              </div>
              <div className="text-3xl font-bold text-gray-900">{metrics.totalProjects || 0}</div>
              <div className="text-sm text-gray-600 font-medium mt-1">Total Projects</div>
            </div>

            <div className="bg-white/70 backdrop-blur-xl rounded-3xl shadow-xl p-6 border border-white/20 hover:shadow-2xl transition-all hover:scale-105">
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg">
                  <Globe2 className="h-6 w-6 text-white" />
                </div>
                <TrendingUp className="h-5 w-5 text-indigo-500" />
              </div>
              <div className="text-3xl font-bold text-gray-900">{metrics.activeProjects || 0}</div>
              <div className="text-sm text-gray-600 font-medium mt-1">Active Projects</div>
            </div>
          </div>
        )}

        <div className="bg-white/70 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 overflow-hidden">
          <GlassDataTable
            data={filteredAreas}
            columns={columns}
            keyExtractor={(area) => area.areaId}
            onRowClick={(area) => navigate(`/crm/real-estate-areas/${area.areaId}`)}
            searchPlaceholder="Search areas by name, city..."
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            emptyMessage="No areas found"
            emptyIcon={<MapPin className="h-16 w-16 text-gray-300" />}
            filters={
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Country</label>
                  <select
                    value={countryFilter}
                    onChange={(e) => setCountryFilter(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/30"
                  >
                    <option value="all">All Countries</option>
                    <option value="India">India</option>
                    <option value="UAE">UAE</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
                  <select
                    value={cityFilter}
                    onChange={(e) => setCityFilter(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/30"
                  >
                    <option value="all">All Cities</option>
                    <option value="Mumbai">Mumbai</option>
                    <option value="Dubai">Dubai</option>
                    <option value="Abu Dhabi">Abu Dhabi</option>
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
