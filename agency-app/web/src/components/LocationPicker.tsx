import { useState, useCallback, useEffect } from 'react';
import { MapPin, Navigation, Search, X, Check } from 'lucide-react';
import { Geolocation } from '@capacitor/geolocation';
import { hasNativeRuntime } from '../lib/platform';
import { openExternal } from '../lib/nativeAuth';

interface LocationPickerProps {
  latitude: string;
  longitude: string;
  address: string;
  onLocationChange: (lat: string, lng: string, address?: string) => void;
  onAddressChange?: (address: string) => void;
}

export default function LocationPicker({
  latitude,
  longitude,
  address,
  onLocationChange,
  onAddressChange,
}: LocationPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tempLat, setTempLat] = useState(latitude);
  const [tempLng, setTempLng] = useState(longitude);

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

  /**
   * Resolve the device's current position.
   *
   * Native goes through @capacitor/geolocation rather than navigator.geolocation:
   * the WebView API needs onGeolocationPermissionsShowPrompt wired up on Android
   * and would otherwise fail silently, and the plugin surfaces the OS permission
   * prompt properly on both platforms.
   */
  const getCurrentLocation = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (hasNativeRuntime()) {
        const permission = await Geolocation.checkPermissions();
        if (permission.location !== 'granted') {
          const requested = await Geolocation.requestPermissions();
          if (requested.location !== 'granted') {
            setError('Location permission denied. Enable it in Settings to use this.');
            setLoading(false);
            return;
          }
        }

        const position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 10000,
        });
        setTempLat(position.coords.latitude.toFixed(6));
        setTempLng(position.coords.longitude.toFixed(6));
        setLoading(false);
        return;
      }

      if (!navigator.geolocation) {
        setError('Geolocation is not supported by your browser');
        setLoading(false);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          setTempLat(position.coords.latitude.toFixed(6));
          setTempLng(position.coords.longitude.toFixed(6));
          setLoading(false);
        },
        (err) => {
          setError(`Unable to get location: ${err.message}`);
          setLoading(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } catch (err) {
      setError(err instanceof Error ? `Unable to get location: ${err.message}` : 'Unable to get location');
      setLoading(false);
    }
  }, []);

  /**
   * Open Google Maps for an address search.
   *
   * window.open in a WebView opens a blank in-app frame with no chrome and no
   * way back, so native routes through the system browser instead.
   */
  const openGoogleMapsSearch = () => {
    const query = searchQuery || address || 'Mumbai, India';
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    openExternal(url);
  };

  // Confirm and apply location
  const confirmLocation = () => {
    onLocationChange(tempLat, tempLng);
    setIsOpen(false);
  };

  // Parse coordinates from pasted Google Maps URL
  const handlePasteCoordinates = (value: string) => {
    // Try to extract coordinates from Google Maps URL
    // Format: @19.0760,72.8777 or 19.0760,72.8777
    const coordMatch = value.match(/@?([-\d.]+),([-\d.]+)/);
    if (coordMatch) {
      setTempLat(coordMatch[1]);
      setTempLng(coordMatch[2]);
    }
  };

  const hasLocation = latitude && longitude;

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
            setTempLat(latitude);
            setTempLng(longitude);
            setIsOpen(true);
          }}
          className="px-3 py-1.5 text-sm bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 flex items-center gap-1"
        >
          <MapPin className="h-4 w-4" />
          {hasLocation ? 'Update' : 'Set Location'}
        </button>
      </div>

      {/* Location Picker Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Set Location</h3>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-gray-100 rounded-full"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg">
                {error}
              </div>
            )}

            {/* Search Address */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search Address
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Enter address to search..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={openGoogleMapsSearch}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1"
                >
                  <Search className="h-4 w-4" />
                  <span className="hidden sm:inline">Maps</span>
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Opens Google Maps - copy coordinates from URL and paste below
              </p>
            </div>

            {/* Get Current Location */}
            <button
              type="button"
              onClick={getCurrentLocation}
              disabled={loading}
              className="w-full mb-4 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2"
            >
              <Navigation className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Getting location...' : 'Use Current Location'}
            </button>

            {/* Manual Coordinates */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Latitude
                </label>
                <input
                  type="text"
                  value={tempLat}
                  onChange={(e) => {
                    setTempLat(e.target.value);
                    handlePasteCoordinates(e.target.value);
                  }}
                  placeholder="19.0760"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Longitude
                </label>
                <input
                  type="text"
                  value={tempLng}
                  onChange={(e) => setTempLng(e.target.value)}
                  placeholder="72.8777"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Preview Link */}
            {tempLat && tempLng && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <a
                  href={`https://www.google.com/maps?q=${tempLat},${tempLng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                >
                  <MapPin className="h-4 w-4" />
                  Preview on Google Maps
                </a>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmLocation}
                disabled={!tempLat || !tempLng}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Check className="h-4 w-4" />
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
