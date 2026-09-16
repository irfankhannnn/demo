/**
 * Property projections handed to other services (the voice agent in
 * ai-calling-service, the follow-up agent) — never to a browser.
 *
 * Every property that leaves the CRM over an internal route goes through one of
 * the two allowlists below, so the same rule applies on every endpoint: the
 * caller gets what it needs to describe a listing on a phone call and nothing
 * else — no `ownerPhone`, no `ownerSnapshot`, no legal-document S3 keys (Bugs B
 * and C in docs/services/followup-agent-service/APPROVAL-PLAN.md).
 *
 * Field names on the right-hand side are the *real* PROPERTY item attributes
 * written by crmDynamodbService.createProperty: `bhk` (not `bedrooms`),
 * `rentAmount` / `rentalInfo.expectedRent` (not `rent`),
 * `rentalInfo.securityDeposit` (not `deposit`), `carpetArea` (not `squareFeet`).
 * The left-hand names are kept for the agent tools that already consume them.
 */

/**
 * The three statuses under which a listing is actively marketed. 'available'
 * is the legacy default createProperty falls back to; 'for-sale' / 'for-rent'
 * are what real listings carry (see routes/crm.js public routes and
 * getProperties' 'available' alias, which deliberately covers only the latter
 * two — we include all three so a legacy listing is still offered on a call).
 */
export const LISTABLE_STATUSES = ['available', 'for-sale', 'for-rent'];

function num(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Monthly rent as stored today, or on the older top-level attribute. */
export function propertyRent(p) {
  return num(p?.rentAmount) ?? num(p?.rentalInfo?.expectedRent);
}

/** Asking price, checking the sale blob first, then the older flat fields. */
export function propertyPrice(p) {
  return num(p?.saleInfo?.listedPrice) ?? num(p?.price) ?? num(p?.salePrice);
}

/** Security deposit lives in the rental blob; older rows kept it flat. */
export function propertyDeposit(p) {
  return num(p?.rentalInfo?.securityDeposit) ?? num(p?.securityDeposit) ?? num(p?.depositAmount);
}

/**
 * The compact shape routes/aiCallingInternal.js has always returned from
 * /properties/available and /properties/match — now sourced from the real
 * attributes. Kept flat so the voice agent's tool schema does not change.
 */
export function simplifyPropertyForAgent(p) {
  if (!p) return null;
  const rent = propertyRent(p);
  const price = propertyPrice(p);
  return {
    propertyId: p.propertyId,
    title: p.title || null,
    propertyType: p.propertyType || null,
    bedrooms: num(p.bhk),
    bhk: num(p.bhk),
    bathrooms: num(p.bathrooms),
    area: p.area || null,
    city: p.city || null,
    address: p.address || null,
    buildingName: p.buildingName || null,
    // Historical name for "the number the caller cares about": rent on a
    // rental, asking price on a sale. Both are also exposed under their own
    // names so the agent never has to guess which one it is looking at.
    rent: rent ?? price,
    rentAmount: rent,
    price,
    deposit: propertyDeposit(p),
    squareFeet: num(p.carpetArea),
    carpetArea: num(p.carpetArea),
    furnishing: p.furnishing || null,
    amenities: Array.isArray(p.amenities) ? p.amenities.slice(0, 5) : undefined,
    availableFrom: p.availableFrom || null,
    status: p.status || null,
  };
}

/**
 * The `property` shape in CONTRACTS.md 2.1 / 3.1 (what the follow-up service
 * passes to ai-calling-service as call context).
 */
export function toAgentPropertyContext(p) {
  if (!p) return null;
  return {
    propertyId: p.propertyId,
    title: p.title || null,
    propertyType: p.propertyType || null,
    bhk: num(p.bhk),
    area: p.area || null,
    city: p.city || null,
    buildingName: p.buildingName || null,
    address: p.address || null,
    price: propertyPrice(p),
    rentAmount: propertyRent(p),
    carpetArea: num(p.carpetArea),
    furnishing: p.furnishing || null,
    status: p.status || null,
  };
}

/**
 * Translate the query string of GET /api/internal/properties/available into
 * crmDynamodbService.getProperties' filter contract.
 *
 * The agent tool sends `type`, `location`, `bedrooms`, `minPrice`, `maxPrice`
 * (its historical vocabulary); newer callers may send the CRM's own names.
 * Both are accepted. `location` becomes `search`, the one getProperties
 * filter that ORs across area / buildingName / address / city — the older
 * code's OR over area+city+address, but on the real attributes.
 *
 * `minPrice` / `maxPrice` cannot be handed to getProperties: it only has
 * rent-specific and sale-specific bounds, and a generic budget from a caller
 * must match whichever of the two the listing carries. Those two are returned
 * separately in `priceRange` for the route to apply after the fetch.
 *
 * @returns {{ filters: object, status: string|null, priceRange: {min:number|null,max:number|null}, limit: number }}
 */
export function buildAvailablePropertyFilters(query = {}) {
  const filters = {};

  const propertyType = query.propertyType || query.type;
  if (propertyType) filters.propertyType = String(propertyType).toLowerCase();

  const bhk = query.bhk ?? query.bedrooms;
  if (bhk !== undefined && bhk !== null && String(bhk).trim() !== '') filters.bhk = String(bhk).trim();

  if (query.location) filters.search = String(query.location).trim();
  if (query.area) filters.area = String(query.area).trim();
  if (query.city) filters.city = String(query.city).trim();
  if (query.furnishing) filters.furnishing = String(query.furnishing).toLowerCase();

  for (const key of ['minRent', 'maxRent', 'minSalePrice', 'maxSalePrice']) {
    const n = num(query[key]);
    if (n !== null) filters[key] = n;
  }

  const status = query.status && LISTABLE_STATUSES.includes(String(query.status))
    ? String(query.status)
    : null;

  const limitRaw = parseInt(query.limit, 10);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 50) : 10;

  return {
    filters,
    status,
    priceRange: { min: num(query.minPrice), max: num(query.maxPrice) },
    limit,
  };
}

/**
 * Apply the parts of an /available query getProperties cannot: the listable
 * status set and the generic price band. Returns at most `limit` items.
 */
export function selectAvailableProperties(properties, { status, priceRange, limit }) {
  const allowed = status ? [status] : LISTABLE_STATUSES;
  const { min, max } = priceRange || {};

  return (properties || [])
    .filter((p) => allowed.includes(p.status))
    .filter((p) => {
      if (min === null && max === null) return true;
      if (min === undefined && max === undefined) return true;
      const amount = propertyRent(p) ?? propertyPrice(p) ?? 0;
      if (min !== null && min !== undefined && amount < min) return false;
      if (max !== null && max !== undefined && amount > max) return false;
      return true;
    })
    .slice(0, limit || 10);
}
