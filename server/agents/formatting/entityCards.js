/**
 * Mini-profile detail cards per entity (Interaction Design v1).
 */

import {
  buildBuyerInsight,
  buildContactInsight,
  buildLeadInsight,
  buildMeetingInsight,
  buildOwnerInsight,
  buildPropertyInsight,
  buildTenantInsight,
} from './insight.js';
import {
  contactBlock,
  getLeadRequirement,
  joinSections,
  latestNoteBlock,
  recommendationBlock,
  requirementLookingForBlock,
  timelineBlock,
} from './sections.js';
import {
  boldHeader,
  bulletLine,
  capitalize,
  formatDate,
  formatMoney,
  formatRelativeDate,
  humanize,
  joinNonEmpty,
  statusDot,
} from './utils.js';

function aggregatePropertyTypes(properties) {
  const counts = {};
  for (const p of properties) {
    const t = capitalize(p.propertyType || p.type || 'Property');
    counts[t] = (counts[t] || 0) + 1;
  }
  return Object.entries(counts).map(([type, n]) => `• ${n} ${type}${n > 1 && !type.endsWith('s') ? 's' : ''}`);
}

export function formatLeadCard(lead, metadata = {}) {
  const type = lead.leadType || 'lead';
  const req = getLeadRequirement(lead);
  const isSeeker = type === 'buyer' || type === 'tenant';

  const statusBits = [
    `${capitalize(type)} Lead`,
    lead.status && capitalize(lead.status),
    lead.priority && `${capitalize(lead.priority)} Priority`,
  ].filter(Boolean);

  const stats = [];
  if (lead.score) stats.push(`• Lead Score: ${lead.score}/100`);
  if (lead.source) stats.push(`• Source: ${capitalize(lead.source)}`);
  const interactions = Array.isArray(lead.history)
    ? lead.history.length
    : (lead.interactions || null);
  if (interactions) stats.push(`• Interactions: ${interactions}`);

  return joinSections([
    `*${lead.name}*`,
    `${statusDot(lead.status)} ${statusBits.join(' • ')}`,
    contactBlock(lead),
    requirementLookingForBlock(req, {
      title: isSeeker ? 'Looking For' : 'Property',
      budgetLabel: isSeeker ? 'Budget' : 'Price',
    }),
    lead.assignedTo ? `👤 *Assigned To*\n• ${lead.assignedTo}` : null,
    timelineBlock(lead),
    latestNoteBlock(lead),
    stats.length ? `📊 *Quick Stats*\n${stats.join('\n')}` : null,
    recommendationBlock(metadata, buildLeadInsight(lead, req)),
  ]);
}

export function formatBuyerCard(buyer, metadata = {}) {
  const req = {
    bhk: buyer.bhk,
    propertyType: buyer.propertyType,
    area: buyer.preferredArea,
    budget: formatMoney(buyer.budget) || buyer.budget,
    budgetMin: buyer.budgetMin,
    budgetMax: buyer.budgetMax,
  };

  return joinSections([
    `*${buyer.name}*`,
    `${statusDot(buyer.status)} Buyer${buyer.status ? ` • ${capitalize(buyer.status)}` : ''}`,
    contactBlock(buyer),
    requirementLookingForBlock(req),
    timelineBlock(buyer),
    latestNoteBlock(buyer),
    recommendationBlock(metadata, buildBuyerInsight(buyer)),
  ]);
}

export function formatOwnerCard(owner, metadata = {}) {
  const properties = Array.isArray(owner.properties) ? owner.properties : [];
  const propertyCount = owner.propertyCount || properties.length;
  const typeLines = properties.length
    ? aggregatePropertyTypes(properties)
    : (propertyCount ? [`• ${propertyCount} ${propertyCount === 1 ? 'property' : 'properties'}`] : []);

  const primaryArea = owner.primaryArea
    || properties.find(p => p.area || p.city);
  const areaLabel = typeof primaryArea === 'string'
    ? primaryArea
    : (primaryArea && (primaryArea.area || primaryArea.city));

  const verified = owner.documentsVerified
    || String(owner.kycStatus || '').toLowerCase() === 'verified'
    || String(owner.verificationStatus || '').toLowerCase() === 'verified';

  return joinSections([
    `*${owner.name}*`,
    `${statusDot(owner.status)} Property Owner${owner.status ? ` • ${capitalize(owner.status)}` : ''}`,
    contactBlock(owner),
    typeLines.length ? `🏠 *Properties*\n${typeLines.join('\n')}` : null,
    areaLabel ? `📍 *Primary Area*\n• ${areaLabel}` : null,
    (verified || owner.kycStatus)
      ? `📑 *Verification*\n${verified ? '✅ Documents Verified' : `⏳ ${capitalize(owner.kycStatus || 'Pending')}`}`
      : null,
    timelineBlock(owner),
    latestNoteBlock(owner),
    recommendationBlock(metadata, buildOwnerInsight(owner, properties)),
  ]);
}

