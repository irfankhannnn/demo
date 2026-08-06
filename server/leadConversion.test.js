import {
  deepClone,
  buildSourceLeadSnapshot,
  buildBuyerEntity,
  buildOwnerEntity,
  buildTenantEntity,
  buildTargetEntity,
  buildConversionSnapshotItem,
  estimateTransactItemCount,
  assertTransactSizeOk,
  validateConvertLeadOptions,
  phonesMatch,
  parsePropertyBhk,
  coerceFiniteNumber,
  coerceOptionalNumber,
  buildForSalePropertyItem,
  buildForRentPropertyItem,
  DYNAMO_TRANSACT_MAX_ITEMS,
  CONVERSION_SYSTEM_KEYS,
} from './services/leadConversionService.js';
import {
  hasLeadConversionTarget,
  isLeadConverted,
  isLeadConversionInProgress,
} from './crmDynamodbService.js';

describe('leadConversionService contracts', () => {
  const baseLead = {
    leadId: 'lead-1',
    leadType: 'buyer',
    name: 'Ada Buyer',
    phone: '9876543210',
    email: 'ada@test.com',
    notes: 'wants 2bhk',
    priority: 'high',
    status: 'qualified',
    buyerRequirement: {
      budget: 5000000,
      preferredArea: 'Andheri',
      propertyType: 'apartment',
      bhk: 2,
      furnishing: 'semi-furnished',
      requirement: 'Near metro',
    },
    history: [{ action: 'Lead Created', details: 'created' }],
    convertingLockAt: 'should-be-stripped',
    convertedAt: null,
  };

  test('buildSourceLeadSnapshot preserves lead fields and strips system keys', () => {
    const notes = [{ noteId: 'n1', content: 'hello', createdAt: '2026-01-01' }];
    const snap = buildSourceLeadSnapshot(baseLead, notes, []);
    expect(snap.lead.name).toBe('Ada Buyer');
    expect(snap.lead.buyerRequirement.budget).toBe(5000000);
    expect(snap.lead.history).toEqual(baseLead.history);
    expect(snap.notes[0].content).toBe('hello');
    for (const key of CONVERSION_SYSTEM_KEYS) {
      expect(snap.lead[key]).toBeUndefined();
    }
  });

  test('deepClone is lossless for nested structures', () => {
    const cloned = deepClone(baseLead.buyerRequirement);
    expect(cloned).toEqual(baseLead.buyerRequirement);
    expect(cloned).not.toBe(baseLead.buyerRequirement);
  });

  test('buildBuyerEntity maps requirement fields and supports merge', () => {
    const created = buildBuyerEntity(baseLead, { convertedBy: 'agent' }, null);
    expect(created.entityType).toBe('buyer');
    expect(created.item.budget).toBe(5000000);
    expect(created.item.preferredArea).toBe('Andheri');
    expect(created.wasExisting).toBe(false);

    const existing = {
      buyerId: 'buyer-existing',
      name: 'Existing Name',
      phone: '9876543210',
      budget: 1000,
      preferredArea: 'Old Area',
    };
    const merged = buildBuyerEntity(baseLead, { convertedBy: 'agent' }, existing);
    expect(merged.entityId).toBe('buyer-existing');
    expect(merged.wasExisting).toBe(true);
    expect(merged.item.name).toBe('Existing Name');
    expect(merged.item.budget).toBe(5000000);
    expect(merged.item.preferredArea).toBe('Andheri');
  });

  test('buildOwnerEntity for seller and owner roles', () => {
    const sellerLead = {
      ...baseLead,
      leadType: 'seller',
      sellerProperty: { expectedPrice: 9000000, area: 'Bandra', propertyType: 'apartment' },
    };
    const seller = buildOwnerEntity(sellerLead, { convertedBy: 'a' }, null, { asSeller: true });
    expect(seller.entityType).toBe('seller');
    expect(seller.item.convertedAsSeller).toBe(true);
    expect(seller.item.sellerProfile.expectedPrice).toBe(9000000);

    const ownerLead = {
      ...baseLead,
      leadType: 'owner',
      ownerProperty: { rentExpected: 45000, area: 'Powai' },
    };
    const owner = buildOwnerEntity(ownerLead, { convertedBy: 'a' }, null, { asSeller: false });
    expect(owner.entityType).toBe('owner');
    expect(owner.item.ownerProfile.rentExpected).toBe(45000);
  });

  test('buildTenantEntity preserves tenantRequirement', () => {
    const tenantLead = {
      ...baseLead,
      leadType: 'tenant',
      tenantRequirement: { budget: 30000, preferredArea: 'Thane', moveInDate: '2026-08-01' },
    };
    const tenant = buildTenantEntity(tenantLead, { convertedBy: 'a' }, null);
    expect(tenant.entityType).toBe('tenant');
    expect(tenant.storageType).toBe('CUSTOMER');
    expect(tenant.item.tenantRequirement.preferredArea).toBe('Thane');
  });

  test('buildTargetEntity routes by leadType', () => {
    expect(buildTargetEntity({ ...baseLead, leadType: 'buyer' }, {}).entityType).toBe('buyer');
    expect(buildTargetEntity({ ...baseLead, leadType: 'seller', sellerProperty: {} }, {}).entityType).toBe('seller');
    expect(buildTargetEntity({ ...baseLead, leadType: 'tenant', tenantRequirement: {} }, {}).entityType).toBe('tenant');
    expect(buildTargetEntity({ ...baseLead, leadType: 'owner', ownerProperty: {} }, {}).entityType).toBe('owner');
  });

  test('buildConversionSnapshotItem stores immutable sourceLeadSnapshot', () => {
    const item = buildConversionSnapshotItem('tenant-1', {
      conversionSnapshotId: 'snap-1',
      lead: baseLead,
      notes: [{ noteId: 'n1', content: 'x' }],
      meetings: [],
      entityType: 'buyer',
      entityId: 'buyer-1',
      role: 'buyer',
      options: { convertedBy: 'agent' },
      convertedAt: '2026-07-23T00:00:00.000Z',
    });
    expect(item.EntityType).toBe('LEAD_CONVERSION');
    expect(item.sourceLeadId).toBe('lead-1');
    expect(item.sourceLeadSnapshot.lead.buyerRequirement.budget).toBe(5000000);
    expect(item.sourceLeadSnapshot.lead.convertingLockAt).toBeUndefined();
  });

  test('transaction size preflight rejects oversized conversions', () => {
    const ok = estimateTransactItemCount({ noteCount: 10, meetingCount: 2 });
    expect(ok).toBeLessThanOrEqual(DYNAMO_TRANSACT_MAX_ITEMS);
    expect(() => assertTransactSizeOk(ok)).not.toThrow();

    const tooBig = estimateTransactItemCount({
      noteCount: 60,
      meetingCount: 10,
      includeProperty: true,
      includePropertyUpdate: true,
    });
    expect(tooBig).toBeGreaterThan(DYNAMO_TRANSACT_MAX_ITEMS);
    expect(() => assertTransactSizeOk(tooBig)).toThrow(/exceeds the 100/);
  });

  test('validateConvertLeadOptions requires nested propertyIds when details present', () => {
    expect(() => validateConvertLeadOptions({ purchaseDetails: { saleAmount: 1 } }))
      .toThrow(/purchaseDetails.propertyId/);
    expect(() => validateConvertLeadOptions({ leaseDetails: { monthlyRent: 1 } }))
      .toThrow(/leaseDetails.propertyId/);
    const ok = validateConvertLeadOptions({
      purchaseDetails: { propertyId: 'p1', saleAmount: 100 },
    });
    expect(ok.purchaseDetails.propertyId).toBe('p1');
  });

  test('phonesMatch normalizes indian mobiles', () => {
    expect(phonesMatch('9876543210', '+91 98765 43210')).toBe(true);
    expect(phonesMatch('9876543210', '9123456789')).toBe(false);
  });

  test('parsePropertyBhk maps lead labels to numeric property bhk', () => {
    expect(parsePropertyBhk('3 BHK')).toBe(3);
    expect(parsePropertyBhk('2.5 BHK')).toBe(2.5);
    expect(parsePropertyBhk('Studio')).toBe(0);
    expect(parsePropertyBhk('5+ BHK')).toBe(5);
    expect(parsePropertyBhk(4)).toBe(4);
    expect(parsePropertyBhk('invalid')).toBe(1);
    expect(parsePropertyBhk(null)).toBe(1);
  });

  test('buildForSalePropertyItem never writes NaN for bhk or carpetArea', () => {
    const lead = {
      leadId: 'lead-seller',
      name: 'Seller',
      phone: '9876543210',
      sellerProperty: {
        propertyType: 'apartment',
        bhk: '3 BHK',
        carpetArea: '2200',
        expectedPrice: '12500000',
        area: 'Bandra',
      },
    };
    const owner = { ownerId: 'owner-1', name: 'Seller', phone: '9876543210' };
    const { item } = buildForSalePropertyItem('tenant-1', lead, owner, { convertedBy: 'agent' });
    expect(item.bhk).toBe(3);
    expect(item.carpetArea).toBe(2200);
    expect(item.saleInfo.listedPrice).toBe(12500000);
    expect(Number.isFinite(item.bhk)).toBe(true);
    expect(Number.isFinite(item.carpetArea)).toBe(true);
  });

  test('buildForRentPropertyItem never writes NaN for bhk or rent fields', () => {
    const lead = {
      leadId: 'lead-owner',
      name: 'Owner',
      phone: '9876543210',
      ownerProperty: {
        propertyType: 'villa',
        bhk: '2.5 BHK',
        carpetArea: '1800',
        rentExpected: '85000',
        securityDeposit: '255000',
        area: 'Powai',
      },
    };
    const owner = { ownerId: 'owner-2', name: 'Owner', phone: '9876543210' };
    const { item } = buildForRentPropertyItem('tenant-1', lead, owner, { convertedBy: 'agent' });
    expect(item.bhk).toBe(2.5);
    expect(item.carpetArea).toBe(1800);
    expect(item.rentAmount).toBe(85000);
    expect(item.depositAmount).toBe(255000);
    expect(Number.isFinite(item.bhk)).toBe(true);
    expect(Number.isFinite(item.rentAmount)).toBe(true);
  });
});

describe('lead conversion helpers (post-lock redesign)', () => {
  test('active pipeline lead is not converted', () => {
    expect(isLeadConverted({ status: 'qualified' })).toBe(false);
    expect(hasLeadConversionTarget({ status: 'qualified' })).toBe(false);
  });

  test('convertedTo with entityId marks lead converted', () => {
    expect(isLeadConverted({
      status: 'converted',
      convertedAt: '2026-01-01T00:00:00.000Z',
      convertedTo: { entityType: 'buyer', entityId: 'buyer-1', role: 'buyer' },
    })).toBe(true);
  });

  test('conversion-in-progress helper is always false (locks removed)', () => {
    expect(isLeadConversionInProgress({
      convertingLockAt: new Date().toISOString(),
    })).toBe(false);
  });
});
