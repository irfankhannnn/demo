/**
 * CRM Domain Model — business lifecycle vocabulary
 *
 * Contact = permanent person identity + full history
 * Buyer / Seller / Owner / Tenant = current business relationship modules
 * Property.currentOwnerContactId = who owns the asset now (truth)
 * Listing = marketing state (independent of ownership)
 * SaleTransaction = first-class sale event
 * OwnershipHistory = immutable append-only transfer chain
 *
 * Agent-facing rules:
 * - Owners module = people who currently own ≥1 property (visible even if not listing)
 * - Sellers module = people currently marketing a sale listing
 * - Buyers module = seekers + purchased buyers (purchased stays visible)
 * - After sale: property market status = Not Listed; listing row = Sold
 */

export const CONTACT_ROLES = ['owner', 'seller', 'buyer', 'tenant'];

export const SELLER_LIFECYCLE = {
  ACTIVE: 'active',
  PAST: 'past',
  INACTIVE: 'inactive',
};

export const OWNER_LIFECYCLE = {
  ACTIVE: 'active',
  PASSIVE: 'passive',
  INACTIVE: 'inactive',
};

/** Buyer module status — seeking vs purchased vs archived */
export const BUYER_STATUS = {
  ACTIVE: 'active',
  PURCHASED: 'purchased',
  INACTIVE: 'inactive',
};

/** Tenant / CUSTOMER module status */
export const TENANT_STATUS = {
  ACTIVE: 'active',
  PAST: 'past',
  INACTIVE: 'inactive',
  /** @deprecated use PAST */
  VACATED: 'vacated',
};

export const LISTING_TYPES = ['sale', 'rent'];

export const LISTING_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  OFF_MARKET: 'off_market',
  EXPIRED: 'expired',
  WITHDRAWN: 'withdrawn',
  SOLD: 'sold',
  RENTED: 'rented',
};

export const SALE_VIA = {
  DIRECT: 'direct',
  THIRD_PARTY: 'third_party',
};

/**
 * Property market / occupancy status (ownership is separate).
 * Agent labels:
 *   for-sale → Available for Sale
 *   for-rent → Available for Rent
 *   rented   → Occupied
 *   not-listed → Not Listed (owned, not marketing)
 *   archived → Archived
 * Legacy aliases: inactive ≈ not-listed, available ≈ not-listed (portfolio), sold kept for history filters
 */
export const PROPERTY_STATUS = {
  NOT_LISTED: 'not-listed',
  /** @deprecated prefer NOT_LISTED — treated as alias */
  INACTIVE: 'inactive',
  /** @deprecated prefer NOT_LISTED for owned portfolio */
  AVAILABLE: 'available',
  FOR_SALE: 'for-sale',
  FOR_RENT: 'for-rent',
  RENTED: 'rented',
  SOLD: 'sold',
  ON_HOLD: 'on-hold',
  OUT_OF_STOCK: 'out-of-stock',
  ARCHIVED: 'archived',
};

/** Canonical marketing statuses for new writes */
export const PROPERTY_MARKETING_STATUSES = [
  PROPERTY_STATUS.NOT_LISTED,
  PROPERTY_STATUS.FOR_SALE,
  PROPERTY_STATUS.FOR_RENT,
  PROPERTY_STATUS.RENTED,
  PROPERTY_STATUS.ARCHIVED,
];

/** Statuses that mean "owned but not actively listed" */
export const PROPERTY_NOT_LISTED_ALIASES = new Set([
  PROPERTY_STATUS.NOT_LISTED,
  PROPERTY_STATUS.INACTIVE,
  PROPERTY_STATUS.AVAILABLE,
  PROPERTY_STATUS.ON_HOLD,
]);

/** True when property is owned inventory, not on the open market */
export function isPropertyNotListed(status) {
  return PROPERTY_NOT_LISTED_ALIASES.has(String(status || '').toLowerCase());
}

/** Normalize legacy statuses to canonical write value */
export function normalizePropertyMarketStatus(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'inactive' || s === 'available' || s === 'on-hold') return PROPERTY_STATUS.NOT_LISTED;
  if (s === 'out-of-stock') return PROPERTY_STATUS.ARCHIVED;
  return s || PROPERTY_STATUS.NOT_LISTED;
}