export function formatTenantCard(tenant, metadata = {}) {
  const rental = tenant.currentRental;
  let domain = null;
  if (rental && typeof rental === 'object') {
    const rentLines = [];
    const rentAmount = formatMoney(rental.rentAmount || rental.monthlyRent || rental.rent);
    if (rental.propertyName || rental.address) rentLines.push(`• ${rental.propertyName || rental.address}`);
    if (rental.area || rental.city) rentLines.push(`• ${rental.area || rental.city}`);
    if (rentAmount) rentLines.push(`• Rent: ${rentAmount}/mo`);
    if (rentLines.length) domain = `🏠 *Current Rental*\n${rentLines.join('\n')}`;
  } else {
    const looking = [];
    if (tenant.preferredArea) looking.push(`• ${tenant.preferredArea}`);
    const budget = formatMoney(tenant.budget);
    if (budget) looking.push(`• Budget: ${budget}/mo`);
    if (looking.length) domain = `🏠 *Looking For*\n${looking.join('\n')}`;
  }

  const verified = String(tenant.kycStatus || '').toLowerCase() === 'verified';

  return joinSections([
    `*${tenant.name}*`,
    `${statusDot(tenant.status)} Tenant${tenant.status ? ` • ${capitalize(tenant.status)}` : ''}`,
    contactBlock(tenant),
    domain,
    tenant.kycStatus
      ? `📑 *Verification*\n${verified ? '✅' : '⏳'} ${capitalize(tenant.kycStatus)}`
      : null,
    timelineBlock(tenant),
    latestNoteBlock(tenant),
    recommendationBlock(metadata, buildTenantInsight(tenant, !!(rental && typeof rental === 'object'))),
  ]);
}

export function formatPropertyCard(property, metadata = {}) {
  const title = property.title
    || `${property.propertyType || 'Property'} in ${property.area || property.city || 'Unknown'}`;
  const status = property.status || property.listingStatus;
  const rent = formatMoney(property.monthlyRent || property.rent || property.rentalInfo?.expectedRent);
  const sale = formatMoney(property.salePrice || property.price || property.saleInfo?.listedPrice);
  const deposit = formatMoney(property.securityDeposit || property.rentalInfo?.securityDeposit);

  const specLines = [];
  if (property.bhk) specLines.push(`• ${property.bhk} BHK${property.propertyType ? ` ${capitalize(property.propertyType)}` : ''}`);
  else if (property.propertyType) specLines.push(`• ${capitalize(property.propertyType)}`);
  if (property.furnishing) specLines.push(`• ${capitalize(property.furnishing)}`);
  if (property.carpetArea) specLines.push(`• Carpet: ${property.carpetArea}`);

  const priceLines = [];
  if (sale) priceLines.push(`• Sale: ${sale}`);
  if (rent) priceLines.push(`• Rent: ${rent}/mo`);
  if (deposit) priceLines.push(`• Deposit: ${deposit}`);

  const locLines = [];
  if (property.area) locLines.push(`• ${property.area}`);
  if (property.city) locLines.push(`• ${property.city}`);
  if (property.buildingName) locLines.push(`• ${property.buildingName}`);

  const ownerName = property.ownerName || null; // never show ownerId

  return joinSections([
    `*${title}*`,
    `${statusDot(status)} ${joinNonEmpty([
      capitalize(property.propertyType) || 'Property',
      status && capitalize(status),
    ], ' • ')}`,
    locLines.length ? `📍 *Location*\n${locLines.join('\n')}` : null,
    priceLines.length ? `💰 *Pricing*\n${priceLines.join('\n')}` : null,
    specLines.length ? `🏠 *Specs*\n${specLines.join('\n')}` : null,
    ownerName ? `👤 *Owner*\n• ${ownerName}` : null,
    property.availableFrom
      ? `📅 *Timeline*\n• Available: ${formatRelativeDate(property.availableFrom) || formatDate(property.availableFrom)}`
      : null,
    latestNoteBlock(property),
    recommendationBlock(metadata, buildPropertyInsight(property)),
  ]);
}

