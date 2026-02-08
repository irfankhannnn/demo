import { useState } from 'react';
import { GoogleMap, Marker, InfoWindow } from '@react-google-maps/api';
import { MapPin, Home, IndianRupee, Bed } from 'lucide-react';
import { useGoogleMaps } from '../contexts/GoogleMapsContext';

interface Property {
  propertyId: string;
  title: string;
  latitude: number | null;
  longitude: number | null;
  rentAmount?: number;
  bhk?: number;
  area?: string;
  city?: string;
  status?: string;
}

interface PropertiesMapViewProps {
  properties: Property[];
  onPropertyClick?: (propertyId: string) => void;
}

const mapContainerStyle = {
  width: '100%',
  height: '600px',
};

const defaultCenter = {
  lat: 19.0760,
  lng: 72.8777,
};

export default function PropertiesMapView({ properties, onPropertyClick }: PropertiesMapViewProps) {
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);

  // Filter properties that have valid coordinates
  const propertiesWithLocation = properties.filter(
    (p) => p.latitude !== null && p.longitude !== null
  );

  // Calculate center based on properties
  const center = propertiesWithLocation.length > 0
    ? {
        lat: propertiesWithLocation.reduce((sum, p) => sum + (p.latitude || 0), 0) / propertiesWithLocation.length,
        lng: propertiesWithLocation.reduce((sum, p) => sum + (p.longitude || 0), 0) / propertiesWithLocation.length,
      }
    : defaultCenter;

  const { isLoaded } = useGoogleMaps();

  if (!isLoaded) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <div className="text-center">
          <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Loading Map</h3>
          <p className="text-gray-600">Initializing Google Maps...</p>
        </div>
      </div>
    );
  }

  if (propertiesWithLocation.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <div className="text-center">
          <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Properties with Location</h3>
          <p className="text-gray-600">Add location coordinates to properties to see them on the map</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-4 border-b bg-gray-50">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Properties Map View</h3>
            <p className="text-sm text-gray-600 mt-1">
              Showing {propertiesWithLocation.length} of {properties.length} properties
            </p>
          </div>
        </div>
      </div>

      {isLoaded ? (
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={center}
          zoom={12}
          options={{
            streetViewControl: false,
            mapTypeControl: true,
            fullscreenControl: true,
          }}
        >
          {propertiesWithLocation.map((property) => (
            <Marker
              key={property.propertyId}
              position={{
                lat: property.latitude!,
                lng: property.longitude!,
              }}
              onClick={() => setSelectedProperty(property)}
              icon={{
                url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png',
              }}
            />
          ))}

          {selectedProperty && selectedProperty.latitude && selectedProperty.longitude && (
            <InfoWindow
              position={{
                lat: selectedProperty.latitude,
                lng: selectedProperty.longitude,
              }}
              onCloseClick={() => setSelectedProperty(null)}
            >
              <div className="p-2 max-w-xs">
                <h4 className="font-semibold text-gray-900 mb-2">{selectedProperty.title}</h4>
                <div className="space-y-1 text-sm">
                  {selectedProperty.bhk && (
                    <div className="flex items-center gap-1 text-gray-600">
                      <Bed className="h-3 w-3" />
                      <span>{selectedProperty.bhk} BHK</span>
                    </div>
                  )}
                  {selectedProperty.rentAmount && (
                    <div className="flex items-center gap-1 text-gray-600">
                      <IndianRupee className="h-3 w-3" />
                      <span>₹{selectedProperty.rentAmount.toLocaleString()}/month</span>
                    </div>
                  )}
                  {selectedProperty.area && (
                    <div className="flex items-center gap-1 text-gray-600">
                      <Home className="h-3 w-3" />
                      <span>{selectedProperty.area}, {selectedProperty.city}</span>
                    </div>
                  )}
                  {selectedProperty.status && (
                    <div className="mt-2">
                      <span className={`inline-block px-2 py-0.5 text-xs rounded-full ${
                        selectedProperty.status === 'available' 
                          ? 'bg-green-100 text-green-700'
                          : selectedProperty.status === 'rented'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {selectedProperty.status}
                      </span>
                    </div>
                  )}
                </div>
                {onPropertyClick && (
                  <button
                    onClick={() => {
                      onPropertyClick(selectedProperty.propertyId);
                      setSelectedProperty(null);
                    }}
                    className="mt-3 w-full px-3 py-1.5 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700"
                  >
                    View Details
                  </button>
                )}
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      ) : (
        <div className="p-8 text-center text-gray-600">Loading map…</div>
      )}
    </div>
  );
}
