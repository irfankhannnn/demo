import { useEffect, useState } from 'react';
import { X, Save, Building2 } from 'lucide-react';
import { api } from '../services/api';
import NumericInput from './NumericInput';
import GoogleMapPicker from './GoogleMapPicker';
import SearchableSelect from './SearchableSelect';
import { CRMOwner, CRMCustomer } from '../types/crm';

type PropertyType = 'apartment' | 'house' | 'villa' | 'office';
type FurnishingType = 'furnished' | 'semi-furnished' | 'unfurnished';

interface AddPropertyModalProps {
  isOpen: boolean;
  onClose: () => void;
  ownerId?: string;
  ownerName?: string;
  onPropertyAdded: () => void;
}

export default function AddPropertyModal({
  isOpen,
  onClose,
  ownerId: initialOwnerId,
  ownerName: initialOwnerName,
  onPropertyAdded,
}: AddPropertyModalProps) {
  const [saving, setSaving] = useState(false);
  const [addAnother, setAddAnother] = useState(false);
  const [selectedOwnerId, setSelectedOwnerId] = useState(initialOwnerId || '');
  const [selectedOwnerName, setSelectedOwnerName] = useState(initialOwnerName || '');
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [selectedTenantName, setSelectedTenantName] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    propertyType: 'apartment' as PropertyType,
    bhk: 2,
    area: '',
    city: 'Mumbai',
    address: '',
    flatNumber: '',
    floor: '',
    buildingName: '',
    latitude: '',
    longitude: '',
    carpetArea: 0,
    rentAmount: 0,
    depositAmount: 0,
    furnishing: 'semi-furnished' as FurnishingType,
    amenities: [] as string[],
    availableFrom: new Date().toISOString().split('T')[0],
  });

  const resetForm = () => {
    setSaving(false);
    setAddAnother(false);
    setSelectedOwnerId(initialOwnerId || '');
    setSelectedOwnerName(initialOwnerName || '');
    setSelectedTenantId('');
    setSelectedTenantName('');
    setFormData({
      title: '',
      description: '',
      propertyType: 'apartment' as PropertyType,
      bhk: 2,
      area: '',
      city: 'Mumbai',
      address: '',
      flatNumber: '',
      floor: '',
      buildingName: '',
      latitude: '',
      longitude: '',
      carpetArea: 0,
      rentAmount: 0,
      depositAmount: 0,
      furnishing: 'semi-furnished' as FurnishingType,
      amenities: [] as string[],
      availableFrom: new Date().toISOString().split('T')[0],
    });
  };

  useEffect(() => {
    if (isOpen) {
      resetForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialOwnerId, initialOwnerName]);

  const amenitiesList = [
    'Parking',
    'Lift',
    'Power Backup',
    'Security',
    'Water Supply',
    'Gym',
    'Swimming Pool',
    'Garden',
    'Play Area',
    'Club House',
    'Wi-Fi',
    'AC',
  ];

  const toggleAmenity = (amenity: string) => {
    const current = formData.amenities;
    const updated = current.includes(amenity)
      ? current.filter((a) => a !== amenity)
      : [...current, amenity];
    setFormData({ ...formData, amenities: updated });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title || !formData.area || !formData.carpetArea || !formData.rentAmount) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      setSaving(true);
      await api.createCRMProperty({
        ...formData,
        ownerId: selectedOwnerId || undefined,
        latitude: formData.latitude ? parseFloat(formData.latitude) : undefined,
        longitude: formData.longitude ? parseFloat(formData.longitude) : undefined,
      });

      if (addAnother) {
        resetForm();
        onPropertyAdded();
      } else {
        // Close modal and refresh
        onPropertyAdded();
        resetForm();
        onClose();
      }
    } catch (error) {
      console.error('Error creating property:', error);
      alert('Failed to create property. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Add Property</h2>
            {selectedOwnerName && (
              <p className="text-sm text-gray-500">Owner: {selectedOwnerName}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Owner & Tenant Selection */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-600" />
              Owner & Tenant
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SearchableSelect
                label="Property Owner"
                placeholder="Search owner by name or phone..."
                value={selectedOwnerId || null}
                displayValue={selectedOwnerName}
                onChange={(id, item) => {
                  setSelectedOwnerId(id || '');
                  setSelectedOwnerName(item?.name || '');
                }}
                onSearch={async (query) => {
                  const results = await api.searchOwners(query);
                  return results.map((owner: CRMOwner) => ({
                    id: owner.ownerId,
                    name: owner.name,
                    phone: owner.phone,
                  }));
                }}
              />
              <SearchableSelect
                label="Tenant (Optional)"
                placeholder="Search tenant by name or phone..."
                value={selectedTenantId || null}
                displayValue={selectedTenantName}
                onChange={(id, item) => {
                  setSelectedTenantId(id || '');
                  setSelectedTenantName(item?.name || '');
                }}
                onSearch={async (query) => {
                  const results = await api.searchCustomers(query);
                  return results.map((customer: CRMCustomer) => ({
                    id: customer.customerId,
                    name: customer.name,
                    phone: customer.phone,
                  }));
                }}
              />
            </div>
          </div>

          {/* Basic Information */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Property Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Spacious 2BHK Apartment"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Describe the property..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Property Type</label>
                  <select
                    value={formData.propertyType}
                    onChange={(e) => setFormData({ ...formData, propertyType: e.target.value as PropertyType })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="apartment">Apartment</option>
                    <option value="house">House</option>
                    <option value="villa">Villa</option>
                    <option value="office">Office</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">BHK</label>
                  <NumericInput
                    min={1}
                    max={10}
                    value={formData.bhk}
                    onChange={(val) => setFormData({ ...formData, bhk: val || 1 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Location */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Location</h3>

            {/* Map Location Picker */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Property Location on Map
              </label>
              <GoogleMapPicker
                latitude={formData.latitude}
                longitude={formData.longitude}
                onLocationChange={(lat, lng) => {
                  setFormData({ ...formData, latitude: lat, longitude: lng });
                }}
                onAddressExtracted={(address) => {
                  setFormData((prev) => ({
                    ...prev,
                    ...(address.area && { area: address.area }),
                    ...(address.city && { city: address.city }),
                    ...(address.buildingName && { buildingName: address.buildingName }),
                    ...(address.fullAddress && { address: address.fullAddress }),
                  }));
                }}
              />
              <p className="mt-1 text-xs text-gray-500">
                Search for location or click on map to set coordinates
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Area <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.area}
                  onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Andheri West"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Mumbai"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Building Name</label>
                <input
                  type="text"
                  value={formData.buildingName}
                  onChange={(e) => setFormData({ ...formData, buildingName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Sunshine Towers"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Floor</label>
                <input
                  type="text"
                  value={formData.floor}
                  onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="5th Floor"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Flat Number</label>
                <input
                  type="text"
                  value={formData.flatNumber}
                  onChange={(e) => setFormData({ ...formData, flatNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="501"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Address</label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Street, landmark, directions..."
                />
              </div>
            </div>
          </div>

          {/* Pricing & Details */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Pricing & Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Carpet Area (sq.ft) <span className="text-red-500">*</span>
                </label>
                <NumericInput
                  required
                  min={0}
                  value={formData.carpetArea}
                  onChange={(val) => setFormData({ ...formData, carpetArea: val || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter carpet area"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Monthly Rent (₹) <span className="text-red-500">*</span>
                </label>
                <NumericInput
                  required
                  min={0}
                  value={formData.rentAmount}
                  onChange={(val) => setFormData({ ...formData, rentAmount: val || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter monthly rent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Deposit Amount (₹)</label>
                <NumericInput
                  min={0}
                  value={formData.depositAmount}
                  onChange={(val) => setFormData({ ...formData, depositAmount: val || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter deposit amount"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Furnishing</label>
                <select
                  value={formData.furnishing}
                  onChange={(e) => setFormData({ ...formData, furnishing: e.target.value as FurnishingType })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="furnished">Furnished</option>
                  <option value="semi-furnished">Semi-Furnished</option>
                  <option value="unfurnished">Unfurnished</option>
                </select>
              </div>
            </div>
          </div>

          {/* Amenities */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Amenities</h3>
            <div className="grid grid-cols-3 gap-2">
              {amenitiesList.map((amenity) => (
                <button
                  key={amenity}
                  type="button"
                  onClick={() => toggleAmenity(amenity)}
                  className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
                    formData.amenities.includes(amenity)
                      ? 'bg-blue-50 border-blue-500 text-blue-700'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {amenity}
                </button>
              ))}
            </div>
          </div>

          {/* Available From */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Available From</label>
            <input
              type="date"
              value={formData.availableFrom}
              onChange={(e) => setFormData({ ...formData, availableFrom: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-4 border-t">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={addAnother}
                onChange={(e) => setAddAnother(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Add another property</span>
            </label>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                <span>{saving ? 'Saving...' : 'Save Property'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
