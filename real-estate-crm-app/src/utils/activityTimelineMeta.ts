export interface ContactActivity {
  activityId: string;
  contactId: string;
  tenantId: string;
  occurredAt: string;
  activityType: string;
  performedBy: string;
  subjectEntityType: string;
  subjectEntityId: string;
  subjectEntityName?: string;
  title: string;
  description?: string;
  payload?: Record<string, unknown>;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  relatedEntityName?: string | null;
}

export interface ActivityMeta {
  label: string;
  category: 'lead' | 'property' | 'sale' | 'rental' | 'meeting' | 'note' | 'communication' | 'other';
  accent: string;
  chip: string;
}

export interface ActivityNarrative {
  title: string;
  summary: string | null;
  chips: string[];
}

const DEFAULT_META: ActivityMeta = {
  label: 'Activity',
  category: 'other',
  accent: 'border-slate-300 bg-slate-50',
  chip: 'bg-slate-100 text-slate-700',
};

export function getActivityMeta(type: string): ActivityMeta {
  const map: Record<string, ActivityMeta> = {
    lead_created: { label: 'Lead', category: 'lead', accent: 'border-purple-300 bg-purple-50/80', chip: 'bg-purple-100 text-purple-800' },
    lead_status_changed: { label: 'Lead Update', category: 'lead', accent: 'border-teal-300 bg-teal-50/80', chip: 'bg-teal-100 text-teal-800' },
    lead_converted: { label: 'Conversion', category: 'lead', accent: 'border-indigo-300 bg-indigo-50/80', chip: 'bg-indigo-100 text-indigo-800' },
    property_added: { label: 'Property', category: 'property', accent: 'border-cyan-300 bg-cyan-50/80', chip: 'bg-cyan-100 text-cyan-800' },
    property_listed: { label: 'Listed', category: 'property', accent: 'border-sky-300 bg-sky-50/80', chip: 'bg-sky-100 text-sky-800' },
    property_sold: { label: 'Sold', category: 'sale', accent: 'border-emerald-300 bg-emerald-50/80', chip: 'bg-emerald-100 text-emerald-800' },
    purchase_recorded: { label: 'Purchase', category: 'sale', accent: 'border-emerald-300 bg-emerald-50/80', chip: 'bg-emerald-100 text-emerald-800' },
    ownership_changed: { label: 'Ownership', category: 'sale', accent: 'border-violet-300 bg-violet-50/80', chip: 'bg-violet-100 text-violet-800' },
    property_rented: { label: 'Rented Out', category: 'rental', accent: 'border-rose-300 bg-rose-50/80', chip: 'bg-rose-100 text-rose-800' },
    rental_started: { label: 'Lease Started', category: 'rental', accent: 'border-pink-300 bg-pink-50/80', chip: 'bg-pink-100 text-pink-800' },
    rental_ended: { label: 'Lease Ended', category: 'rental', accent: 'border-orange-300 bg-orange-50/80', chip: 'bg-orange-100 text-orange-800' },
    note_added: { label: 'Note', category: 'note', accent: 'border-amber-300 bg-amber-50/80', chip: 'bg-amber-100 text-amber-800' },
    note_updated: { label: 'Note Updated', category: 'note', accent: 'border-amber-300 bg-amber-50/80', chip: 'bg-amber-100 text-amber-800' },
    meeting_scheduled: { label: 'Meeting', category: 'meeting', accent: 'border-blue-300 bg-blue-50/80', chip: 'bg-blue-100 text-blue-800' },
    meeting_completed: { label: 'Meeting Done', category: 'meeting', accent: 'border-green-300 bg-green-50/80', chip: 'bg-green-100 text-green-800' },
    meeting_cancelled: { label: 'Meeting Cancelled', category: 'meeting', accent: 'border-red-300 bg-red-50/80', chip: 'bg-red-100 text-red-800' },
    meeting_rescheduled: { label: 'Rescheduled', category: 'meeting', accent: 'border-orange-300 bg-orange-50/80', chip: 'bg-orange-100 text-orange-800' },
    whatsapp_message_received: { label: 'WhatsApp In', category: 'communication', accent: 'border-green-300 bg-green-50/80', chip: 'bg-green-100 text-green-800' },
    whatsapp_message_sent: { label: 'WhatsApp Out', category: 'communication', accent: 'border-green-300 bg-green-50/80', chip: 'bg-green-100 text-green-800' },
    khata_entry: { label: 'Khata', category: 'other', accent: 'border-amber-300 bg-amber-50/80', chip: 'bg-amber-100 text-amber-800' },
  };
  return map[type] || DEFAULT_META;
}

