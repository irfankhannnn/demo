/**
 * Mirrors agency-app/web/src/utils/leadPropertySchema.ts for Playwright fills.
 */
export type LeadPropertyType = 'apartment' | 'house' | 'villa' | 'office' | 'land' | '';

export interface PropertyFieldVisibility {
  bhk: boolean;
  buildingName: boolean;
  flatNumber: boolean;
  floor: boolean;
  furnishing: boolean;
  carpetArea: boolean;
}

export function getPropertyFieldVisibility(propertyType?: string | null): PropertyFieldVisibility {
  const type = String(propertyType || '').trim().toLowerCase();
  const all = { bhk: true, buildingName: true, flatNumber: true, floor: true, furnishing: true, carpetArea: true };
  switch (type) {
    case 'apartment':
      return { ...all };
    case 'house':
    case 'villa':
      return { bhk: true, buildingName: true, flatNumber: false, floor: false, furnishing: true, carpetArea: true };
    case 'office':
      return { bhk: false, buildingName: true, flatNumber: true, floor: true, furnishing: true, carpetArea: true };
    case 'land':
      return { bhk: false, buildingName: false, flatNumber: false, floor: false, furnishing: false, carpetArea: true };
    default:
      return { ...all };
  }
}

export function getPropertyFieldLabels(propertyType?: string | null) {
  const type = String(propertyType || '').trim().toLowerCase();
  if (type === 'house') return { buildingName: 'House Name', carpetArea: 'Built-up Area (sq ft)', bhk: 'BHK', flatNumber: 'Flat No.' };
  if (type === 'villa') return { buildingName: 'Villa / Society Name', carpetArea: 'Built-up Area (sq ft)', bhk: 'BHK', flatNumber: 'Flat No.' };
  if (type === 'office') return { buildingName: 'Building / Complex Name', flatNumber: 'Office / Unit No.', carpetArea: 'Carpet Area (sq ft)', bhk: 'Size Category' };
  if (type === 'land') return { buildingName: 'Building Name', carpetArea: 'Plot Area (sq ft)', bhk: 'BHK', flatNumber: 'Flat No.' };
  return { buildingName: 'Building Name', carpetArea: 'Carpet Area (sq ft)', bhk: 'BHK', flatNumber: 'Flat No.' };
}
