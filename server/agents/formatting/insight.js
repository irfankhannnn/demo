/**
 * Deterministic insight fallbacks for detail cards.
 * Prefer metadata.recommendation from the AI DTO when present (hybrid policy).
 */

import { formatDate, formatMoney } from './utils.js';

export function buildLeadInsight(lead, req) {
  const status = String(lead.status || '').toLowerCase();
  const temperature = String(lead.score || '').toLowerCase();
  const scoreValue = typeof lead.scoreValue === 'number' ? lead.scoreValue : 0;

  if (status === 'lost') return '💡 Marked lost — re-engage only if something has changed.';
  if (status === 'converted') return '💡 Already converted — keep warm for referrals.';

  const highValue = temperature === 'hot' || scoreValue >= 80;
  const signals = [];
  if (req.budget) signals.push(`budget ${req.budget}`);
  if (temperature) signals.push(`${temperature} lead`);

  const next = formatDate(lead.nextFollowUpDate);
  let action;
  if (next) action = `Follow up on ${next} as scheduled.`;
  else if (status === 'new') action = 'Make first contact soon.';
  else action = 'Schedule the next follow-up.';

  const headline = highValue ? 'Active high-value lead' : 'Active lead';
  return `💡 ${headline}${signals.length ? ` (${signals.join(', ')})` : ''}. ${action}`;
}

export function buildBuyerInsight(buyer) {
  const budget = formatMoney(buyer.budget);
  return budget
    ? `💡 Active buyer (budget ${budget}). Match with available inventory.`
    : '💡 Active buyer. Confirm budget and area to match inventory.';
}

export function buildOwnerInsight(owner, properties = []) {
  const propertyCount = owner.propertyCount || properties.length;
  const available = properties.filter(p => {
    const s = String(p.status || '').toLowerCase();
    return s === 'available' || s === 'for-sale' || s === 'for-rent';
  }).length;
  const first = (owner.name || 'Owner').split(' ')[0];
  if (available) {
    return `💡 ${available} of ${first}'s ${available === 1 ? 'property is' : 'properties are'} available to match with buyer leads.`;
  }
  if (propertyCount) return '💡 Active owner — check property availability before matching.';
  return '💡 No properties on record yet — add a listing to start matching.';
}

export function buildTenantInsight(tenant, hasRental) {
  return hasRental
    ? '💡 Active tenant — track lease dates and renewal.'
    : '💡 Active tenant lead — share matching rentals in their budget.';
}

export function buildPropertyInsight(property) {
  const status = String(property.status || property.listingStatus || '').toLowerCase();
  if (status.includes('sold') || status === 'rented') {
    return '💡 Listing closed — keep for history and referrals.';
  }
  if (status.includes('rent') || status === 'for-rent' || status === 'available') {
    return '💡 Available — match with active tenant or buyer leads.';
  }
  if (status.includes('sale') || status === 'for-sale') {
    return '💡 On market — share with matching buyer leads.';
  }
  return '💡 Review listing status and next follow-up with the owner.';
}

export function buildContactInsight(contact) {
  const role = contact.role ? String(contact.role).toLowerCase() : 'contact';
  if (role.includes('broker')) return '💡 Key broker contact — useful for area introductions.';
  return '💡 Keep this contact warm for referrals and coordination.';
}

export function buildMeetingInsight(meeting) {
  const status = String(meeting.status || '').toLowerCase();
  const when = meeting.scheduledDate ? new Date(meeting.scheduledDate) : null;
  const now = new Date();
  if (status === 'cancelled') return '💡 Meeting cancelled — reschedule if still needed.';
  if (status === 'completed') return '💡 Meeting done — add a note with outcomes.';
  if (when && when < now) return '💡 Overdue — reschedule or mark completed.';
  return '💡 Upcoming — prepare talking points and confirm attendance.';
}