/** All recognized property.status values (including legacy aliases) */
export const ALL_PROPERTY_STATUSES = new Set(Object.values(PROPERTY_STATUS));

/**
 * Listing/ownership status changes are flexible — agents may switch between
 * for-sale, for-rent, not-listed, etc. without a rigid state machine.
 * Only rejects unknown target statuses.
 */
export function isValidPropertyStatusTransition(fromStatus, toStatus) {
  if (!toStatus) return true;
  const to = String(toStatus).toLowerCase();
  if (String(fromStatus || '').toLowerCase() === to) return true;
  return ALL_PROPERTY_STATUSES.has(to);
}

/** Statuses where marketing/listing price should not be shown */
export const PROPERTY_NO_MARKET_PRICE_STATUSES = new Set([
  PROPERTY_STATUS.NOT_LISTED,
  PROPERTY_STATUS.INACTIVE,
  PROPERTY_STATUS.AVAILABLE,
  PROPERTY_STATUS.ON_HOLD,
  PROPERTY_STATUS.RENTED,
  PROPERTY_STATUS.SOLD,
  PROPERTY_STATUS.ARCHIVED,
  PROPERTY_STATUS.OUT_OF_STOCK,
]);

/** Clear marketing ask prices; keep transactional fields (soldPrice, currentRent). */
export function buildClearedMarketingPricesPatch(property = {}) {
  return {
    rentAmount: null,
    saleInfo: {
      ...(property.saleInfo || {}),
      listedPrice: null,
    },
    rentalInfo: {
      ...(property.rentalInfo || {}),
      expectedRent: null,
    },
  };
}

/** Agent-facing label for property.status */
export function propertyStatusLabel(status) {
  const s = String(status || '').toLowerCase();
  const map = {
    'for-sale': 'Available for Sale',
    'for-rent': 'Available for Rent',
    rented: 'Occupied',
    sold: 'Sold',
    'not-listed': 'Not Listed',
    inactive: 'Not Listed',
    available: 'Not Listed',
    'on-hold': 'Not Listed',
    archived: 'Archived',
    'out-of-stock': 'Archived',
  };
  return map[s] || status || 'Not Listed';
}

/** Agent-facing label for buyer.status */
export function buyerStatusLabel(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'purchased') return 'Purchased';
  if (s === 'inactive') return 'Inactive';
  return 'Active';
}

/** DynamoDB key builders */
export function contactPk(tenantId, contactId) {
  return `TENANT#${tenantId}#CONTACT#${contactId}`;
}

export function propertyPk(tenantId, propertyId) {
  return `TENANT#${tenantId}#PROPERTY#${propertyId}`;
}

export function saleTransactionPk(tenantId, saleTransactionId) {
  return `TENANT#${tenantId}#SALE#${saleTransactionId}`;
}

export function listingPk(tenantId, listingId) {
  return `TENANT#${tenantId}#LISTING#${listingId}`;
}

/** GSI1: properties by current owner contact */
export function propertyOwnerGsi1Pk(tenantId, currentOwnerContactId) {
  if (currentOwnerContactId) {
    return `TENANT#${tenantId}#CONTACT#${currentOwnerContactId}`;
  }
  return `TENANT#${tenantId}#OWNER#UNASSIGNED`;
}

/** Legacy GSI1 (OWNER#) — kept during transition for dual-read */
export function propertyOwnerLegacyGsi1Pk(tenantId, ownerId) {
  if (ownerId) {
    return `TENANT#${tenantId}#OWNER#${ownerId}`;
  }
  return `TENANT#${tenantId}#OWNER#UNASSIGNED`;
}

/**
 * Resolve the canonical current-owner contact id from a property record.
 * Prefers currentOwnerContactId / ownerContactId; falls back to legacy ownerId.
 */
export function resolveCurrentOwnerContactId(property) {
  if (!property) return null;
  return property.currentOwnerContactId
    || property.ownerContactId
    || null;
}

