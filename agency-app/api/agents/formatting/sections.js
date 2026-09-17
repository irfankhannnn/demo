/**
 * Reusable WhatsApp card sections (Interaction Design v1).
 */

import {
  capitalize,
  formatBudgetRange,
  formatDate,
  formatMoney,
  formatPhoneDisplay,
  formatRelativeDate,
  joinNonEmpty,
} from './utils.js';

export function latestNoteText(entity) {
  if (entity.latestNote) return String(entity.latestNote);
  const notes = Array.isArray(entity.notes) ? entity.notes : [];
  if (notes.length === 0) return null;
  let best = null;
  let bestTime = -Infinity;
  for (const n of notes) {
    const text = typeof n === 'string' ? n : (n && (n.content || n.text));
    if (!text) continue;
    const t = n && n.createdAt ? new Date(n.createdAt).getTime() : 0;
    if (t >= bestTime) {
      bestTime = t;
      best = text;
    }
  }
  if (best) return best;
  const first = notes[0];
  return typeof first === 'string' ? first : (first && (first.content || first.text)) || null;
}

export function contactBlock(entity) {
  const lines = [];
  const phone = formatPhoneDisplay(entity.phone);
  if (phone) lines.push(`📞 Phone: ${phone}`);
  if (entity.email) lines.push(`📧 Email: ${entity.email}`);
  return lines.length ? lines.join('\n') : null;
}

export function timelineBlock(entity, {
  createdLabel = 'Created',
  activityLabel = 'Last Contact',
  useRelative = true,
} = {}) {
  const fmt = useRelative ? formatRelativeDate : formatDate;
  const lines = [];
  const created = formatDate(entity.createdAt); // creation stays absolute
  if (created) lines.push(`• ${createdLabel}: ${created}`);
  const activity = fmt(entity.lastActivityAt, { includeTime: false });
  if (activity) lines.push(`• ${activityLabel}: ${activity}`);
  const next = fmt(entity.nextFollowUpDate, { includeTime: true });
  if (next) lines.push(`• Next Follow-up: ${next}`);
  return lines.length ? `📅 *Timeline*\n${lines.join('\n')}` : null;
}

export function latestNoteBlock(entity) {
  const note = latestNoteText(entity);
  if (!note) return null;
  const text = String(note).trim().slice(0, 240);
  return `📝 *Latest Note*\n"${text}"`;
}

export function recommendationBlock(metadata, fallbackLine) {
  const rec = metadata?.recommendation;
  if (rec && typeof rec === 'object' && rec.action) {
    const lines = [`💡 *Recommendation*`, String(rec.action)];
    const reasons = Array.isArray(rec.reasons) ? rec.reasons.filter(Boolean) : [];
    if (reasons.length) {
      lines.push('', 'Reason:');
      for (const r of reasons.slice(0, 4)) lines.push(`• ${r}`);
    }
    return lines.join('\n');
  }
  if (typeof rec === 'string' && rec.trim()) {
    return rec.startsWith('💡') ? rec : `💡 ${rec}`;
  }
  return fallbackLine || null;
}

export function getLeadRequirement(lead) {
  if (lead.requirement && typeof lead.requirement === 'object') {
    const r = lead.requirement;
    return {
      budget: r.budget || r.expectedPrice || r.rentExpected || null,
      budgetMin: r.budgetMin || null,
      budgetMax: r.budgetMax || null,
      area: r.preferredArea || r.area || r.city || null,
      bhk: r.bhk || null,
      propertyType: r.propertyType || null,
      furnishing: r.furnishing || null,
      text: r.requirement || null,
    };
  }
  const type = lead.leadType || 'lead';
  const typeField = {
    buyer: lead.buyerRequirement,
    seller: lead.sellerProperty,
    tenant: lead.tenantRequirement,
    owner: lead.ownerProperty,
  }[type] || {};
  return {
    budget: formatMoney(typeField.budget || typeField.expectedPrice || typeField.rentExpected),
    budgetMin: typeField.budgetMin || null,
    budgetMax: typeField.budgetMax || null,
    area: typeField.preferredArea || typeField.area || typeField.city || null,
    bhk: typeField.bhk || null,
    propertyType: typeField.propertyType || null,
    furnishing: typeField.furnishing || null,
    text: typeField.requirement || null,
  };
}

export function requirementLookingForBlock(req, { title = 'Looking For', budgetLabel = 'Budget' } = {}) {
  const reqLines = [];
  const titleLine = joinNonEmpty([req.bhk ? `${req.bhk} BHK` : null, req.propertyType], ' ');
  if (titleLine) reqLines.push(`• ${titleLine}`);
  if (req.area) reqLines.push(`• ${req.area}`);
  const budget = formatBudgetRange(req.budgetMin, req.budgetMax, req.budget);
  if (budget) reqLines.push(`• ${budgetLabel}: ${budget}`);
  if (req.furnishing) reqLines.push(`• ${capitalize(req.furnishing)}`);
  if (req.text) reqLines.push(`• ${req.text}`);
  if (!reqLines.length) return null;
  return `🏠 *${title}*\n${reqLines.join('\n')}`;
}

export function joinSections(sections) {
  return sections.filter(Boolean).join('\n\n');
}
