import { IndianRupee } from 'lucide-react';
import { LEAD_BHK_OPTIONS } from '../constants/leadBhkOptions';
import type { OwnerProperty, SellerProperty } from '../types/crm';
import {
  applyPropertyTypeChange,
  getPropertyFieldLabels,
  getPropertyFieldVisibility,
  getPropertyTypeOptions,
  type LeadPropertyVariant,
} from '../utils/leadPropertySchema';

type SellerTimelineMode = 'text' | 'structured';

interface LeadPropertyFieldsProps {
  variant: LeadPropertyVariant;
  value?: OwnerProperty | SellerProperty | null;
  onChange: (value: OwnerProperty | SellerProperty) => void;
  disabled?: boolean;
  /** Seller timeline: free text on create, structured on edit/drawer */
  sellerTimelineMode?: SellerTimelineMode;
}

const inputClass =
  'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100';

const inlineInputClass =
  'px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100';

export default function LeadPropertyFields({
  variant,
  value,
  onChange,
  disabled = false,
  sellerTimelineMode = 'structured',
}: LeadPropertyFieldsProps) {
  const property = value || {};
  const propertyType = property.propertyType || '';
  const visibility = getPropertyFieldVisibility(propertyType, variant);
  const labels = getPropertyFieldLabels(propertyType);
  const typeOptions = getPropertyTypeOptions(variant);

  const patch = (partial: Partial<OwnerProperty & SellerProperty>) => {
    onChange({ ...property, ...partial });
  };

  const handlePropertyTypeChange = (nextType: string) => {
    onChange(applyPropertyTypeChange(property, nextType));
  };

  const sellerProperty = property as SellerProperty;
  const ownerProperty = property as OwnerProperty;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Property Type</label>
        <select
          value={propertyType}
          onChange={(e) => handlePropertyTypeChange(e.target.value)}
          disabled={disabled}
          className={inputClass}
        >
          <option value="">Select type</option>
          {typeOptions.map((type) => (
            <option key={type} value={type}>
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {visibility.bhk && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{labels.bhk}</label>
          <select
            value={property.bhk || ''}
            onChange={(e) => patch({ bhk: e.target.value || undefined })}
            disabled={disabled}
            className={inputClass}
          >
            <option value="">Select BHK</option>
            {LEAD_BHK_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      )}

      {visibility.buildingName && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{labels.buildingName}</label>
          <input
            type="text"
            value={property.buildingName || ''}
            onChange={(e) => patch({ buildingName: e.target.value })}
            disabled={disabled}
            className={inputClass}
            placeholder="e.g. Sea Breeze"
          />
        </div>
      )}

      {(visibility.flatNumber || visibility.floor) && (
        <div className={`grid gap-2 ${visibility.flatNumber && visibility.floor ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {visibility.flatNumber && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{labels.flatNumber}</label>
              <input
                type="text"
                value={property.flatNumber || ''}
                onChange={(e) => patch({ flatNumber: e.target.value })}
                disabled={disabled}
                className={inputClass}
                placeholder="e.g. 401"
              />
            </div>
          )}
          {visibility.floor && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Floor</label>
              <input
                type="text"
                value={property.floor || ''}
                onChange={(e) => patch({ floor: e.target.value })}
                disabled={disabled}
                className={inputClass}
                placeholder="e.g. 4th"
              />
            </div>
          )}
        </div>
      )}

      {visibility.furnishing && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Furnishing</label>
          <select
            value={property.furnishing || ''}
            onChange={(e) => patch({ furnishing: e.target.value })}
            disabled={disabled}
            className={inputClass}
          >
            <option value="">Select furnishing</option>
            <option value="furnished">Furnished</option>
            <option value="semi-furnished">Semi-furnished</option>
            <option value="unfurnished">Unfurnished</option>
          </select>
        </div>
      )}

      {visibility.carpetArea && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{labels.carpetArea}</label>
          <input
            type="number"
            value={property.carpetArea || ''}
            onChange={(e) =>
              patch({ carpetArea: e.target.value ? Number(e.target.value) : undefined })
            }
            disabled={disabled}
            className={inputClass}
            placeholder="e.g. 1200"
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Area/Location</label>
        <input
          type="text"
          value={property.area || ''}
          onChange={(e) => patch({ area: e.target.value })}
          disabled={disabled}
          className={inputClass}
          placeholder="Property location"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
        <select
          value={property.city || 'Mumbai'}
          onChange={(e) => patch({ city: e.target.value })}
          disabled={disabled}
          className={inputClass}
        >
          <option value="Mumbai">Mumbai</option>
          <option value="Pune">Pune</option>
          <option value="Thane">Thane</option>
          <option value="Navi Mumbai">Navi Mumbai</option>
        </select>
      </div>

      {variant === 'owner' && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Expected Rent</label>
            <div className="relative">
              <IndianRupee className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="number"
                value={ownerProperty.rentExpected || ''}
                onChange={(e) =>
                  patch({ rentExpected: e.target.value ? Number(e.target.value) : undefined })
                }
                disabled={disabled}
                className={`pl-10 pr-3 ${inputClass}`}
                placeholder="Expected monthly rent"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Security Deposit</label>
            <div className="relative">
              <IndianRupee className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="number"
                value={ownerProperty.securityDeposit || ''}
                onChange={(e) =>
                  patch({ securityDeposit: e.target.value ? Number(e.target.value) : undefined })
                }
                disabled={disabled}
                className={`pl-10 pr-3 ${inputClass}`}
                placeholder="Security deposit"
              />
            </div>
          </div>
        </>
      )}

      {variant === 'seller' && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Expected Price</label>
            <div className="relative">
              <IndianRupee className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="number"
                value={sellerProperty.expectedPrice || ''}
                onChange={(e) =>
                  patch({ expectedPrice: e.target.value ? Number(e.target.value) : undefined })
                }
                disabled={disabled}
                className={`pl-10 pr-3 ${inputClass}`}
                placeholder="Expected price"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Timeline</label>
            {sellerTimelineMode === 'text' ? (
              <input
                type="text"
                value={sellerProperty.timeline || ''}
                onChange={(e) => patch({ timeline: e.target.value })}
                disabled={disabled}
                className={inputClass}
                placeholder="e.g., Within 3 months"
              />
            ) : (
              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  value={sellerProperty.timelineValue || ''}
                  onChange={(e) => {
                    const timelineValue = e.target.value ? Number(e.target.value) : undefined;
                    const timelineUnit = sellerProperty.timelineUnit || 'months';
                    patch({
                      timelineValue,
                      timeline: timelineValue ? `${timelineValue} ${timelineUnit}` : '',
                    });
                  }}
                  disabled={disabled}
                  className={`${inlineInputClass} flex-1 min-w-[5rem]`}
                  placeholder="Enter number"
                />
                <select
                  value={sellerProperty.timelineUnit || 'months'}
                  onChange={(e) => {
                    const timelineUnit = e.target.value as 'days' | 'months';
                    patch({
                      timelineUnit,
                      timeline: sellerProperty.timelineValue
                        ? `${sellerProperty.timelineValue} ${timelineUnit}`
                        : '',
                    });
                  }}
                  disabled={disabled}
                  className={`${inlineInputClass} w-28 shrink-0`}
                >
                  <option value="days">Days</option>
                  <option value="months">Months</option>
                </select>
              </div>
            )}
          </div>
        </>
      )}

      <div className="sm:col-span-2">
        <label className="block text-sm font-medium text-gray-700 mb-1">Detailed Address</label>
        <textarea
          value={property.address || ''}
          onChange={(e) => patch({ address: e.target.value })}
          disabled={disabled}
          rows={2}
          className={inputClass}
          placeholder="Street address, landmark, pin code..."
        />
      </div>
    </div>
  );
}
