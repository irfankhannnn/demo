import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package,
  Plus,
  Edit,
  MapPin,
  IndianRupee,
  ArrowLeft,
  Home,
  RefreshCw,
  Building2,
  CheckCircle,
  Clock,
} from 'lucide-react';
import { api } from '../../services/api';
import { CRMProperty } from '../../types/crm';
import GlassDataTable, { Column } from '../../components/GlassDataTable';

export default function PropertyList() {
  const navigate = useNavigate();
  const [properties, setProperties] = useState<CRMProperty[]>([]);
  const [filteredProperties, setFilteredProperties] = useState<CRMProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [bhkFilter, setBhkFilter] = useState<string>('all');
  const [areaFilter, setAreaFilter] = useState<string>('all');
  const [ownerFilter, setOwnerFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  const uniqueAreas = [...new Set(properties.map(p => p.area).filter(Boolean))].sort();
  const uniqueBhks = [...new Set(properties.map(p => p.bhk).filter(Boolean))].sort((a, b) => a - b);

  useEffect(() => {
    loadProperties();
  }, [statusFilter]);

  useEffect(() => {
    applyFilters();
  }, [properties, searchQuery, bhkFilter, areaFilter, ownerFilter]);

  const loadProperties = async () => {
    try {
      setLoading(true);
      const status = statusFilter !== 'all' ? statusFilter : undefined;
      const data = await api.getCRMProperties(status);
      setProperties(data);
    } catch (error) {
      console.error('Error loading properties:', error);
      if (error instanceof Error && error.message.includes('token')) {
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...properties];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.title.toLowerCase().includes(query) ||
          p.area.toLowerCase().includes(query) ||
          p.city.toLowerCase().includes(query) ||
          p.address?.toLowerCase().includes(query) ||
          (p as any).buildingName?.toLowerCase().includes(query) ||
          p.owner?.name?.toLowerCase().includes(query) ||
          p.owner?.phone?.includes(query)
      );
    }

    if (bhkFilter !== 'all') {
      filtered = filtered.filter((p) => p.bhk === parseInt(bhkFilter));
    }

    if (areaFilter !== 'all') {
      filtered = filtered.filter((p) => p.area === areaFilter);
    }

    if (ownerFilter === 'unassigned') {
      filtered = filtered.filter((p) => !p.ownerId);
    } else if (ownerFilter === 'assigned') {
      filtered = filtered.filter((p) => !!p.ownerId);
    }

    filtered.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    setFilteredProperties(filtered);
  };

  const columns: Column<CRMProperty>[] = [
    {
      key: 'title',
      header: 'Property',
      sortable: true,
      render: (property) => (
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-xl overflow-hidden bg-gradient-to-br from-purple-100 to-indigo-100 flex-shrink-0 shadow-md">
            {property.images && property.images.length > 0 ? (
              <img
                src={property.images[0].url || ''}
                alt={property.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Home className="h-6 w-6 text-purple-400" />
              </div>
            )}
          </div>
          <div>
            <p className="font-medium text-gray-900 line-clamp-1">{property.title}</p>
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {property.area}, {property.city}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'bhk',
      header: 'BHK',
      sortable: true,
      render: (property) => (
        <span className="px-2.5 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
          {property.bhk} BHK
        </span>
      ),
    },
    {
      key: 'rentAmount',
      header: 'Rent',
      sortable: true,
      render: (property) => (
        <div className="flex items-center gap-1 font-semibold text-gray-900">
          <IndianRupee className="h-4 w-4 text-gray-500" />
          {Number.isFinite(Number(property.rentAmount)) ? `${Number(property.rentAmount).toLocaleString('en-IN')}/mo` : '-'}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (property) => {
        const statusStyles: Record<string, string> = {
          available: 'bg-emerald-100 text-emerald-700',
          on_hold: 'bg-amber-100 text-amber-700',
          out_of_stock: 'bg-gray-100 text-gray-600',
          rented: 'bg-blue-100 text-blue-700',
        };
        const dotStyles: Record<string, string> = {
          available: 'bg-emerald-500',
          on_hold: 'bg-amber-500',
          out_of_stock: 'bg-gray-400',
          rented: 'bg-blue-500',
        };
        return (
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusStyles[property.status] || 'bg-gray-100 text-gray-600'}`}>
            <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${dotStyles[property.status] || 'bg-gray-400'}`}></span>
            {property.status.replace('_', ' ')}
          </span>
        );
      },
    },
    {
      key: 'owner',
      header: 'Owner',
      render: (property) => property.owner ? (
        <div className="text-sm">
          <p className="font-medium text-gray-900">{property.owner.name}</p>
          <p className="text-xs text-gray-500">{property.owner.phone}</p>
        </div>
      ) : (
        <span className="text-xs text-gray-400 italic">Unassigned</span>
      ),
    },
    {
      key: 'tenant',
      header: 'Tenant',
      render: (property) => property.tenant ? (
        <div className="text-sm">
          <p className="font-medium text-gray-900">{property.tenant.name}</p>
          <p className="text-xs text-gray-500">{property.tenant.phone}</p>
        </div>
      ) : (
        <span className="text-xs text-gray-400">-</span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      width: '100px',
      render: (property) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/crm/properties/${property.propertyId}`);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg hover:from-purple-600 hover:to-indigo-700 transition-all duration-200 shadow-md shadow-purple-500/20 hover:shadow-lg hover:shadow-purple-500/30 text-sm font-medium"
        >
          <Edit className="h-3.5 w-3.5" />
          Edit
        </button>
      ),
    },
  ];

  const filterContent = (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full px-3 py-2 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-all"
        >
          <option value="all">All Status</option>
          <option value="available">Available</option>
          <option value="on_hold">On Hold</option>
          <option value="out_of_stock">Out of Stock</option>
          <option value="rented">Rented</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">BHK</label>
        <select
          value={bhkFilter}
          onChange={(e) => setBhkFilter(e.target.value)}
          className="w-full px-3 py-2 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-all"
        >
          <option value="all">All BHK</option>
          {uniqueBhks.map((bhk) => (
            <option key={bhk} value={bhk}>{bhk} BHK</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Area</label>
        <select
          value={areaFilter}
          onChange={(e) => setAreaFilter(e.target.value)}
          className="w-full px-3 py-2 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-all"
        >
          <option value="all">All Areas</option>
          {uniqueAreas.map((area) => (
            <option key={area} value={area}>{area}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Owner</label>
        <select
          value={ownerFilter}
          onChange={(e) => setOwnerFilter(e.target.value)}
          className="w-full px-3 py-2 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-all"
        >
          <option value="all">All Owners</option>
          <option value="assigned">Has Owner</option>
          <option value="unassigned">Unassigned</option>
        </select>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white/70 backdrop-blur-xl border-b border-white/20 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-3 sm:py-4">
          <div className="flex justify-between items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <button
                onClick={() => navigate('/crm')}
                className="p-1.5 sm:p-2 hover:bg-white/50 rounded-xl transition-colors flex-shrink-0"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </button>
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/30 flex-shrink-0">
                  <Package className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 truncate">Properties</h1>
                  <p className="text-xs sm:text-sm text-gray-500">{filteredProperties.length} total</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              <button
                onClick={loadProperties}
                disabled={loading}
                className="p-2 sm:p-2.5 bg-white/80 backdrop-blur-sm border border-white/20 rounded-xl hover:bg-white transition-all shadow-sm"
              >
                <RefreshCw className={`h-4 w-4 sm:h-5 sm:w-5 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => navigate('/crm/properties/new')}
                className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl hover:from-purple-600 hover:to-indigo-700 transition-all shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40"
              >
                <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="hidden sm:inline font-medium text-sm sm:text-base">Add Property</span>
                <span className="sm:hidden font-medium text-sm">New</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="bg-white/60 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-white/20 p-3 sm:p-4 shadow-xl shadow-gray-200/30 hover:shadow-2xl transition-all duration-300 group">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/30 group-hover:scale-110 transition-transform flex-shrink-0">
                <Building2 className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xl sm:text-2xl font-bold text-gray-900">{properties.length}</p>
                <p className="text-xs text-gray-500">Total Properties</p>
              </div>
            </div>
          </div>
          <div className="bg-white/60 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-white/20 p-3 sm:p-4 shadow-xl shadow-gray-200/30 hover:shadow-2xl transition-all duration-300 group">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30 group-hover:scale-110 transition-transform flex-shrink-0">
                <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xl sm:text-2xl font-bold text-emerald-600">{properties.filter(p => p.status === 'available').length}</p>
                <p className="text-xs text-gray-500">Available</p>
              </div>
            </div>
          </div>
          <div className="bg-white/60 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-white/20 p-3 sm:p-4 shadow-xl shadow-gray-200/30 hover:shadow-2xl transition-all duration-300 group">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30 group-hover:scale-110 transition-transform flex-shrink-0">
                <Home className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xl sm:text-2xl font-bold text-blue-600">{properties.filter(p => p.status === 'rented').length}</p>
                <p className="text-xs text-gray-500">Rented</p>
              </div>
            </div>
          </div>
          <div className="bg-white/60 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-white/20 p-3 sm:p-4 shadow-xl shadow-gray-200/30 hover:shadow-2xl transition-all duration-300 group">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/30 group-hover:scale-110 transition-transform flex-shrink-0">
                <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xl sm:text-2xl font-bold text-amber-600">{properties.filter(p => p.status === 'on_hold').length}</p>
                <p className="text-xs text-gray-500">On Hold</p>
              </div>
            </div>
          </div>
        </div>

        {/* Properties Table */}
        <GlassDataTable
          data={filteredProperties}
          columns={columns}
          keyExtractor={(property) => property.propertyId}
          onRowClick={(property) => navigate(`/crm/properties/${property.propertyId}`)}
          searchPlaceholder="Search by title, area, owner name or phone..."
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          loading={loading}
          emptyMessage={searchQuery || statusFilter !== 'all' ? 'No properties match your search' : 'No properties yet'}
          filters={filterContent}
          showFilters={showFilters}
          onToggleFilters={() => setShowFilters(!showFilters)}
        />
      </main>
    </div>
  );
}
