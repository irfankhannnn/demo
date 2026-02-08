import { useState, useCallback, useRef, useEffect } from 'react';
import { Autocomplete, GoogleMap, Marker } from '@react-google-maps/api';
import { MapPin, X, Check } from 'lucide-react';
import { useGoogleMaps } from '../contexts/GoogleMapsContext';

interface GoogleMapPickerProps {
  latitude: string;
  longitude: string;
  onLocationChange: (lat: string, lng: string) => void;
  onAddressExtracted?: (address: {
    area?: string;
    city?: string;
    buildingName?: string;
    fullAddress?: string;
  }) => void;
}

const mapContainerStyle = {
  width: '100%',
  height: '400px',
};

const defaultCenter = {
  lat: 19.0760,
  lng: 72.8777,
};

export default function GoogleMapPicker({
  latitude,
  longitude,
  onLocationChange,
  onAddressExtracted,
}: GoogleMapPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<{ lat: number; lng: number } | null>(
    latitude && longitude
      ? { lat: parseFloat(latitude), lng: parseFloat(longitude) }
      : null
  );
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>(defaultCenter);
  const mapRef = useRef<google.maps.Map | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);

  useEffect(() => {
    if (selectedPosition) {
      setMapCenter(selectedPosition);
    }
  }, [selectedPosition]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const hasLocation = latitude && longitude;

  const { isLoaded } = useGoogleMaps();

  const reverseGeocode = useCallback(
    async (lat: number, lng: number) => {
      if (!onAddressExtracted) return;
      if (!isLoaded) return;
      if (!geocoderRef.current) {
        geocoderRef.current = new google.maps.Geocoder();
      }

      const getComp = (component: google.maps.GeocoderAddressComponent) =>
        component.short_name || component.long_name;

      try {
        const { results } = await geocoderRef.current.geocode({ location: { lat, lng } });
        const best = results?.[0];
        if (!best) return;

        const extractedAddress: {
          area?: string;
          city?: string;
          buildingName?: string;
          fullAddress?: string;
        } = {
          fullAddress: undefined,
        };

        best.address_components?.forEach((component) => {
          const types = component.types;

          if (types.includes('sublocality_level_1') || types.includes('sublocality')) {
            extractedAddress.area = getComp(component);
          }

          if (types.includes('locality')) {
            extractedAddress.city = getComp(component);
          }

          if (types.includes('premise') || types.includes('establishment')) {
            extractedAddress.buildingName = getComp(component);
          }
        });

        // Avoid localized formatted_address (can come in Hindi). Build a simple English-ish address.
        extractedAddress.fullAddress = [
          extractedAddress.buildingName,
          extractedAddress.area,
          extractedAddress.city,
        ]
          .filter(Boolean)
          .join(', ');

        onAddressExtracted(extractedAddress);
      } catch {
        // ignore geocode errors
      }
    },
    [isLoaded, onAddressExtracted]
  );

  const handleMapClick = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (e.latLng) {
        const lat = e.latLng.lat();
        const lng = e.latLng.lng();
        setSelectedPosition({ lat, lng });
        reverseGeocode(lat, lng);
      }
    },
    [reverseGeocode]
  );

  const handleConfirm = () => {
    if (selectedPosition) {
      onLocationChange(
        selectedPosition.lat.toFixed(6),
        selectedPosition.lng.toFixed(6)
      );
      setIsOpen(false);
    }
  };

  const handlePlaceChanged = useCallback(() => {
    if (!autocomplete) {
      console.log('Autocomplete not initialized');
      return;
    }
    
    const place = autocomplete.getPlace();
    
    if (!place.geometry?.location) {
      console.log('No geometry found for selected place');
      return;
    }
    
    const lat = place.geometry.location.lat();
    const lng = place.geometry.location.lng();
    
    console.log('Place selected:', place.name || place.formatted_address);
    console.log('Coordinates:', { lat, lng });
    
    setSelectedPosition({ lat, lng });
    setMapCenter({ lat, lng });
    
    if (mapRef.current) {
      mapRef.current.panTo({ lat, lng });
      mapRef.current.setZoom(16);
    }

    if (onAddressExtracted && place.address_components) {
      const getComp = (component: google.maps.GeocoderAddressComponent) =>
        component.short_name || component.long_name;

      const extractedAddress: {
        area?: string;
        city?: string;
        buildingName?: string;
        fullAddress?: string;
      } = {};

      place.address_components.forEach((component) => {
        const types = component.types;
        
        if (types.includes('sublocality_level_1') || types.includes('sublocality')) {
          extractedAddress.area = getComp(component);
        }
        
        if (types.includes('locality')) {
          extractedAddress.city = getComp(component);
        }
        
        if (types.includes('premise') || types.includes('establishment')) {
          extractedAddress.buildingName = getComp(component);
        }
      });

      if (place.name && !extractedAddress.buildingName && 
          place.types?.some(t => ['premise', 'establishment', 'point_of_interest'].includes(t))) {
        extractedAddress.buildingName = place.name;
      }

      // Avoid localized formatted_address. Build address from extracted components.
      extractedAddress.fullAddress = [
        extractedAddress.buildingName,
        extractedAddress.area,
        extractedAddress.city,
      ]
        .filter(Boolean)
        .join(', ');

      console.log('Extracted address:', extractedAddress);
      onAddressExtracted(extractedAddress);
    }
  }, [autocomplete, onAddressExtracted]);

  return (
    <div className="space-y-3">
      {/* Current Location Display */}
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 text-sm">
            <MapPin className={`h-4 w-4 ${hasLocation ? 'text-green-600' : 'text-gray-400'}`} />
            {hasLocation ? (
              <span className="text-gray-700">
                {parseFloat(latitude).toFixed(4)}, {parseFloat(longitude).toFixed(4)}
              </span>
            ) : (
              <span className="text-gray-400">No location set</span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            if (latitude && longitude) {
              setSelectedPosition({
                lat: parseFloat(latitude),
                lng: parseFloat(longitude),
              });
            }
            setIsOpen(true);
          }}
          className="px-3 py-1.5 text-sm bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 flex items-center gap-1"
        >
          <MapPin className="h-4 w-4" />
          {hasLocation ? 'Update Location' : 'Pick on Map'}
        </button>
      </div>

      {/* Map Picker Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Select Location on Map</h3>
                <p className="text-sm text-gray-500 mt-1">Search or click on the map to select a location</p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-gray-100 rounded-full"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {/* Search */}
            <div className="p-4 border-b bg-white">
              {isLoaded ? (
                <Autocomplete
                  onLoad={(a) => setAutocomplete(a)}
                  onUnmount={() => setAutocomplete(null)}
                  onPlaceChanged={handlePlaceChanged}
                >
                  <input
                    type="text"
                    placeholder="Search area, landmark, building name…"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </Autocomplete>
              ) : (
                <input
                  type="text"
                  disabled
                  placeholder="Loading search…"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-400"
                />
              )}
            </div>

            {/* Map Container */}
            <div className="flex-1 relative">
              {isLoaded ? (
                <GoogleMap
                  mapContainerStyle={mapContainerStyle}
                  center={mapCenter}
                  zoom={selectedPosition ? 15 : 12}
                  onClick={handleMapClick}
                  onLoad={(map) => { mapRef.current = map; }}
                  onUnmount={() => { mapRef.current = null; }}
                  options={{
                    streetViewControl: false,
                    mapTypeControl: true,
                    fullscreenControl: false,
                    mapId: 'crm-location-picker',
                  }}
                >
                  {selectedPosition && (
                    <Marker
                        position={selectedPosition}
                        draggable={true}
                        onDragEnd={(e) => {
                          if (e.latLng) {
                            const lat = e.latLng.lat();
                            const lng = e.latLng.lng();
                            setSelectedPosition({ lat, lng });
                            reverseGeocode(lat, lng);
                          }
                        }}
                      />
                    )}
                  </GoogleMap>
                ) : (
                  <div className="h-[400px] flex items-center justify-center bg-gray-100">
                    <div className="text-center">
                      <p className="text-gray-600">Loading map…</p>
                    </div>
                  </div>
                )}
            </div>

            {/* Selected Coordinates Display */}
            {selectedPosition && (
              <div className="px-4 py-3 bg-gray-50 border-t">
                <div className="flex items-center justify-between">
                  <div className="text-sm">
                    <span className="font-medium text-gray-700">Selected: </span>
                    <span className="text-gray-600">
                      {selectedPosition.lat.toFixed(6)}, {selectedPosition.lng.toFixed(6)}
                    </span>
                  </div>
                  <a
                    href={`https://www.google.com/maps?q=${selectedPosition.lat},${selectedPosition.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Open in Google Maps
                  </a>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 p-4 border-t">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!selectedPosition}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Check className="h-4 w-4" />
                Confirm Location
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
