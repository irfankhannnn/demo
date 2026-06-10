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
      setProperties(Array.isArray(data) ? data : []);
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
          'for-sale': 'bg-blue-100 text-blue-700',
          'for-rent': 'bg-yellow-100 text-yellow-700',
          rented: 'bg-indigo-100 text-indigo-700',
          sold: 'bg-red-100 text-red-700',
          'on-hold': 'bg-amber-100 text-amber-700',
          'out-of-stock': 'bg-gray-100 text-gray-600',
        };
        const dotStyles: Record<string, string> = {
          available: 'bg-emerald-500',
          'for-sale': 'bg-blue-500',
          'for-rent': 'bg-yellow-500',
          rented: 'bg-indigo-500',
          sold: 'bg-red-500',
          'on-hold': 'bg-amber-500',
          'out-of-stock': 'bg-gray-400',
        };
        const statusLabels: Record<string, string> = {
          available: 'Available',
          'for-sale': 'For Sale',
          'for-rent': 'For Rent',
          rented: 'Rented',
          sold: 'Sold',
          'on-hold': 'On Hold',
          'out-of-stock': 'Out of Stock',
        };
        return (
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusStyles[property.status] || 'bg-gray-100 text-gray-600'}`}>
            <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${dotStyles[property.status] || 'bg-gray-400'}`}></span>
            {statusLabels[property.status] || property.status}
          </span>
        );
      },
    },
    {
      key: 'owner',
      header: 'Owner',
      render: (property) => {
        const p = property as any;
        const ownerName = p.ownerSnapshot?.name || p.ownerName || p.owner?.name;
        const ownerPhone = p.ownerSnapshot?.phone || p.ownerPhone || p.owner?.phone;
        return ownerName ? (
          <div className="text-sm">
            <p className="font-medium text-gray-900">{ownerName}</p>
            {ownerPhone && <p className="text-xs text-gray-500">{ownerPhone}</p>}
          </div>
        ) : (
          <span className="text-xs text-gray-400 italic">Unassigned</span>
        );
      },
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
        <label className="block text-sm font-bold text-slate-600 mb-1.5">Status</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full px-3 py-2.5 glass-premium border border-white/40 rounded-xl focus:shadow-[0_0_0_4px_rgba(168,85,247,0.10)] focus:border-purple-400 focus:outline-none transition-all duration-200 text-slate-700 font-medium"
        >
          <option value="all">All Status</option>
          <option value="available">Available</option>
          <option value="for-sale">For Sale</option>
          <option value="for-rent">For Rent</option>
          <option value="rented">Rented</option>
          <option value="sold">Sold</option>
          <option value="on-hold">On Hold</option>
          <option value="out-of-stock">Out of Stock</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-bold text-slate-600 mb-1.5">BHK</label>
        <select
          value={bhkFilter}
          onChange={(e) => setBhkFilter(e.target.value)}
          className="w-full px-3 py-2.5 glass-premium border border-white/40 rounded-xl focus:shadow-[0_0_0_4px_rgba(168,85,247,0.10)] focus:border-purple-400 focus:outline-none transition-all duration-200 text-slate-700 font-medium"
        >
          <option value="all">All BHK</option>
          {uniqueBhks.map((bhk) => (
            <option key={bhk} value={bhk}>{bhk} BHK</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-bold text-slate-600 mb-1.5">Area</label>
        <select
          value={areaFilter}
          onChange={(e) => setAreaFilter(e.target.value)}
          className="w-full px-3 py-2.5 glass-premium border border-white/40 rounded-xl focus:shadow-[0_0_0_4px_rgba(168,85,247,0.10)] focus:border-purple-400 focus:outline-none transition-all duration-200 text-slate-700 font-medium"
        >
          <option value="all">All Areas</option>
          {uniqueAreas.map((area) => (
            <option key={area} value={area}>{area}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-bold text-slate-600 mb-1.5">Owner</label>
        <select
          value={ownerFilter}
          onChange={(e) => setOwnerFilter(e.target.value)}
          className="w-full px-3 py-2.5 glass-premium border border-white/40 rounded-xl focus:shadow-[0_0_0_4px_rgba(168,85,247,0.10)] focus:border-purple-400 focus:outline-none transition-all duration-200 text-slate-700 font-medium"
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
      <header className="glass-premium border-b border-white/30 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-3 sm:py-4">
          <div className="flex justify-between items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <button
                onClick={() => navigate('/crm')}
                className="p-1.5 sm:p-2 hover:bg-white/60 rounded-xl transition-all duration-200 flex-shrink-0"
              >
                <ArrowLeft className="h-5 w-5 text-slate-500" />
              </button>
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/25 flex-shrink-0 animate-gentlePulse">
                  <Package className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-900 tracking-tight truncate">Properties</h1>
                  <p className="text-xs sm:text-sm text-slate-400 font-semibold">{filteredProperties.length} total</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              <button
                onClick={loadProperties}
                disabled={loading}
                className="p-2 sm:p-2.5 glass-premium border border-white/40 rounded-xl hover:bg-white/80 transition-all duration-200 shadow-sm"
               aria-label="Refresh data">
                <RefreshCw className={`h-4 w-4 sm:h-5 sm:w-5 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => navigate('/crm/properties/new')}
                className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl hover:from-purple-600 hover:to-indigo-700 transition-all duration-300 shadow-lg shadow-purple-500/20 hover:shadow-xl hover:shadow-purple-500/30 btn-press font-semibold"
              >
                <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="hidden sm:inline text-sm sm:text-base">Add Property</span>
                <span className="sm:hidden text-sm">New</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6 stagger-children">
          <div className="glass-premium rounded-xl sm:rounded-2xl p-3 sm:p-4 card-lift group">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/20 group-hover:scale-110 transition-transform duration-300 flex-shrink-0">
                <Building2 className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">{properties.length}</p>
                <p className="text-xs text-slate-400 font-semibold">Total Properties</p>
              </div>
            </div>
          </div>
          <div className="glass-premium rounded-xl sm:rounded-2xl p-3 sm:p-4 card-lift group">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:scale-110 transition-transform duration-300 flex-shrink-0">
                <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xl sm:text-2xl font-bold text-emerald-600 tracking-tight">{properties.filter(p => p.status === 'available' || p.status === 'for-sale' || p.status === 'for-rent').length}</p>
                <p className="text-xs text-slate-400 font-semibold">Available / Listed</p>
              </div>
            </div>
          </div>
          <div className="glass-premium rounded-xl sm:rounded-2xl p-3 sm:p-4 card-lift group">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-110 transition-transform duration-300 flex-shrink-0">
                <Home className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xl sm:text-2xl font-bold text-blue-600 tracking-tight">{properties.filter(p => p.status === 'rented').length}</p>
                <p className="text-xs text-slate-400 font-semibold">Rented</p>
              </div>
            </div>
          </div>
          <div className="glass-premium rounded-xl sm:rounded-2xl p-3 sm:p-4 card-lift group">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center shadow-lg shadow-rose-500/20 group-hover:scale-110 transition-transform duration-300 flex-shrink-0">
                <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xl sm:text-2xl font-bold text-rose-600 tracking-tight">{properties.filter(p => p.status === 'sold').length}</p>
                <p className="text-xs text-slate-400 font-semibold">Sold</p>
              </div>
            </div>
          </div>
          <div className="glass-premium rounded-xl sm:rounded-2xl p-3 sm:p-4 card-lift group">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20 group-hover:scale-110 transition-transform duration-300 flex-shrink-0">
                <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xl sm:text-2xl font-bold text-amber-600 tracking-tight">{properties.filter(p => p.status === 'on-hold').length}</p>
                <p className="text-xs text-slate-400 font-semibold">On Hold</p>
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
