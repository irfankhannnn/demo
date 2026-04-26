import { useState, useEffect } from 'react';
import { ChevronRight, Building2, Home, User, Users, MapPin, ArrowLeft, RefreshCw, FileText, ShieldCheck, AlertTriangle, CheckCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import LoadingSpinner from '../../components/LoadingSpinner';
import { api } from '../../services/api';
import { CRMProperty } from '../../types/crm';

// Helper function to calculate agreement expiry date
const calculateExpiryDate = (moveInDate?: string, tenureMonths?: number): string | null => {
  if (!moveInDate || !tenureMonths) return null;
  const date = new Date(moveInDate);
  date.setMonth(date.getMonth() + tenureMonths);
  return date.toISOString().split('T')[0];
};

// Helper function to check if agreement is expiring soon
const getExpiryStatus = (expiryDate: string | null): 'expired' | 'expiring-soon' | 'ok' | 'unknown' => {
  if (!expiryDate) return 'unknown';
  const today = new Date();
  const expiry = new Date(expiryDate);
  const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysUntilExpiry < 0) return 'expired';
  if (daysUntilExpiry <= 30) return 'expiring-soon';
  return 'ok';
};

interface HierarchyCity {
  city: string;
  areaCount: number;
  propertyCount: number;
}

interface HierarchyArea {
  area: string;
  buildingCount: number;
  propertyCount: number;
}

interface HierarchyBuilding {
  buildingName: string;
  propertyCount: number;
}

type ViewLevel = 'city' | 'area' | 'building' | 'property';

