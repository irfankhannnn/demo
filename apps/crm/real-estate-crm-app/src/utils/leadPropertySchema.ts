import type { OwnerProperty, SellerProperty } from '../types/crm';

export type LeadPropertyVariant = 'owner' | 'seller';
export type LeadPropertyType = 'apartment' | 'house' | 'villa' | 'office' | 'land' | '';

export const OWNER_PROPERTY_TYPES: LeadPropertyType[] = ['apartment', 'house', 'villa', 'office'];
export const SELLER_PROPERTY_TYPES: LeadPropertyType[] = ['apartment', 'house', 'villa', 'office', 'land'];

export type LeadPropertyBlob = OwnerProperty | SellerProperty;

export interface PropertyFieldVisibility {
  bhk: boolean;
  buildingName: boolean;
  flatNumber: boolean;
  floor: boolean;
  furnishing: boolean;
  carpetArea: boolean;
}

export interface PropertyFieldLabels {
  buildingName: string;
  flatNumber: string;
  carpetArea: string;
  bhk: string;
}

const DEFAULT_VISIBILITY: PropertyFieldVisibility = {
  bhk: true,
  buildingName: true,
  flatNumber: true,
  floor: true,
  furnishing: true,
  carpetArea: true,
};

const DEFAULT_LABELS: PropertyFieldLabels = {
  buildingName: 'Building Name',
  flatNumber: 'Flat No.',
  carpetArea: 'Carpet Area (sq ft)',
  bhk: 'BHK',
};

export function normalizePropertyType(value?: string | null): LeadPropertyType {
  const normalized = String(value || '').trim().toLowerCase();
  if (['apartment', 'house', 'villa', 'office', 'land'].includes(normalized)) {
    return normalized as LeadPropertyType;
  }
  return '';
}

export function getPropertyFieldVisibility(
  propertyType?: string | null,
  _variant: LeadPropertyVariant = 'owner',
): PropertyFieldVisibility {
  const type = normalizePropertyType(propertyType);
  switch (type) {
    case 'apartment':
      return { ...DEFAULT_VISIBILITY };
    case 'house':
      return {
        bhk: true,
        buildingName: true,
        flatNumber: false,
        floor: false,
        furnishing: true,
        carpetArea: true,
      };
    case 'villa':
      return {
        bhk: true,
        buildingName: true,
        flatNumber: false,
        floor: false,
        furnishing: true,
        carpetArea: true,
      };
    case 'office':
      return {
        bhk: false,
        buildingName: true,
        flatNumber: true,
        floor: true,
        furnishing: true,
        carpetArea: true,
      };
    case 'land':
      return {
        bhk: false,
        buildingName: false,
        flatNumber: false,
        floor: false,
        furnishing: false,
        carpetArea: true,
      };
    default:
      return { ...DEFAULT_VISIBILITY };
  }
}

export function getPropertyFieldLabels(propertyType?: string | null): PropertyFieldLabels {
  const type = normalizePropertyType(propertyType);
  switch (type) {
    case 'house':
      return {
        ...DEFAULT_LABELS,
        buildingName: 'House Name',
        carpetArea: 'Built-up Area (sq ft)',
      };
    case 'villa':
      return {
        ...DEFAULT_LABELS,
        buildingName: 'Villa / Society Name',
        carpetArea: 'Built-up Area (sq ft)',
      };
    case 'office':
      return {
        ...DEFAULT_LABELS,
        buildingName: 'Building / Complex Name',
        flatNumber: 'Office / Unit No.',
        carpetArea: 'Carpet Area (sq ft)',
        bhk: 'Size Category',
      };
    case 'land':
      return {
        ...DEFAULT_LABELS,
        carpetArea: 'Plot Area (sq ft)',
      };
    default:
      return { ...DEFAULT_LABELS };
  }
}

/** Clear fields that do not apply after the user changes property type. */
export function applyPropertyTypeChange<T extends LeadPropertyBlob>(
  current: T | undefined,
  nextPropertyType: string,
): T {
  const visibility = getPropertyFieldVisibility(nextPropertyType);
  const next = {
    ...(current || {}),
    propertyType: nextPropertyType,
  } as T & Record<string, unknown>;

  if (!visibility.bhk) delete next.bhk;
  if (!visibility.buildingName) delete next.buildingName;
  if (!visibility.flatNumber) delete next.flatNumber;
  if (!visibility.floor) delete next.floor;
  if (!visibility.furnishing) delete next.furnishing;
  if (!visibility.carpetArea) delete next.carpetArea;

  return next as T;
}

export function getPropertyTypeOptions(variant: LeadPropertyVariant): LeadPropertyType[] {
  return variant === 'seller' ? SELLER_PROPERTY_TYPES : OWNER_PROPERTY_TYPES;
}
