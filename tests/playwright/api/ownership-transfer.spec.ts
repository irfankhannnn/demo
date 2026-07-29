import { test, expect } from '@playwright/test';
import { API_URL } from '../helpers/config';
import { jsonAuthHeaders, resolveApiAuth } from '../helpers/apiAuth';

/**
 * Phase 2/3 ownership + listing contracts:
 * list-for-sale creates Listing, mark-sold transfers ownership via transferOwnership().
 */
test.describe('Ownership transfer + Listing API', () => {
  test('list-for-sale creates Listing; mark-sold sets currentOwnerContactId and closes listing', async ({ request }) => {
    const auth = resolveApiAuth();
    test.skip(!auth.token, 'No API token — run auth setup first');

    const headers = jsonAuthHeaders(auth);
    const stamp = Date.now().toString().slice(-6);
    const sellerPhone = `98765${stamp}`.slice(0, 10);
    const buyerPhone = `98675${stamp}`.slice(0, 10);

    // Seller owner (createOwnerSchema is strict — no status field)
    const ownerRes = await request.post(`${API_URL}/crm/owners`, {
      headers,
      data: { name: `OW Seller ${stamp}`, phone: sellerPhone },
    });
    if (![200, 201].includes(ownerRes.status())) {
      const errBody = await ownerRes.json().catch(() => ({}));
      throw new Error(`Owner create failed: ${ownerRes.status()} ${JSON.stringify(errBody)}`);
    }
    const owner = await ownerRes.json();
    const ownerId = owner.ownerId || owner.id;
    expect(ownerId).toBeTruthy();

    // Property
    const propRes = await request.post(`${API_URL}/crm/properties`, {
      headers,
      data: {
        title: `OW Property ${stamp}`,
        ownerId,
        status: 'available',
        propertyType: 'apartment',
        bhk: 2,
        area: 'Andheri',
        city: 'Mumbai',
        carpetArea: 800,
        furnishing: 'unfurnished',
      },
    });
    expect([200, 201]).toContain(propRes.status());
    const property = await propRes.json();
    const propertyId = property.propertyId || property.id;
    expect(propertyId).toBeTruthy();

    // List for sale → Listing entity
    const listRes = await request.post(`${API_URL}/crm/properties/${propertyId}/list-for-sale`, {
      headers,
      data: { listedPrice: 7500000 },
    });
    expect([200, 201]).toContain(listRes.status());
    const listed = await listRes.json();
    expect(listed.status).toBe('for-sale');
    expect(listed.listingStatus === 'active' || listed.listing).toBeTruthy();

    const listingsRes = await request.get(`${API_URL}/crm/listings?propertyId=${propertyId}&status=active`, {
      headers,
    });
    expect(listingsRes.status()).toBe(200);
    const listingsBody = await listingsRes.json();
    const listings = listingsBody.listings || [];
    expect(listings.length).toBeGreaterThan(0);
    expect(listings[0].listingType).toBe('sale');
    expect(listings[0].status).toBe('active');

    // Buyer
    const buyerRes = await request.post(`${API_URL}/crm/buyers`, {
      headers,
      data: {
        name: `OW Buyer ${stamp}`,
        phone: buyerPhone,
        status: 'active',
        budget: 8000000,
      },
    });
    expect([200, 201]).toContain(buyerRes.status());
    const buyer = await buyerRes.json();
    const buyerId = buyer.buyerId || buyer.id;
    expect(buyerId).toBeTruthy();

    // Mark sold
    const soldRes = await request.post(`${API_URL}/crm/properties/${propertyId}/mark-sold`, {
      headers,
      data: {
        soldPrice: 7400000,
        buyerId,
        saleType: 'direct',
        brokerageAmount: 100000,
      },
    });
    expect([200, 201]).toContain(soldRes.status());
    const soldBody = await soldRes.json();

    const propAfterRes = await request.get(`${API_URL}/crm/properties/${propertyId}`, { headers });
    expect(propAfterRes.status()).toBe(200);
    const propAfter = await propAfterRes.json();

    expect(propAfter.status || soldBody.status).toBe('sold');
    expect((propAfter.ownerId ?? soldBody.ownerId) == null).toBeTruthy();
    expect(propAfter.currentOwnerContactId || soldBody.currentOwnerContactId).toBeTruthy();
    expect(propAfter.saleInfo?.soldToBuyerId || propAfter.saleInfo?.soldToBuyerContactId || soldBody.saleInfo?.soldToBuyerId).toBeTruthy();
    expect(Array.isArray(propAfter.ownershipHistory) ? propAfter.ownershipHistory.length : (soldBody.ownershipHistory || []).length).toBeGreaterThan(0);

    const closedListingsRes = await request.get(`${API_URL}/crm/listings?propertyId=${propertyId}`, {
      headers,
    });
    const closedBody = await closedListingsRes.json();
    const closed = (closedBody.listings || []).filter((l: any) => l.status === 'sold' || l.status === 'withdrawn');
    expect(closed.length).toBeGreaterThan(0);
  });
});