/**
 * True when a property is currently owned by the given owner/contact ids.
 * Prefer contact id (canonical); fall back to legacy ownerId.
 */
export function propertyIsCurrentlyOwnedBy(property, { ownerId = null, contactId = null } = {}) {
  if (!property) return false;
  const currentContactId = resolveCurrentOwnerContactId(property);
  if (contactId && currentContactId && currentContactId === contactId) return true;
  if (ownerId && property.ownerId && property.ownerId === ownerId) return true;
  return false;
}

/**
 * Build a default SellerProfile shell.
 */
export function buildSellerProfile(partial = {}) {
  return {
    lifecycleStatus: partial.lifecycleStatus || SELLER_LIFECYCLE.ACTIVE,
    listingPreferences: partial.listingPreferences || null,
    notes: partial.notes || null,
    soldPropertyIds: Array.isArray(partial.soldPropertyIds) ? partial.soldPropertyIds : [],
    activeListingIds: Array.isArray(partial.activeListingIds) ? partial.activeListingIds : [],
    ...partial,
  };
}

/**
 * Build a default OwnerProfile shell.
 */
export function buildOwnerProfile(partial = {}) {
  return {
    lifecycleStatus: partial.lifecycleStatus || OWNER_LIFECYCLE.ACTIVE,
    ownedPropertyIds: Array.isArray(partial.ownedPropertyIds) ? partial.ownedPropertyIds : [],
    notes: partial.notes || null,
    ...partial,
  };
}

/**
 * Build a default BuyerProfile shell.
 */
export function buildBuyerProfile(partial = {}) {
  return {
    budget: partial.budget ?? null,
    preferredArea: partial.preferredArea ?? null,
    propertyType: partial.propertyType ?? null,
    bhk: partial.bhk ?? null,
    requirement: partial.requirement ?? null,
    timeline: partial.timeline ?? null,
    financingStatus: partial.financingStatus ?? null,
    ...partial,
  };
}

/**
 * Build an immutable ownership history entry.
 */
export function buildOwnershipTransferEntry({
  fromContactId = null,
  toContactId = null,
  fromOwnerId = null,
  toOwnerId = null,
  fromOwnerName = null,
  toOwnerName = null,
  buyerId = null,
  buyerContactId = null,
  sellerContactId = null,
  saleTransactionId = null,
  saleDate = null,
  salePrice = null,
  soldVia = SALE_VIA.DIRECT,
  reasonLost = null,
  notes = null,
} = {}) {
  return {
    fromContactId,
    toContactId,
    fromOwnerId,
    toOwnerId,
    fromOwnerName,
    toOwnerName,
    buyerId: buyerContactId || buyerId || toContactId,
    buyerContactId: buyerContactId || buyerId || toContactId,
    sellerContactId: sellerContactId || fromContactId,
    saleTransactionId,
    saleDate: saleDate || new Date().toISOString(),
    salePrice: salePrice != null ? Number(salePrice) : null,
    soldVia,
    reasonLost,
    notes,
  };
}

export default {
  CONTACT_ROLES,
  SELLER_LIFECYCLE,
  OWNER_LIFECYCLE,
  BUYER_STATUS,
  TENANT_STATUS,
  LISTING_TYPES,
  LISTING_STATUS,
  SALE_VIA,
  PROPERTY_STATUS,
  PROPERTY_MARKETING_STATUSES,
  PROPERTY_NOT_LISTED_ALIASES,
  isPropertyNotListed,
  normalizePropertyMarketStatus,
  isValidPropertyStatusTransition,
  ALL_PROPERTY_STATUSES,
  propertyStatusLabel,
  buyerStatusLabel,
  contactPk,
  propertyPk,
  saleTransactionPk,
  listingPk,
  propertyOwnerGsi1Pk,
  propertyOwnerLegacyGsi1Pk,
  resolveCurrentOwnerContactId,
  propertyIsCurrentlyOwnedBy,
  buildSellerProfile,
  buildOwnerProfile,
  buildBuyerProfile,
  buildOwnershipTransferEntry,
};