export default function Hierarchy() {
  const navigate = useNavigate();
  const [viewLevel, setViewLevel] = useState<ViewLevel>('city');
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);

  // All properties loaded once
  const [allProperties, setAllProperties] = useState<CRMProperty[]>([]);
  
  // Computed hierarchy data
  const [cities, setCities] = useState<HierarchyCity[]>([]);
  const [areas, setAreas] = useState<HierarchyArea[]>([]);
  const [buildings, setBuildings] = useState<HierarchyBuilding[]>([]);
  const [properties, setProperties] = useState<CRMProperty[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAllProperties();
  }, []);

  useEffect(() => {
    if (allProperties.length > 0) {
      computeHierarchy();
    }
  }, [allProperties, selectedCity, selectedArea, selectedBuilding, viewLevel]);

  const loadAllProperties = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getCRMProperties();
      setAllProperties(data);
    } catch (error) {
      console.error('Failed to load properties:', error);
      setError(error instanceof Error ? error.message : 'Failed to load properties');
      if (error instanceof Error && error.message.includes('token')) {
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const computeHierarchy = () => {
    if (viewLevel === 'city') {
      // Compute cities with counts
      const cityMap = new Map<string, { areaSet: Set<string>; propertyCount: number }>();
      
      allProperties.forEach(p => {
        const city = p.city || 'Unknown';
        if (!cityMap.has(city)) {
          cityMap.set(city, { areaSet: new Set(), propertyCount: 0 });
        }
        const cityData = cityMap.get(city)!;
        if (p.area) cityData.areaSet.add(p.area);
        cityData.propertyCount++;
      });

      const citiesData: HierarchyCity[] = Array.from(cityMap.entries()).map(([city, data]) => ({
        city,
        areaCount: data.areaSet.size,
        propertyCount: data.propertyCount,
      })).sort((a, b) => a.city.localeCompare(b.city));

      setCities(citiesData);
    } else if (viewLevel === 'area' && selectedCity) {
      // Compute areas for selected city
      const areaMap = new Map<string, { buildingSet: Set<string>; propertyCount: number }>();
      
      allProperties
        .filter(p => p.city === selectedCity)
        .forEach(p => {
          const area = p.area || 'Unknown';
          if (!areaMap.has(area)) {
            areaMap.set(area, { buildingSet: new Set(), propertyCount: 0 });
          }
          const areaData = areaMap.get(area)!;
          if (p.buildingName) areaData.buildingSet.add(p.buildingName);
          areaData.propertyCount++;
        });

      const areasData: HierarchyArea[] = Array.from(areaMap.entries()).map(([area, data]) => ({
        area,
        buildingCount: data.buildingSet.size,
        propertyCount: data.propertyCount,
      })).sort((a, b) => a.area.localeCompare(b.area));

      setAreas(areasData);
    } else if (viewLevel === 'building' && selectedCity && selectedArea) {
      // Compute buildings for selected area
      const buildingMap = new Map<string, number>();
      
      allProperties
        .filter(p => p.city === selectedCity && p.area === selectedArea)
        .forEach(p => {
          const building = p.buildingName || 'No Building Name';
          buildingMap.set(building, (buildingMap.get(building) || 0) + 1);
        });

      const buildingsData: HierarchyBuilding[] = Array.from(buildingMap.entries()).map(([buildingName, propertyCount]) => ({
        buildingName,
        propertyCount,
      })).sort((a, b) => a.buildingName.localeCompare(b.buildingName));

      setBuildings(buildingsData);
    } else if (viewLevel === 'property' && selectedCity && selectedArea && selectedBuilding) {
      // Filter properties for selected building
      const filteredProps = allProperties
        .filter(p => 
          p.city === selectedCity && 
          p.area === selectedArea && 
          (p.buildingName || 'No Building Name') === selectedBuilding
        )
        .sort((a, b) => {
          // Sort by floor then flat number
          const floorA = a.floor || '';
          const floorB = b.floor || '';
          if (floorA !== floorB) return floorA.localeCompare(floorB);
          return (a.flatNumber || '').localeCompare(b.flatNumber || '');
        });

      setProperties(filteredProps);
    }
  };



  const handleCityClick = (city: string) => {
    setSelectedCity(city);
    setSelectedArea(null);
    setSelectedBuilding(null);
    setViewLevel('area');
  };

  const handleAreaClick = (area: string) => {
    setSelectedArea(area);
    setSelectedBuilding(null);
    setViewLevel('building');
  };

  const handleBuildingClick = (building: string) => {
    setSelectedBuilding(building);
    setViewLevel('property');
  };

  const getBreadcrumbs = () => {
    const crumbs = ['Cities'];
    if (selectedCity) crumbs.push(selectedCity);
    if (selectedArea) crumbs.push(selectedArea);
    if (selectedBuilding) crumbs.push(selectedBuilding);
    return crumbs;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-indigo-50 flex items-center justify-center">
        <LoadingSpinner message="Loading property hierarchy..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6 bg-white/60 backdrop-blur-xl rounded-2xl border border-white/20 shadow-xl">
          <div className="text-red-500 mb-4">⚠️ Error</div>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={loadAllProperties}
            className="px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl hover:from-purple-600 hover:to-indigo-700 transition-all shadow-lg w-full"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white/70 backdrop-blur-xl border-b border-white/20 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <button
                onClick={() => navigate('/crm')}
                className="p-1.5 sm:p-2 hover:bg-white/50 rounded-xl transition-colors flex-shrink-0"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </button>
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/30 flex-shrink-0">
                  <Building2 className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 truncate">Property Hierarchy</h1>
                  <p className="text-xs sm:text-sm text-gray-500">
                    Navigate: City → Area → Building → Units
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={loadAllProperties}
              className="p-2 sm:p-2.5 bg-white/80 backdrop-blur-sm border border-white/20 rounded-xl hover:bg-white transition-all shadow-sm flex-shrink-0"
             aria-label="Refresh data">
              <RefreshCw className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">

        {/* Breadcrumbs */}
        <div className="flex items-center gap-2 text-sm px-4 py-3 bg-white/60 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-white/20 shadow-xl">
          {getBreadcrumbs().map((crumb, index) => (
            <div key={index} className="flex items-center gap-2">
              {index > 0 && <ChevronRight className="h-4 w-4 text-gray-400" />}
              <button
                onClick={() => {
                  if (index === 0) {
                    setViewLevel('city');
                    setSelectedCity(null);
                    setSelectedArea(null);
                    setSelectedBuilding(null);
                  } else if (index === 1) {
                    setSelectedArea(null);
                    setSelectedBuilding(null);
                    setViewLevel('area');
                  } else if (index === 2) {
                    setSelectedBuilding(null);
                    setViewLevel('building');
                  }
                }}
                className={`${
                  index === getBreadcrumbs().length - 1
                    ? 'text-purple-600 font-semibold'
                    : 'text-gray-600 hover:text-purple-600 transition-colors'
                }`}
              >
                {crumb}
              </button>
            </div>
          ))}
        </div>

        {/* City Level */}
        {viewLevel === 'city' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Cities ({cities.length})</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {cities.map((cityData) => (
                <button
                  key={cityData.city}
                  onClick={() => handleCityClick(cityData.city)}
                  className="p-4 bg-gray-50 border border-gray-200 rounded-lg hover:border-purple-300 hover:shadow-md transition-all text-left group"
                >
                  <div className="flex items-start gap-3">
                    <MapPin className="h-6 w-6 text-purple-600 mt-1 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 group-hover:text-purple-600 transition-colors truncate">
                        {cityData.city}
                      </h3>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        <span>{cityData.areaCount} {cityData.areaCount === 1 ? 'area' : 'areas'}</span>
                        <span>•</span>
                        <span>{cityData.propertyCount} {cityData.propertyCount === 1 ? 'property' : 'properties'}</span>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-purple-600 transition-colors flex-shrink-0" />
                  </div>
                </button>
              ))}
              {cities.length === 0 && (
                <div className="col-span-full text-center py-12">
                  <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600">No cities found. Add properties to see hierarchy.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Area Level */}
        {viewLevel === 'area' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Areas in {selectedCity} ({areas.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {areas.map((areaData) => (
                <button
                  key={areaData.area}
                  onClick={() => handleAreaClick(areaData.area)}
                  className="p-4 bg-gray-50 border border-gray-200 rounded-lg hover:border-purple-300 hover:shadow-md transition-all text-left group"
                >
                  <div className="flex items-start gap-3">
                    <Building2 className="h-6 w-6 text-purple-600 mt-1 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 group-hover:text-purple-600 transition-colors truncate">
                        {areaData.area}
                      </h3>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        <span>{areaData.buildingCount} {areaData.buildingCount === 1 ? 'building' : 'buildings'}</span>
                        <span>•</span>
                        <span>{areaData.propertyCount} {areaData.propertyCount === 1 ? 'unit' : 'units'}</span>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-purple-600 transition-colors flex-shrink-0" />
                  </div>
                </button>
              ))}
              {areas.length === 0 && (
                <div className="col-span-full text-center py-12">
                  <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600">No areas found in this city</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Building Level */}
        {viewLevel === 'building' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Buildings in {selectedArea} ({buildings.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {buildings.map((buildingData) => (
                <button
                  key={buildingData.buildingName}
                  onClick={() => handleBuildingClick(buildingData.buildingName)}
                  className="p-4 bg-gray-50 border border-gray-200 rounded-lg hover:border-purple-300 hover:shadow-md transition-all text-left group"
                >
                  <div className="flex items-start gap-3">
                    <Home className="h-6 w-6 text-purple-600 mt-1 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 group-hover:text-purple-600 transition-colors truncate">
                        {buildingData.buildingName}
                      </h3>
                      <p className="text-xs text-gray-500 mt-1">
                        {buildingData.propertyCount} {buildingData.propertyCount === 1 ? 'unit' : 'units'}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-purple-600 transition-colors flex-shrink-0" />
                  </div>
                </button>
              ))}
              {buildings.length === 0 && (
                <div className="col-span-full text-center py-12">
                  <Home className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600">No buildings found in this area</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Property Level */}
        {viewLevel === 'property' && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-900">
                Units in {selectedBuilding} ({properties.length})
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Unit
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Floor
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      BHK
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Rent
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Owner
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Tenant
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      <FileText className="inline h-3.5 w-3.5 mr-1" />
                      Agreement
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      <ShieldCheck className="inline h-3.5 w-3.5 mr-1" />
                      Police Ver.
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Expiry
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {properties.map((property) => (
                    <tr key={property.propertyId} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {property.flatNumber || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {property.floor || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {property.bhk} BHK
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        ₹{property.rentAmount?.toLocaleString() || '0'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          property.status === 'available' ? 'bg-green-100 text-green-800' :
                          property.status === 'rented' ? 'bg-blue-100 text-blue-800' :
                          property.status === 'on_hold' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {property.status?.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {property.ownerId && property.owner ? (
                          <Link
                            to={`/crm/owners/${property.ownerId}`}
                            className="text-purple-600 hover:text-purple-800 hover:underline flex items-center gap-1 font-medium"
                          >
                            <User className="h-3.5 w-3.5" />
                            {property.owner.name}
                          </Link>
                        ) : (
                          <span className="text-gray-400 text-xs">Unassigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {property.tenantCustomerId && property.tenant ? (
                          <Link
                            to={`/crm/tenants/${property.tenantCustomerId}`}
                            className="text-purple-600 hover:text-purple-800 hover:underline flex items-center gap-1 font-medium"
                          >
                            <Users className="h-3.5 w-3.5" />
                            {property.tenant.name}
                          </Link>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </td>
                      {/* Agreement Status */}
                      <td className="px-4 py-3 text-sm">
                        {property.agreementStatus === 'done' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircle className="h-3 w-3" />
                            Done
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            <AlertTriangle className="h-3 w-3" />
                            Pending
                          </span>
                        )}
                        {property.tenantMoveInDate && (
                          <div className="text-xs text-gray-500 mt-1">
                            {new Date(property.tenantMoveInDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </div>
                        )}
                      </td>
                      {/* Police Verification Status */}
                      <td className="px-4 py-3 text-sm">
                        {property.verificationStatus === 'done' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircle className="h-3 w-3" />
                            Done
                          </span>
                        ) : property.verificationStatus === 'not_done' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            Not Done
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            <AlertTriangle className="h-3 w-3" />
                            Pending
                          </span>
                        )}
                      </td>
                      {/* Agreement Expiry */}
                      <td className="px-4 py-3 text-sm">
                        {(() => {
                          const expiryDate = calculateExpiryDate(property.tenantMoveInDate, property.tenureMonths);
                          const status = getExpiryStatus(expiryDate);
                          if (!expiryDate) return <span className="text-gray-400 text-xs">-</span>;
                          return (
                            <div>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                status === 'expired' ? 'bg-red-100 text-red-800' :
                                status === 'expiring-soon' ? 'bg-orange-100 text-orange-800' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {new Date(expiryDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </span>
                              {status === 'expired' && <div className="text-xs text-red-600 mt-1">Expired!</div>}
                              {status === 'expiring-soon' && <div className="text-xs text-orange-600 mt-1">Expiring soon</div>}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <Link
                          to={`/crm/properties/${property.propertyId}`}
                          className="text-purple-600 hover:text-purple-800 font-medium hover:underline"
                        >
                          View Details →
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {properties.length === 0 && (
                    <tr>
                      <td colSpan={11} className="px-4 py-12 text-center text-gray-500">
                        No properties found in this building
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
