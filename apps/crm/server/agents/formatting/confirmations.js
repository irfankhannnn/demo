/**
 * Compact create/update confirmation bodies (2–3 key fields).
 */

import { getLeadRequirement } from './sections.js';
import {
  capitalize,
  formatMoney,
  formatPhoneDisplay,
  joinNonEmpty,
} from './utils.js';

export function formatCompactConfirmation(entityType, data) {
  if (!data || typeof data !== 'object') return null;
  const phone = formatPhoneDisplay(data.phone);
  const lines = [];

  switch (entityType) {
    case 'lead': {
      const req = getLeadRequirement(data);
      lines.push(...[
        data.leadType ? `• Type: ${capitalize(data.leadType)}` : null,
        data.status ? `• Status: ${capitalize(data.status)}` : null,
        phone ? `• Phone: ${phone}` : null,
        req.budget ? `• Budget: ${req.budget}` : null,
        req.area ? `• Area: ${req.area}` : null,
      ].filter(Boolean).slice(0, 4));
      break;
    }
    case 'buyer':
      lines.push(...[
        phone ? `• Phone: ${phone}` : null,
        formatMoney(data.budget) || data.budget ? `• Budget: ${formatMoney(data.budget) || data.budget}` : null,
        data.preferredArea ? `• Area: ${data.preferredArea}` : null,
      ].filter(Boolean));
      break;
    case 'owner':
      lines.push(...[
        phone ? `• Phone: ${phone}` : null,
        data.propertyCount != null ? `• Properties: ${data.propertyCount}` : null,
        data.status ? `• Status: ${capitalize(data.status)}` : null,
      ].filter(Boolean));
      break;
    case 'tenant':
      lines.push(...[
        phone ? `• Phone: ${phone}` : null,
        formatMoney(data.budget) || data.budget ? `• Budget: ${formatMoney(data.budget) || data.budget}` : null,
        data.preferredArea ? `• Area: ${data.preferredArea}` : null,
      ].filter(Boolean));
      break;
    case 'property':
      lines.push(...[
        data.propertyType ? `• Type: ${capitalize(data.propertyType)}` : null,
        data.area ? `• Area: ${data.area}` : null,
        joinNonEmpty([
          formatMoney(data.salePrice) && `Sale ${formatMoney(data.salePrice)}`,
          formatMoney(data.monthlyRent) && `Rent ${formatMoney(data.monthlyRent)}`,
        ], ' · ') ? `• ${joinNonEmpty([
          formatMoney(data.salePrice) && `Sale ${formatMoney(data.salePrice)}`,
          (formatMoney(data.monthlyRent) || data.monthlyRent) && `Rent ${formatMoney(data.monthlyRent) || data.monthlyRent}`,
        ], ' · ')}` : null,
      ].filter(Boolean));
      break;
    case 'contact':
      lines.push(...[
        data.role ? `• Role: ${capitalize(data.role)}` : null,
        phone ? `• Phone: ${phone}` : null,
        data.email ? `• Email: ${data.email}` : null,
      ].filter(Boolean));
      break;
    case 'meeting':
      lines.push(...[
        data.scheduledDate ? `• When: ${data.scheduledDate}` : null,
        data.location ? `• Where: ${data.location}` : null,
        data.status ? `• Status: ${capitalize(data.status)}` : null,
      ].filter(Boolean));
      break;
    default:
      if (phone) lines.push(`• Phone: ${phone}`);
      if (data.status) lines.push(`• Status: ${capitalize(data.status)}`);
  }

  return lines.length ? lines.join('\n') : null;
}

export function emptyStateMessage(entityType) {
  const hints = {
    lead: 'Try a different area, status, or name — or create a new lead.',
    buyer: 'Try another area/budget, or create a buyer.',
    owner: 'Try phone/name search, or add an owner.',
    tenant: 'No tenant *records* found. Pipeline tenant *leads* ke liye bolo: "tenant leads dikhao".',
    property: 'Try another area or listing status.',
    contact: 'Try phone/name search, or add a contact.',
    meeting: 'No upcoming meetings — schedule one?',
    note: 'No notes yet — add one on this record.',
    document: 'No documents found for this property.',
  };
  const label = {
    lead: 'leads',
    buyer: 'buyers',
    owner: 'owners',
    tenant: 'tenants',
    property: 'properties',
    contact: 'contacts',
    meeting: 'meetings',
    note: 'notes',
    document: 'documents',
  }[entityType] || 'records';
  return `No ${label} found. ${hints[entityType] || 'Try a different filter.'}`;
}