export function formatContactCard(contact, metadata = {}) {
  return joinSections([
    `*${contact.name}*`,
    `${statusDot(contact.status)} ${joinNonEmpty([
      contact.role ? capitalize(contact.role) : 'Contact',
      contact.status && capitalize(contact.status),
    ], ' • ')}`,
    contactBlock(contact),
    timelineBlock(contact, { activityLabel: 'Last Activity' }),
    latestNoteBlock(contact),
    recommendationBlock(metadata, buildContactInsight(contact)),
  ]);
}

export function formatMeetingCard(meeting, metadata = {}) {
  const when = formatRelativeDate(meeting.scheduledDate, { includeTime: true })
    || formatDate(meeting.scheduledDate);
  const related = meeting.relatedEntityName
    || (meeting.relatedEntityType ? capitalize(meeting.relatedEntityType) : null);

  return joinSections([
    `*${meeting.title || 'Meeting'}*`,
    `${statusDot(meeting.status)} Meeting${meeting.status ? ` • ${capitalize(meeting.status)}` : ''}`,
    when || meeting.location
      ? `📅 *When*\n${[
        when ? `• ${when}` : null,
        meeting.location ? `• ${meeting.location}` : null,
      ].filter(Boolean).join('\n')}`
      : null,
    related ? `👤 *Related*\n• ${related}` : null,
    Array.isArray(meeting.attendees) && meeting.attendees.length
      ? `👥 *Attendees*\n${meeting.attendees.slice(0, 5).map(a => `• ${typeof a === 'string' ? a : a.name || a}`).join('\n')}`
      : null,
    meeting.description
      ? `📝 *Notes*\n"${String(meeting.description).slice(0, 200)}"`
      : null,
    recommendationBlock(metadata, buildMeetingInsight(meeting)),
  ]);
}

export function formatNoteCard(note) {
  return joinSections([
    boldHeader(note.title || 'Note'),
    [
      note.createdAt || note.date ? `• Date: ${formatDate(note.createdAt || note.date)}` : null,
      note.createdBy || note.author ? `• By: ${note.createdBy || note.author}` : null,
      note.content || note.text ? `• "${String(note.content || note.text).slice(0, 240)}"` : null,
    ].filter(Boolean).join('\n') || null,
  ]);
}

export function formatDocumentCard(doc) {
  return joinSections([
    boldHeader(doc.title || 'Document'),
    [
      doc.documentType || doc.type ? `• Type: ${capitalize(doc.documentType || doc.type)}` : null,
      (doc.url || doc.documentUrl) ? `• Link: ${doc.url || doc.documentUrl}` : null,
      // Never expose documentId on WhatsApp
    ].filter(Boolean).join('\n') || null,
  ]);
}

export function formatMetricsCard(metrics) {
  const lines = [boldHeader('CRM Metrics')];
  for (const [k, v] of Object.entries(metrics)) {
    if (v !== undefined && v !== null && typeof v !== 'object') {
      lines.push(bulletLine(humanize(k), v));
    }
  }
  return lines.filter(Boolean).join('\n') || boldHeader('Metrics updated');
}

export function formatGenericCard(item) {
  const lines = [
    boldHeader(item.name || item.title || 'Result'),
    ...Object.entries(item)
      .filter(([k]) => !k.startsWith('PK') && !k.startsWith('SK') && !k.startsWith('GSI')
        && k !== 'history' && k !== 'tenantId'
        && !k.endsWith('Id') && !k.endsWith('ID'))
      .slice(0, 8)
      .map(([k, v]) => bulletLine(capitalize(k), typeof v === 'object' ? null : v))
      .filter(Boolean),
  ].filter(Boolean);
  return lines.join('\n') || boldHeader('Result received');
}

export function formatSingleCard(item, metadata = {}) {
  if (!item || typeof item !== 'object') return null;
  if (item.leadId) return formatLeadCard(item, metadata);
  if (item.propertyId) return formatPropertyCard(item, metadata);
  if (item.contactId) return formatContactCard(item, metadata);
  if (item.buyerId) return formatBuyerCard(item, metadata);
  if (item.ownerId) return formatOwnerCard(item, metadata);
  if (item.customerId || item.tenantRecordId) return formatTenantCard(item, metadata);
  if (item.meetingId) return formatMeetingCard(item, metadata);
  if (item.noteId || item.noteID) return formatNoteCard(item);
  if (item.documentId || item.docId) return formatDocumentCard(item);
  return formatGenericCard(item);
}
