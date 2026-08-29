import { CRMProperty } from '../types/crm';

const NO_MARKET_PRICE_STATUSES = new Set([
  'not-listed',
  'inactive',
  'available',
  'on-hold',
  'rented',
  'sold',
  'archived',
  'out-of-stock',
]);

/** Listing/marketing price — N/A when property is not actively on the market. */
export function formatPropertyMarketPrice(property: Pick<CRMProperty, 'status' | 'saleInfo' | 'rentalInfo' | 'rentAmount'>): string {
  const status = String(property.status || '').toLowerCase();
  if (NO_MARKET_PRICE_STATUSES.has(status)) {
    return 'N/A';
  }

  if (status === 'for-sale') {
    const price = property.saleInfo?.listedPrice;
    if (price == null || Number(price) <= 0) return 'N/A';
    return `₹${Number(price).toLocaleString('en-IN')}`;
  }

  if (status === 'for-rent') {
    const rent = property.rentalInfo?.expectedRent ?? property.rentAmount;
    if (rent == null || Number(rent) <= 0) return 'N/A';
    return `₹${Number(rent).toLocaleString('en-IN')}/mo`;
  }

  return 'N/A';
}
