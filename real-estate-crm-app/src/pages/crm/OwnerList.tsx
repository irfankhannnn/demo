import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Building2,
  Plus,
  Eye,
  Phone,
  Mail,
  ArrowLeft,
  RefreshCw,
  Calendar,
  Home as HomeIcon,
  Users,
  UserCheck,
  Building,
  MapPin,
  Tag,
  Search,
  Filter,
} from 'lucide-react';
import { api } from '../../services/api';
import { PhoneNumber } from '../../components/PhoneNumber';
import { CRMOwner, CRMProperty } from '../../types/crm';
import GlassDataTable, { Column } from '../../components/GlassDataTable';
import { formatPropertyMarketPrice } from '../../utils/propertyPricing';

interface SellerPropertySummary {
  propertyId: string;
  title: string;
  area: string;
  city: string;
  bhk?: number;
  propertyType?: string;
  status: string;
  listedPrice?: number | null;
  expectedRent?: number | null;
}

interface OwnerWithMeeting extends CRMOwner {
  nextMeeting?: {
    meetingId: string;
    meetingDate: string;
    meetingTime: string;
    title: string;
  };
  propertyCount?: number;
  contactId?: string;
  sellerLifecycle?: string;
  sellingProperties?: SellerPropertySummary[];
  activeListingCount?: number;
}

function toSellerPropertySummary(property: CRMProperty): SellerPropertySummary {
  return {
    propertyId: property.propertyId,
    title: property.title || 'Property',
    area: property.area || '',
    city: property.city || '',
    bhk: property.bhk,
    propertyType: property.propertyType,
    status: property.status,
    listedPrice: property.saleInfo?.listedPrice ?? null,
    expectedRent: property.rentalInfo?.expectedRent ?? property.rentAmount ?? null,
  };
}

/** Sellers page = sale pipeline only (not rent/occupancy). */
function isSellerPageProperty(status: string) {
  const s = String(status || '').toLowerCase();
  return s !== 'for-rent' && s !== 'rented';
}

function isForSaleListing(status: string) {
  return String(status || '').toLowerCase() === 'for-sale';
}

function propertyStatusBadge(property: SellerPropertySummary) {
  const { status } = property;
  const marketPrice = formatPropertyMarketPrice({
    status,
    saleInfo: { listedPrice: property.listedPrice ?? null },
    rentalInfo: { expectedRent: property.expectedRent ?? null },
    rentAmount: property.expectedRent ?? null,
  });

  if (status === 'for-sale') {
    return {
      label: 'For Sale',
      price: marketPrice !== 'N/A' ? marketPrice : null,
      className: 'bg-blue-50 text-blue-700',
    };
  }
  if (status === 'for-rent') {
    return {
      label: 'For Rent',
      price: marketPrice !== 'N/A' ? marketPrice : null,
      className: 'bg-amber-50 text-amber-800',
    };
  }
  if (status === 'rented') {
    return { label: 'Occupied', price: null, className: 'bg-indigo-50 text-indigo-700' };
  }
  if (status === 'sold') {
    return { label: 'Sold', price: null, className: 'bg-slate-100 text-slate-600' };
  }
  return { label: 'Not Listed', price: null, className: 'bg-slate-100 text-slate-600' };
}

