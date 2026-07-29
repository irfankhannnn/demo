/**
 * Structured recommendations for detail DTOs (hybrid insight).
 * Formatter renders metadata.recommendation; never WhatsApp prose here beyond action/reasons.
 */

import { formatDate, formatMoney } from './utils.js';

function displayDate(value) {
  if (!value) return null;
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return formatDate(value);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return formatDate(value);
  }
}

export function buildLeadRecommendation(lead, requirement = {}) {
  const status = String(lead.status || '').toLowerCase();
  const priority = String(lead.priority || '').toLowerCase();
  const score = Number(lead.score) || 0;
  if (status === 'lost' || status === 'converted') return null;

  const reasons = [];
  const budget = requirement.budget || requirement.expectedPrice || requirement.rentExpected;
  if (budget) reasons.push(`Budget ${budget}`);
  if (score >= 80) reasons.push(`Lead score: ${score}`);
  if (priority === 'high') reasons.push('High priority');
  if (requirement.preferredArea || requirement.area) {
    reasons.push(`Area: ${requirement.preferredArea || requirement.area}`);
  }

  if (lead.nextFollowUpDate) {
    return {
      action: `Follow up on ${displayDate(lead.nextFollowUpDate)} as scheduled.`,
      reasons: reasons.slice(0, 4),
    };
  }
  if (status === 'new') {
    return { action: 'Make first contact soon.', reasons: reasons.slice(0, 4) };
  }
  if (reasons.length === 0) return null;
  return { action: 'Schedule the next follow-up.', reasons: reasons.slice(0, 4) };
}

export function buildBuyerRecommendation(buyer) {
  const status = String(buyer.status || '').toLowerCase();
  if (status === 'inactive' || status === 'lost') return null;

  const reasons = [];
  const budget = typeof buyer.budget === 'string' ? buyer.budget : formatMoney(buyer.budget);
  if (budget) reasons.push(`Budget ${budget}`);
  if (buyer.preferredArea) reasons.push(`Area: ${buyer.preferredArea}`);
  if (buyer.bhk) reasons.push(`${buyer.bhk} BHK`);

  if (buyer.nextFollowUpDate) {
    return {
      action: `Follow up on ${displayDate(buyer.nextFollowUpDate)} — match inventory.`,
      reasons: reasons.slice(0, 4),
    };
  }
  return {
    action: budget
      ? 'Match with available inventory in their budget.'
      : 'Confirm budget and area, then match inventory.',
    reasons: reasons.slice(0, 4),
  };
}

export function buildOwnerRecommendation(owner, properties = []) {
  const status = String(owner.status || '').toLowerCase();
  if (status === 'inactive' || status === 'past') {
    return { action: 'Owner inactive — confirm before matching.', reasons: [] };
  }

  const props = Array.isArray(properties) ? properties : [];
  const available = props.filter((p) => {
    const s = String(p.status || '').toLowerCase();
    return s === 'available' || s === 'for-sale' || s === 'for-rent';
  }).length;
  const count = owner.propertyCount || props.length;
  const first = (owner.name || 'Owner').split(' ')[0];
  const reasons = [];
  if (count) reasons.push(`${count} propert${count === 1 ? 'y' : 'ies'} on record`);
  if (available) reasons.push(`${available} available for matching`);

  if (available > 0) {
    return {
      action: `Match ${first}'s available ${available === 1 ? 'property' : 'properties'} with buyer leads.`,
      reasons: reasons.slice(0, 4),
    };
  }
  if (count > 0) {
    return {
      action: 'Check property availability before matching.',
      reasons: reasons.slice(0, 4),
    };
  }
  return {
    action: 'Add a listing to start matching buyers.',
    reasons: [],
  };
}

export function buildTenantRecommendation(tenant) {
  const rental = tenant.currentRental;
  const hasRental = rental && typeof rental === 'object';
  const reasons = [];
  if (tenant.preferredArea) reasons.push(`Area: ${tenant.preferredArea}`);
  const budget = typeof tenant.budget === 'string' ? tenant.budget : formatMoney(tenant.budget);
  if (budget) reasons.push(`Budget ${budget}`);
  if (hasRental) {
    const rent = formatMoney(rental.rentAmount || rental.monthlyRent || rental.rent);
    if (rent) reasons.push(`Current rent ${rent}`);
    return {
      action: 'Track lease dates and plan renewal outreach.',
      reasons: reasons.slice(0, 4),
    };
  }
  return {
    action: 'Share matching rentals in their budget.',
    reasons: reasons.slice(0, 4),
  };
}

export function buildPropertyRecommendation(property) {
  const status = String(property.status || property.listingStatus || '').toLowerCase();
  const reasons = [];
  if (property.area) reasons.push(`Area: ${property.area}`);
  const sale = typeof property.salePrice === 'string'
    ? property.salePrice
    : formatMoney(property.salePrice || property.price);
  const rent = typeof property.monthlyRent === 'string'
    ? property.monthlyRent
    : formatMoney(property.monthlyRent || property.rent);
  if (sale) reasons.push(`Sale ${sale}`);
  if (rent) reasons.push(`Rent ${rent}`);

  if (status.includes('sold') || status === 'rented') {
    return { action: 'Listing closed — keep for history and referrals.', reasons: reasons.slice(0, 4) };
  }
  if (status.includes('rent') || status === 'for-rent' || status === 'available') {
    return { action: 'Match with active tenant or buyer leads.', reasons: reasons.slice(0, 4) };
  }
  if (status.includes('sale') || status === 'for-sale') {
    return { action: 'Share with matching buyer leads.', reasons: reasons.slice(0, 4) };
  }
  return { action: 'Review listing status and next owner follow-up.', reasons: reasons.slice(0, 4) };
}

export function buildContactRecommendation(contact) {
  const role = String(contact.role || '').toLowerCase();
  const reasons = [];
  if (contact.role) reasons.push(`Role: ${contact.role}`);
  if (role.includes('broker')) {
    return {
      action: 'Use this broker for area introductions and matching.',
      reasons: reasons.slice(0, 4),
    };
  }
  return {
    action: 'Keep this contact warm for referrals and coordination.',
    reasons: reasons.slice(0, 4),
  };
}

export function buildMeetingRecommendation(meeting) {
  const status = String(meeting.status || '').toLowerCase();
  const when = meeting.scheduledDate ? new Date(meeting.scheduledDate) : null;
  const now = new Date();
  const reasons = [];
  if (meeting.relatedEntityName) reasons.push(`Related: ${meeting.relatedEntityName}`);
  if (meeting.location) reasons.push(`Location: ${meeting.location}`);

  if (status === 'cancelled') {
    return { action: 'Reschedule if still needed.', reasons: reasons.slice(0, 4) };
  }
  if (status === 'completed') {
    return { action: 'Add a note with meeting outcomes.', reasons: reasons.slice(0, 4) };
  }
  if (when && when < now) {
    return { action: 'Overdue — reschedule or mark completed.', reasons: reasons.slice(0, 4) };
  }
  return {
    action: 'Prepare talking points and confirm attendance.',
    reasons: reasons.slice(0, 4),
  };
}
