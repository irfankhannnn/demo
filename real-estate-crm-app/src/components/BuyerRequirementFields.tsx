import { IndianRupee, MapPin } from 'lucide-react';
import type { BuyerRequirement } from '../types/crm';
import {
  BUYER_PROPERTY_TYPES,
  buyerRequirementShowsBhk,
  normalizeBuyerRequirement,
} from '../utils/buyerRequirementSchema';
import SpeechToTextButton from './SpeechToTextButton';

const fieldClass =
  'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100';

interface BuyerRequirementFieldsProps {
  value?: BuyerRequirement | null;
  onChange: (value: BuyerRequirement) => void;
  disabled?: boolean;
  showSpeechToText?: boolean;
}

export default function BuyerRequirementFields({
  value,
  onChange,
  disabled = false,
  showSpeechToText = false,
}: BuyerRequirementFieldsProps) {
  const req = normalizeBuyerRequirement(value);

  const patch = (partial: Partial<BuyerRequirement>) => {
    onChange({ ...req, ...partial });
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="sm:col-span-2">
        <label className="block text-sm font-medium text-gray-700 mb-1">Requirement</label>
        <div className={showSpeechToText ? 'flex gap-2' : undefined}>
          <textarea
            value={req.requirement || ''}
            onChange={(e) => patch({ requirement: e.target.value })}
            disabled={disabled}
            rows={2}
            className={showSpeechToText ? `flex-1 ${fieldClass}` : fieldClass}
            placeholder="What are they looking for?"
          />
          {showSpeechToText && (
            <SpeechToTextButton
              disabled={disabled}
              onText={(text) => {
                const current = (req.requirement || '').trim();
                patch({
                  requirement: current ? `${current} ${text}` : text,
                });
              }}
            />
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Budget</label>
        <div className="relative">
          <IndianRupee className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="number"
            value={req.budget || ''}
            onChange={(e) => patch({ budget: e.target.value ? Number(e.target.value) : undefined })}
            disabled={disabled}
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100"
            placeholder="Budget amount"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Area</label>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={req.preferredArea || ''}
            onChange={(e) => patch({ preferredArea: e.target.value })}
            disabled={disabled}
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 disabled:bg-gray-100"
            placeholder="Preferred location"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Property Type</label>
        <select
          value={req.propertyType || ''}
          onChange={(e) => patch({ propertyType: e.target.value, propertySubType: undefined })}
          disabled={disabled}
          className={fieldClass}
        >
          <option value="">Select type</option>
          {BUYER_PROPERTY_TYPES.map((type) => (
            <option key={type} value={type}>
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {buyerRequirementShowsBhk(req.propertyType) && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">BHK</label>
          <select
            value={req.bhk || ''}
            onChange={(e) => patch({ bhk: e.target.value ? Number(e.target.value) : undefined })}
            disabled={disabled}
            className={fieldClass}
          >
            <option value="">Any</option>
            <option value="1">1 BHK</option>
            <option value="2">2 BHK</option>
            <option value="3">3 BHK</option>
            <option value="4">4 BHK</option>
            <option value="5">5+ BHK</option>
          </select>
        </div>
      )}
    </div>
  );
}
