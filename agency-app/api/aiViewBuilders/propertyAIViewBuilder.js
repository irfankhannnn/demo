/**
 * PropertyAIViewBuilder — AI DTOs for properties.
 */

import { formatDate, formatMoney, buildEnvelope, buildPaginationMetadata } from './utils.js';
import { buildPropertyRecommendation } from './recommendations.js';

export function buildSearchResults(properties, pagination = {}) {
  const { total = properties.length, shown = properties.length, hasMore = false } = pagination;
  return buildEnvelope(
    properties.map(p => ({
      propertyId: p.propertyId,
      title: p.title || null,
      propertyType: p.propertyType || null,
      status: p.status || p.listingStatus || null,
      area: p.area || null,
      city: p.city || null,
      bhk: p.bhk || null,
      monthlyRent: formatMoney(p.monthlyRent || p.rent),
      salePrice: formatMoney(p.salePrice || p.price),
      ownerName: p.ownerName || null,
    })),
    buildPaginationMetadata(total, shown, hasMore),
  );
}

export function buildPropertyDetails(property) {
  const data = {
    propertyId: property.propertyId,
    title: property.title || null,
    propertyType: property.propertyType || null,
    status: property.status || property.listingStatus || null,
    listingStatus: property.listingStatus || null,
    area: property.area || null,
    city: property.city || null,
    buildingName: property.buildingName || null,
    bhk: property.bhk || null,
    furnishing: property.furnishing || null,
    carpetArea: property.carpetArea || null,
    monthlyRent: formatMoney(property.monthlyRent || property.rent || property.rentalInfo?.expectedRent),
    salePrice: formatMoney(property.salePrice || property.price || property.saleInfo?.listedPrice),
    securityDeposit: formatMoney(property.securityDeposit || property.rentalInfo?.securityDeposit),
    ownerName: property.ownerName || null,
    availableFrom: formatDate(property.availableFrom),
    createdAt: formatDate(property.createdAt),
    lastActivityAt: formatDate(property.lastActivityAt),
    latestNote: property.latestNote || null,
    notes: property.notes || undefined,
  };
  return buildEnvelope(data, {
    recommendation: buildPropertyRecommendation(data),
  });
}

export function buildCreateConfirmation(property) {
  return buildEnvelope(
    {
      propertyId: property.propertyId,
      title: property.title || null,
      propertyType: property.propertyType || null,
      status: property.status || null,
      area: property.area || null,
      salePrice: formatMoney(property.salePrice || property.price),
      monthlyRent: formatMoney(property.monthlyRent || property.rent),
    },
    { action: 'created' },
  );
}

export function buildUpdateConfirmation(property, updatedFields = {}) {
  return buildEnvelope(
    {
      propertyId: property.propertyId,
      title: property.title || null,
      status: property.status || null,
    },
    { action: 'updated', updatedFields: Object.keys(updatedFields) },
  );
}

export function buildDeleteConfirmation(property) {
  return buildEnvelope(
    {
      propertyId: property.propertyId,
      title: property.title || null,
      status: 'deleted',
    },
    { action: 'deleted' },
  );
}

export function buildEmptySearchResults() {
  return buildEnvelope([], { total: 0, hasMore: false });
}

export function buildPropertyNotFoundError(propertyId) {
  return buildEnvelope(
    { propertyId },
    { error: 'property_not_found', message: 'Property not found' },
  );
}

export default {
  buildSearchResults,
  buildPropertyDetails,
  buildCreateConfirmation,
  buildUpdateConfirmation,
  buildDeleteConfirmation,
  buildEmptySearchResults,
  buildPropertyNotFoundError,
};