export default function OwnerList() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sellersOnly = searchParams.get('sellers') === '1';
  const [owners, setOwners] = useState<OwnerWithMeeting[]>([]);
  const [filteredOwners, setFilteredOwners] = useState<OwnerWithMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadOwners();
  }, [sellersOnly, statusFilter]);

  useEffect(() => {
    applyFilters();
  }, [owners, searchQuery, statusFilter]);

  const loadOwners = async () => {
    try {
      setLoading(true);

      // Sellers = active seller relationship (matches dashboard metrics + /crm/owners?seller=true)
      if (sellersOnly) {
        const [sellersData, allProperties, upcomingMeetings] = await Promise.all([
          api.getOwners({ seller: true, status: 'all' }),
          api.getCRMProperties(),
          api.getUpcomingMeetings(30),
        ]);

        const propertiesByOwner = new Map<string, SellerPropertySummary[]>();
        for (const property of allProperties) {
          if (!property.ownerId) continue;
          const list = propertiesByOwner.get(property.ownerId) || [];
          list.push(toSellerPropertySummary(property));
          propertiesByOwner.set(property.ownerId, list);
        }

        const sellersWithMeetings = sellersData.map((owner: CRMOwner) => {
          const ownerProperties = (propertiesByOwner.get(owner.ownerId) || [])
            .filter((p) => isSellerPageProperty(p.status));
          const sortedProperties = [...ownerProperties].sort((a, b) => {
            const aListed = isForSaleListing(a.status) ? 0 : 1;
            const bListed = isForSaleListing(b.status) ? 0 : 1;
            if (aListed !== bListed) return aListed - bListed;
            return a.title.localeCompare(b.title);
          });

          const nextMeeting = upcomingMeetings
            .filter((m: any) =>
              (m.relatedEntityType === 'owner' && m.relatedEntityId === owner.ownerId)
              || (m.relatedEntityType === 'contact' && m.relatedEntityId === owner.contactId)
            )
            .sort((a: any, b: any) => new Date(`${a.meetingDate} ${a.meetingTime}`).getTime() - new Date(`${b.meetingDate} ${b.meetingTime}`).getTime())[0];

          return {
            ...owner,
            sellerLifecycle: (owner as OwnerWithMeeting).sellerLifecycle || 'active',
            sellingProperties: sortedProperties,
            propertyCount: sortedProperties.length,
            activeListingCount: sortedProperties.filter((p) => isForSaleListing(p.status)).length,
            nextMeeting: nextMeeting ? {
              meetingId: nextMeeting.meetingId,
              meetingDate: nextMeeting.meetingDate,
              meetingTime: nextMeeting.meetingTime,
              title: nextMeeting.title,
            } : undefined,
          };
        });
        setOwners(sellersWithMeetings);
        return;
      }

      const [ownersData, upcomingMeetings] = await Promise.all([
        api.getOwners(statusFilter === 'all' ? { status: 'all' } : { status: statusFilter }),
        api.getUpcomingMeetings(30),
      ]);

      const ownersWithMeetings = ownersData.map((owner: CRMOwner) => {
        const nextMeeting = upcomingMeetings
          .filter((m: any) => m.relatedEntityType === 'owner' && m.relatedEntityId === owner.ownerId)
          .sort((a: any, b: any) => new Date(`${a.meetingDate} ${a.meetingTime}`).getTime() - new Date(`${b.meetingDate} ${b.meetingTime}`).getTime())[0];

        return {
          ...owner,
          nextMeeting: nextMeeting ? {
            meetingId: nextMeeting.meetingId,
            meetingDate: nextMeeting.meetingDate,
            meetingTime: nextMeeting.meetingTime,
            title: nextMeeting.title,
          } : undefined,
        };
      });

      setOwners(ownersWithMeetings);
    } catch (error) {
      console.error('Error loading owners:', error);
      if (error instanceof Error && error.message.includes('token')) {
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...owners];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((o) => {
        const ownerMatch =
          o.name.toLowerCase().includes(query) ||
          o.phone?.includes(query) ||
          o.email?.toLowerCase().includes(query) ||
          o.address?.toLowerCase().includes(query);

        if (ownerMatch) return true;

        if (sellersOnly && (o as OwnerWithMeeting).sellingProperties?.length) {
          return (o as OwnerWithMeeting).sellingProperties!.some((p) =>
            p.title.toLowerCase().includes(query) ||
            p.area.toLowerCase().includes(query) ||
            p.city.toLowerCase().includes(query)
          );
        }

        return false;
      });
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((o) =>
        sellersOnly
          ? ((o as OwnerWithMeeting).sellerLifecycle || 'active') === statusFilter
          : o.status === statusFilter
      );
    }

    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setFilteredOwners(filtered);
  };

  const formatMeetingDate = (dateString: string, timeString: string) => {
    const meetingDateTime = new Date(`${dateString} ${timeString}`);
    const now = new Date();
    const diff = meetingDateTime.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    if (days > 1 && days < 7) return `In ${days} days`;
    return meetingDateTime.toLocaleDateString();
  };

  const columns: Column<OwnerWithMeeting>[] = [
    {
      key: 'name',
      header: 'Owner',
      sortable: true,
      render: (owner) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/20">
            <span className="text-white font-semibold text-sm">
              {owner.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="font-medium text-gray-900">{owner.name}</p>
            {owner.email && (
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {owner.email}
              </p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'Phone',
      sortable: true,
      render: (owner) => (
        <div className="flex items-center gap-2">
          <Phone className="h-4 w-4 text-gray-400" />
          <PhoneNumber value={owner.phone} masked={owner.phoneMasked} entityType="owner" entityId={owner.ownerId} showCallButton compact fallback="-" />
        </div>
      ),
    },
    {
      key: 'propertyCount',
      header: 'Properties',
      sortable: true,
      render: (owner) => (
        <div className="flex items-center gap-2">
          <div className={`px-2.5 py-1 rounded-full text-xs font-medium ${
            (owner.propertyCount || 0) > 0
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-500'
          }`}>
            <HomeIcon className="h-3 w-3 inline mr-1" />
            {owner.propertyCount || 0}
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (owner) => (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
          (sellersOnly ? (owner as OwnerWithMeeting).sellerLifecycle : owner.status) === 'active'
            ? 'bg-emerald-100 text-emerald-700'
            : (owner as OwnerWithMeeting).sellerLifecycle === 'past'
              ? 'bg-slate-100 text-slate-700'
              : 'bg-gray-100 text-gray-600'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
            (sellersOnly ? (owner as OwnerWithMeeting).sellerLifecycle : owner.status) === 'active'
              ? 'bg-emerald-500'
              : 'bg-gray-400'
          }`}></span>
          {sellersOnly
            ? ((owner as OwnerWithMeeting).sellerLifecycle || 'active')
            : owner.status}
        </span>
      ),
    },
    {
      key: 'nextMeeting',
      header: 'Next Meeting',
      render: (owner) => owner.nextMeeting ? (
        <div className="flex items-center gap-2 text-xs">
          <Calendar className="h-4 w-4 text-blue-500" />
          <span className="text-blue-600 font-medium">
            {formatMeetingDate(owner.nextMeeting.meetingDate, owner.nextMeeting.meetingTime)}
          </span>
        </div>
      ) : (
        <span className="text-gray-400 text-xs">-</span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      width: '100px',
      render: (owner) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(sellersOnly && (owner as OwnerWithMeeting).contactId
              ? `/crm/contacts/${(owner as OwnerWithMeeting).contactId}`
              : `/crm/owners/${owner.ownerId}`);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 text-sm font-medium"
        >
          <Eye className="h-3.5 w-3.5" />
          View
        </button>
      ),
    },
  ];

  const filterContent = (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-bold text-slate-600 mb-1.5">Status</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full px-3 py-2.5 glass-premium border border-white/40 rounded-xl focus:shadow-[0_0_0_4px_rgba(59,130,246,0.10)] focus:border-blue-400 focus:outline-none transition-all duration-200 text-slate-700 font-medium"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>
    </div>
  );

  const totalActiveListings = owners.reduce(
    (sum, o) => sum + ((o as OwnerWithMeeting).activeListingCount || 0),
    0,
  );
  const totalNotListedYet = owners.reduce(
    (sum, o) => sum + ((o as OwnerWithMeeting).sellingProperties?.filter((p) => !isForSaleListing(p.status)).length || 0),
    0,
  );

  const sellerCards = (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search seller, property, area..."
            className="w-full pl-10 pr-4 py-2.5 glass-premium border border-white/40 rounded-xl focus:shadow-[0_0_0_4px_rgba(59,130,246,0.10)] focus:border-blue-400 focus:outline-none text-slate-700"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 glass-premium border border-white/40 rounded-xl hover:bg-white/80 text-slate-600 font-medium"
        >
          <Filter className="h-4 w-4" />
          Filters
        </button>
      </div>

      {showFilters && (
        <div className="glass-premium rounded-xl p-4 border border-white/40">
          {filterContent}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      ) : filteredOwners.length === 0 ? (
        <div className="text-center py-16 glass-premium rounded-2xl border border-dashed border-slate-200">
          <Users className="h-12 w-12 mx-auto text-slate-300 mb-3" />
          <p className="text-slate-600 font-medium">
            {searchQuery || statusFilter !== 'all' ? 'No sellers match your search' : 'No sellers yet'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {(filteredOwners as OwnerWithMeeting[]).map((seller) => (
            <div
              key={seller.ownerId}
              className="glass-premium rounded-2xl border border-white/40 overflow-hidden card-lift"
            >
              <div className="p-4 sm:p-5 border-b border-white/30 bg-white/30">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-500/20">
                      <span className="text-white font-semibold text-sm">
                        {seller.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-slate-900 truncate">{seller.name}</h3>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700">
                          {seller.sellerLifecycle || 'active'} seller
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-slate-500">
                        {seller.phone && (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="h-3.5 w-3.5" />
                            <PhoneNumber value={seller.phone} masked={seller.phoneMasked} entityType="owner" entityId={seller.ownerId} showCallButton compact />
                          </span>
                        )}
                        {seller.email && (
                          <span className="inline-flex items-center gap-1 truncate">
                            <Mail className="h-3.5 w-3.5" />
                            {seller.email}
                          </span>
                        )}
                      </div>
                      {seller.nextMeeting && (
                        <p className="text-xs text-blue-600 mt-1 inline-flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          Next meeting: {formatMeetingDate(seller.nextMeeting.meetingDate, seller.nextMeeting.meetingTime)}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(`/crm/owners/${seller.ownerId}`)}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:from-blue-600 hover:to-indigo-700 text-sm font-medium shadow-md shadow-blue-500/20"
                  >
                    <Eye className="h-4 w-4" />
                    View Seller
                  </button>
                </div>
              </div>

              <div className="p-4 sm:p-5">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Tag className="h-4 w-4 text-blue-500" />
                    For Sale ({seller.sellingProperties?.filter((p) => isForSaleListing(p.status)).length || 0})
                    {(seller.sellingProperties?.filter((p) => !isForSaleListing(p.status)).length || 0) > 0 && (
                      <span className="text-xs font-normal text-slate-400">
                        · {(seller.sellingProperties?.filter((p) => !isForSaleListing(p.status)).length || 0)} not listed yet
                      </span>
                    )}
                  </h4>
                  {(seller.activeListingCount || 0) > 0 && (
                    <span className="text-xs font-medium text-blue-600">
                      {seller.activeListingCount} live listing{(seller.activeListingCount || 0) > 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {!seller.sellingProperties?.length ? (
                  <p className="text-sm text-slate-500 py-2">No sale properties yet. Rent listings appear under Owners.</p>
                ) : (
                  <div className="space-y-2">
                    {seller.sellingProperties.map((property) => {
                      const badge = propertyStatusBadge(property);
                      return (
                        <button
                          key={property.propertyId}
                          type="button"
                          onClick={() => navigate(`/crm/properties/${property.propertyId}`)}
                          className="w-full text-left rounded-xl border border-slate-200/80 bg-white/50 hover:border-blue-200 hover:bg-blue-50/30 transition-all p-3"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-medium text-slate-900 truncate">{property.title}</p>
                              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                                <MapPin className="h-3 w-3 flex-shrink-0" />
                                {[property.area, property.city].filter(Boolean).join(', ') || '—'}
                                {property.bhk ? ` · ${property.bhk} BHK` : ''}
                                {property.propertyType
                                  ? ` · ${property.propertyType.charAt(0).toUpperCase()}${property.propertyType.slice(1)}`
                                  : ''}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium ${badge.className}`}>
                                {badge.label}
                                {badge.price ? ` · ${badge.price}` : ''}
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ))}
          <p className="text-xs text-slate-400 text-center pt-2">
            Showing {filteredOwners.length} seller{filteredOwners.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
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
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25 flex-shrink-0 animate-gentlePulse">
                  <Building2 className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-900 tracking-tight truncate">{sellersOnly ? 'Sellers' : 'Owners'}</h1>
                  <p className="text-xs sm:text-sm text-slate-400 font-semibold">{filteredOwners.length} total</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              <button
                onClick={loadOwners}
                disabled={loading}
                className="p-2 sm:p-2.5 glass-premium border border-white/40 rounded-xl hover:bg-white/80 transition-all duration-200 shadow-sm"
               aria-label="Refresh data">
                <RefreshCw className={`h-4 w-4 sm:h-5 sm:w-5 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => navigate(sellersOnly ? '/crm/leads/new?type=seller' : '/crm/owners/new')}
                className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all duration-300 shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30 btn-press font-semibold"
              >
                <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="hidden sm:inline text-sm sm:text-base">{sellersOnly ? 'Add Seller Lead' : 'Add Owner'}</span>
                <span className="sm:hidden text-sm">New</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6">
        {/* Stats Cards */}
        <div className={`grid gap-3 sm:gap-4 mb-4 sm:mb-6 stagger-children ${sellersOnly ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'}`}>
          <div className="glass-premium rounded-xl sm:rounded-2xl p-3 sm:p-4 card-lift group">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-110 transition-transform duration-300 flex-shrink-0">
                <Users className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">{owners.length}</p>
                <p className="text-xs text-slate-400 font-semibold">{sellersOnly ? 'Active Sellers' : 'Total Owners'}</p>
              </div>
            </div>
          </div>
          <div className="glass-premium rounded-xl sm:rounded-2xl p-3 sm:p-4 card-lift group">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br ${sellersOnly ? 'from-blue-500 to-indigo-600' : 'from-emerald-500 to-emerald-600'} flex items-center justify-center shadow-lg ${sellersOnly ? 'shadow-blue-500/20' : 'shadow-emerald-500/20'} group-hover:scale-110 transition-transform duration-300 flex-shrink-0`}>
                {sellersOnly ? <Tag className="h-5 w-5 sm:h-6 sm:w-6 text-white" /> : <UserCheck className="h-5 w-5 sm:h-6 sm:w-6 text-white" />}
              </div>
              <div className="min-w-0">
                <p className={`text-xl sm:text-2xl font-bold tracking-tight ${sellersOnly ? 'text-blue-600' : 'text-emerald-600'}`}>
                  {sellersOnly ? totalActiveListings : owners.filter(o => o.status === 'active').length}
                </p>
                <p className="text-xs text-slate-400 font-semibold">{sellersOnly ? 'Live For-Sale' : 'Active'}</p>
              </div>
            </div>
          </div>
          {!sellersOnly && (
            <div className="glass-premium rounded-xl sm:rounded-2xl p-3 sm:p-4 card-lift group col-span-2 sm:col-span-1">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/20 group-hover:scale-110 transition-transform duration-300 flex-shrink-0">
                  <Building className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-xl sm:text-2xl font-bold text-purple-600 tracking-tight">
                    {owners.filter(o => (o.propertyCount || 0) > 0).length}
                  </p>
                  <p className="text-xs text-slate-400 font-semibold">With Properties</p>
                </div>
              </div>
            </div>
          )}
        </div>
        {sellersOnly && totalNotListedYet > 0 && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-4 sm:mb-6">
            {totalNotListedYet} sale propert{totalNotListedYet === 1 ? 'y' : 'ies'} not listed yet — ready to push live.
          </p>
        )}

        {sellersOnly ? sellerCards : (
        <GlassDataTable
          data={filteredOwners}
          columns={columns}
          keyExtractor={(owner) => owner.ownerId}
          onRowClick={(owner) => navigate(`/crm/owners/${owner.ownerId}`)}
          searchPlaceholder="Search by name, phone, email, or address..."
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          loading={loading}
          emptyMessage={searchQuery || statusFilter !== 'all' ? 'No owners match your search' : 'No owners yet'}
          filters={filterContent}
          showFilters={showFilters}
          onToggleFilters={() => setShowFilters(!showFilters)}
        />
        )}
      </main>
    </div>
  );
}