export function formatInr(value?: unknown): string | null {
  if (value == null || value === '') return null;
  const num = Number(value);
  if (Number.isNaN(num) || num <= 0) return null;
  return `₹${num.toLocaleString('en-IN')}`;
}

export function shortId(id?: unknown, length = 8): string | null {
  const value = String(id || '').trim();
  if (!value) return null;
  return value.length > length ? `${value.slice(0, length)}…` : value;
}

export function capitalizeRole(role?: unknown): string {
  const value = String(role || '').trim().toLowerCase();
  if (!value) return 'contact';
  if (value === 'customer') return 'Tenant';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function formatPerformedBy(performedBy?: string): string {
  const value = String(performedBy || '').trim();
  if (!value || value.toLowerCase() === 'system') return 'Automated';
  return value;
}

export function formatOccurredAt(isoString: string): string {
  try {
    return new Date(isoString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return isoString;
  }
}

export function formatRelativeTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatOccurredAt(isoString);
  } catch {
    return isoString;
  }
}

/** Newest → oldest. Stable for equal timestamps. */
export function sortActivitiesDescending(activities: ContactActivity[]): ContactActivity[] {
  return [...activities].sort((a, b) => {
    const diff = new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime();
    if (diff !== 0) return diff;
    return String(b.activityId || '').localeCompare(String(a.activityId || ''));
  });
}

export function groupActivitiesByDate(activities: ContactActivity[]): { label: string; items: ContactActivity[] }[] {
  const sorted = sortActivitiesDescending(activities);
  const groups = new Map<string, ContactActivity[]>();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  for (const activity of sorted) {
    const d = new Date(activity.occurredAt);
    d.setHours(0, 0, 0, 0);
    let label: string;
    if (d.getTime() === today.getTime()) label = 'Today';
    else if (d.getTime() === yesterday.getTime()) label = 'Yesterday';
    else {
      label = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    }
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(activity);
  }
  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
}

function propertyLabel(activity: ContactActivity): string {
  const p = activity.payload || {};
  return String(
    p.propertyTitle
    || p.propertyName
    || activity.relatedEntityName
    || 'a property'
  );
}

function partyName(...candidates: unknown[]): string | null {
  for (const c of candidates) {
    const value = String(c || '').trim();
    if (value) return value;
  }
  return null;
}

