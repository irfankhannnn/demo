import type { BuyerRequirement } from '../types/crm';

/** Flat property types used on LeadDetails create/edit (source of truth for buyer leads). */
export const BUYER_PROPERTY_TYPES = ['apartment', 'house', 'villa', 'office'] as const;
export type BuyerPropertyType = (typeof BUYER_PROPERTY_TYPES)[number];

const FLAT_BUYER_TYPES = new Set<string>(BUYER_PROPERTY_TYPES);

/** Map legacy drawer values (residential/commercial/land + subType) to flat propertyType. */
export function normalizeBuyerRequirement(
  value?: BuyerRequirement | null,
): BuyerRequirement {
  if (!value) return {};

  const pt = String(value.propertyType || '').trim().toLowerCase();
  if (FLAT_BUYER_TYPES.has(pt)) {
    return { ...value, propertyType: pt };
  }

  const sub = String(value.propertySubType || '').trim().toLowerCase();

  if (pt === 'residential') {
    if (sub === 'house') return { ...value, propertyType: 'house', propertySubType: undefined };
    if (sub === 'villa') return { ...value, propertyType: 'villa', propertySubType: undefined };
    if (sub) return { ...value, propertyType: 'apartment', propertySubType: undefined };
    return { ...value, propertyType: 'apartment', propertySubType: undefined };
  }

  if (pt === 'commercial') {
    return { ...value, propertyType: 'office', propertySubType: undefined };
  }

  if (pt === 'land') {
    return { ...value, propertyType: 'office', propertySubType: undefined };
  }

  return { ...value };
}

export function buyerRequirementShowsBhk(propertyType?: string): boolean {
  const pt = String(propertyType || '').trim().toLowerCase();
  return !pt || pt === 'apartment' || pt === 'house' || pt === 'villa';
}
