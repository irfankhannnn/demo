/**
 * Standalone verification for leadConversionService (no Jest required).
 * Run: node scripts/verify-lead-conversion-service.mjs
 */
import assert from 'assert';
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
  DYNAMO_TRANSACT_MAX_ITEMS,
  CONVERSION_SYSTEM_KEYS,
} from '../services/leadConversionService.js';

const baseLead = {
  leadId: 'lead-1',
  leadType: 'buyer',
  name: 'Ada Buyer',
  phone: '9876543210',
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
};

const snap = buildSourceLeadSnapshot(baseLead, [{ noteId: 'n1', content: 'hello' }], []);
assert.strictEqual(snap.lead.name, 'Ada Buyer');
assert.strictEqual(snap.lead.buyerRequirement.budget, 5000000);
for (const key of CONVERSION_SYSTEM_KEYS) {
  assert.strictEqual(snap.lead[key], undefined);
}

const buyer = buildBuyerEntity(baseLead, { convertedBy: 'agent' }, null);
assert.strictEqual(buyer.entityType, 'buyer');
assert.strictEqual(buyer.item.budget, 5000000);

const seller = buildOwnerEntity(
  { ...baseLead, leadType: 'seller', sellerProperty: { expectedPrice: 9e6, area: 'Bandra' } },
  { convertedBy: 'a' },
  null,
  { asSeller: true },
);
assert.strictEqual(seller.entityType, 'seller');

const tenant = buildTenantEntity(
  { ...baseLead, leadType: 'tenant', tenantRequirement: { budget: 30000, preferredArea: 'Thane' } },
  { convertedBy: 'a' },
  null,
);
assert.strictEqual(tenant.entityType, 'tenant');
assert.strictEqual(tenant.storageType, 'CUSTOMER');

assert.strictEqual(buildTargetEntity({ ...baseLead, leadType: 'owner', ownerProperty: {} }, {}).entityType, 'owner');

const item = buildConversionSnapshotItem('t1', {
  conversionSnapshotId: 's1',
  lead: baseLead,
  notes: [],
  meetings: [],
  entityType: 'buyer',
  entityId: 'b1',
  role: 'buyer',
  options: { convertedBy: 'a' },
  convertedAt: '2026-07-23T00:00:00.000Z',
});
assert.strictEqual(item.EntityType, 'LEAD_CONVERSION');
assert.strictEqual(item.sourceLeadSnapshot.lead.convertingLockAt, undefined);

assert.ok(estimateTransactItemCount({ noteCount: 2 }) < DYNAMO_TRANSACT_MAX_ITEMS);
assert.throws(() => assertTransactSizeOk(101));
assert.throws(() => validateConvertLeadOptions({ purchaseDetails: { saleAmount: 1 } }));
assert.ok(phonesMatch('9876543210', '+91 98765 43210'));
assert.deepStrictEqual(deepClone({ a: 1 }), { a: 1 });

console.log('verify-lead-conversion-service: PASS');