function buildPayloadDetailChips(activity: ContactActivity): string[] {
  const chips: string[] = [];
  const p = activity.payload || {};

  const sold = formatInr(p.soldPrice ?? p.saleAmount);
  if (sold) chips.push(`Sale ${sold}`);

  const rent = formatInr(p.rent ?? p.monthlyRent);
  if (rent) chips.push(`${rent}/mo`);

  const deposit = formatInr(p.deposit ?? p.securityDeposit);
  if (deposit) chips.push(`Deposit ${deposit}`);

  const brokerage = formatInr(p.brokerageAmount ?? p.brokeragePaid);
  if (brokerage) chips.push(`Brokerage ${brokerage}`);

  if (p.leaseStartDate) {
    const start = new Date(String(p.leaseStartDate)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const end = p.leaseEndDate
      ? new Date(String(p.leaseEndDate)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      : 'ongoing';
    chips.push(`Lease ${start} → ${end}`);
  }

  if (p.area) chips.push(String(p.area));
  if (p.listingType === 'rent' || p.listingType === 'sale') {
    chips.push(p.listingType === 'rent' ? 'For rent' : 'For sale');
  }

  return chips;
}

/**
 * Rewrite activity copy into a short, human story for a quick glance.
 * Works for both new rich payloads and older vague titles.
 */
export function getActivityNarrative(activity: ContactActivity): ActivityNarrative {
  const p = activity.payload || {};
  const property = propertyLabel(activity);
  const amount = formatInr(p.soldPrice ?? p.saleAmount ?? p.purchasePrice);
  const rent = formatInr(p.rent ?? p.monthlyRent);
  const deposit = formatInr(p.deposit ?? p.securityDeposit);
  const buyer = partyName(p.buyerName, p.toOwnerName, p.toPartyName);
  const seller = partyName(p.sellerName, p.fromOwnerName, p.fromPartyName);
  const tenant = partyName(p.tenantName);
  const role = capitalizeRole(p.role);
  const leadRef = shortId(p.leadId);
  const chips: string[] = [];

  switch (activity.activityType) {
    case 'lead_converted': {
      const title = `Became a ${role}`;
      const summary = leadRef
        ? `Converted from lead ${leadRef}. Original lead is locked for reference.`
        : `Converted from a lead as ${role}.`;
      if (leadRef) chips.push(`Lead ${leadRef}`);
      chips.push(role);
      return { title, summary, chips };
    }

    case 'property_sold': {
      const title = property === 'a property' ? 'Sold a property' : `Sold ${property}`;
      const parts = [
        buyer ? `to ${buyer}` : null,
        amount ? `for ${amount}` : null,
      ].filter(Boolean);
      const summary = parts.length
        ? `Sold ${parts.join(' ')}.`
        : (activity.description || 'Property marked as sold.');
      if (amount) chips.push(amount);
      if (buyer) chips.push(`Buyer: ${buyer}`);
      return { title, summary, chips };
    }

    case 'purchase_recorded': {
      const title = property === 'a property' ? 'Purchased a property' : `Purchased ${property}`;
      const parts = [
        amount ? `at ${amount}` : null,
        seller ? `from ${seller}` : null,
      ].filter(Boolean);
      const summary = parts.length
        ? `Bought ${parts.join(' ')}.`
        : (activity.description || 'Purchase recorded.');
      if (amount) chips.push(amount);
      if (seller) chips.push(`Seller: ${seller}`);
      return { title, summary, chips };
    }

    case 'ownership_changed': {
      const becameOwner = /became owner/i.test(activity.title || '');
      const title = becameOwner
        ? (property === 'a property' ? 'Became the owner' : `Became owner of ${property}`)
        : (property === 'a property' ? 'Ownership transferred' : `Transferred ${property}`);
      let summary: string | null = null;
      if (becameOwner && seller) {
        summary = `Ownership received${amount ? ` (${amount})` : ''}${seller ? ` from ${seller}` : ''}.`;
      } else if (!becameOwner && buyer) {
        summary = `No longer the owner — transferred to ${buyer}${amount ? ` for ${amount}` : ''}.`;
      } else {
        summary = activity.description || null;
      }
      if (amount) chips.push(amount);
      if (buyer) chips.push(`To: ${buyer}`);
      if (seller) chips.push(`From: ${seller}`);
      return { title, summary, chips };
    }

    case 'property_listed': {
      const isRent = p.listingType === 'rent';
      const listPrice = formatInr(p.listedPrice ?? p.expectedRent ?? p.soldPrice);
      const title = isRent
        ? (property === 'a property' ? 'Listed for rent' : `Listed ${property} for rent`)
        : (property === 'a property' ? 'Listed for sale' : `Listed ${property} for sale`);
      const summary = listPrice
        ? (isRent ? `Asking ${listPrice}/mo.` : `Asking ${listPrice}.`)
        : (activity.description || null);
      if (listPrice) chips.push(isRent ? `${listPrice}/mo` : listPrice);
      if (p.area) chips.push(String(p.area));
      return { title, summary, chips };
    }

    case 'property_added': {
      const title = property === 'a property' ? 'Added a property' : `Added ${property}`;
      const area = p.area ? String(p.area) : null;
      const summary = area
        ? `Registered in ${area}${p.city ? `, ${p.city}` : ''}.`
        : (activity.description || 'New property registered.');
      if (area) chips.push(area);
      return { title, summary, chips };
    }

    case 'property_rented': {
      const title = property === 'a property' ? 'Rented out a property' : `Rented out ${property}`;
      const summary = [
        tenant ? `Tenant: ${tenant}` : null,
        rent ? `${rent}/mo` : null,
      ].filter(Boolean).join(' · ') || activity.description || null;
      if (tenant) chips.push(tenant);
      if (rent) chips.push(`${rent}/mo`);
      if (deposit) chips.push(`Deposit ${deposit}`);
      return { title, summary, chips };
    }

    case 'rental_started': {
      const title = property === 'a property' ? 'Lease started' : `Moved into ${property}`;
      const summary = [
        rent ? `Rent ${rent}/mo` : null,
        deposit ? `Deposit ${deposit}` : null,
      ].filter(Boolean).join(' · ') || activity.description || null;
      if (rent) chips.push(`${rent}/mo`);
      if (deposit) chips.push(`Deposit ${deposit}`);
      if (p.leaseStartDate) {
        chips.push(
          `From ${new Date(String(p.leaseStartDate)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
        );
      }
      return { title, summary, chips };
    }

    case 'rental_ended': {
      const title = property === 'a property' ? 'Lease ended' : `Vacated ${property}`;
      const summary = activity.description || 'Tenant moved out.';
      if (p.leaseEndDate) {
        chips.push(
          `Until ${new Date(String(p.leaseEndDate)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
        );
      }
      return { title, summary, chips };
    }

    case 'note_added':
    case 'note_updated': {
      const content = String(activity.description || '').trim();
      return {
        title: activity.activityType === 'note_updated' ? 'Note updated' : 'Note added',
        summary: content || null,
        chips: [],
      };
    }

    default:
      return {
        title: activity.title || getActivityMeta(activity.activityType).label,
        summary: activity.description || null,
        chips: buildPayloadDetailChips(activity),
      };
  }
}

export interface ActivityLink {
  label: string;
  href: string;
}

export function getActivityLinks(activity: ContactActivity): ActivityLink[] {
  const links: ActivityLink[] = [];
  const payload = activity.payload || {};
  const seen = new Set<string>();

  const push = (href: string, label: string) => {
    if (!href || seen.has(href)) return;
    seen.add(href);
    links.push({ href, label });
  };

  const propertyId = payload.propertyId || (activity.relatedEntityType === 'property' ? activity.relatedEntityId : null);
  if (propertyId) {
    const label = String(payload.propertyTitle || activity.relatedEntityName || 'View property');
    push(`/crm/properties/${propertyId}`, label);
  }

  if (payload.buyerId || payload.buyerContactId) {
    const name = partyName(payload.buyerName);
    const href = payload.buyerContactId
      ? `/crm/contacts/${payload.buyerContactId}`
      : `/crm/buyers/${payload.buyerId}`;
    push(String(href), name ? `Buyer: ${name}` : 'View buyer');
  }

  if (payload.sellerId || payload.sellerContactId || payload.fromContactId) {
    const sellerRef = payload.sellerContactId || payload.fromContactId || payload.sellerId;
    const name = partyName(payload.sellerName, payload.fromOwnerName);
    push(`/crm/contacts/${sellerRef}`, name ? `Seller: ${name}` : 'View seller');
  }

  if (payload.tenantId && String(payload.tenantId) !== String(propertyId || '')) {
    const name = partyName(payload.tenantName);
    push(`/crm/tenants/${payload.tenantId}`, name ? `Tenant: ${name}` : 'View tenant');
  }

  if (payload.leadId) {
    const ref = shortId(payload.leadId);
    push(`/crm/leads/${payload.leadId}`, ref ? `Original lead ${ref}` : 'View original lead');
  }

  if (payload.ownerId) {
    push(`/crm/owners/${payload.ownerId}`, partyName(payload.ownerName) || 'View owner');
  }

  if (payload.meetingId) {
    push(`/crm/calendar?meeting=${payload.meetingId}`, 'View meeting');
  }

  return links;
}

export function getActivityDetailChips(activity: ContactActivity): string[] {
  const narrative = getActivityNarrative(activity);
  if (narrative.chips.length > 0) return narrative.chips;
  return buildPayloadDetailChips(activity);
}
