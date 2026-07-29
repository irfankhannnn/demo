import {
  createTestRun,
  generateTestEmail,
  generateTestPhone,
  generateUniqueName,
  getItemByIndex,
  SEED_DATA,
  TestRunContext,
} from './seedData';
import type { LeadType } from './leadFieldCatalog';

export interface BuyerRequirementFixture {
  requirement: string;
  budget: number;
  preferredArea: string;
  propertyType: string;
  bhk: number;
}

export interface SellerPropertyFixture {
  propertyType: string;
  bhk: number;
  buildingName: string;
  flatNumber: string;
  floor: string;
  furnishing: string;
  carpetArea: number;
  area: string;
  city: string;
  expectedPrice: number;
  timeline: string;
  address: string;
}

export interface TenantRequirementFixture {
  requirement: string;
  budget: number;
  preferredArea: string;
  moveInDate: string;
}

export interface OwnerPropertyFixture {
  propertyType: string;
  bhk: number;
  buildingName: string;
  flatNumber: string;
  floor: string;
  furnishing: string;
  carpetArea: number;
  area: string;
  city: string;
  rentExpected: number;
  securityDeposit: number;
  address: string;
}

export interface CompleteLeadFixture {
  leadType: LeadType;
  name: string;
  phone: string;
  email: string;
  source: string;
  status: string;
  priority: string;
  notes: string;
  activityNote: string;
  lostReason?: string;
  buyerRequirement?: BuyerRequirementFixture;
  sellerProperty?: SellerPropertyFixture;
  tenantRequirement?: TenantRequirementFixture;
  ownerProperty?: OwnerPropertyFixture;
}

function moveInDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split('T')[0];
}

function buildShared(run: TestRunContext, offset: number, leadType: LeadType) {
  const nameObj = generateUniqueName(run.runStamp, offset);
  const phone = generateTestPhone(offset + 1, run.phoneBase);
  const email = generateTestEmail(nameObj.firstName.toLowerCase(), offset + 1, 'test.com', run.runStamp);
  const area = getItemByIndex(SEED_DATA.preferredAreas, offset + 2);
  const city = getItemByIndex(SEED_DATA.propCities, offset + 3);
  const building = getItemByIndex(SEED_DATA.buildings, offset + 4);
  const snippet = getItemByIndex(SEED_DATA.requirementSnippets, offset + 5);
  const tag = nameObj.tag;

  return {
    nameObj,
    phone,
    email,
    area,
    city,
    building,
    snippet,
    tag,
    source: getItemByIndex(['Website', 'Referral', 'Google Ads', 'Property Portal'] as const, offset),
    priority: getItemByIndex(['low', 'medium', 'high'] as const, offset + 1),
    status: getItemByIndex(['new', 'contacted', 'qualified', 'negotiating'] as const, offset + 2),
    notes: `[E2E ${tag}] ${leadType} lead — general notes with full contact context. Created ${new Date().toISOString()}.`,
    activityNote: `[E2E ${tag}] Initial discovery call completed. Captured complete ${leadType} requirements in CRM.`,
  };
}

export function buildBuyerLeadFixture(run: TestRunContext, offset = 0): CompleteLeadFixture {
  const shared = buildShared(run, offset, 'buyer');
  const bhk = getItemByIndex([2, 3, 4] as const, offset);
  const propertyType = getItemByIndex(['apartment', 'villa', 'house'] as const, offset);
  const budget = (25 + offset) * 100_000;

  return {
    leadType: 'buyer',
    name: shared.nameObj.fullName,
    phone: shared.phone,
    email: shared.email,
    source: shared.source,
    status: 'qualified',
    priority: 'high',
    notes: shared.notes,
    activityNote: shared.activityNote,
    buyerRequirement: {
      requirement: `Seeking ${bhk} BHK ${propertyType} in ${shared.area}. ${shared.snippet}. Must have parking and lift.`,
      budget,
      preferredArea: shared.area,
      propertyType,
      bhk,
    },
  };
}

export function buildSellerLeadFixture(run: TestRunContext, offset = 10): CompleteLeadFixture {
  const shared = buildShared(run, offset, 'seller');
  const bhk = 3;
  const propertyType = 'apartment';
  const expectedPrice = 2_85_00_000;
  const flatNumber = `${120 + offset}A`;
  const floor = '12th';
  const carpetArea = 1850 + offset;

  return {
    leadType: 'seller',
    name: shared.nameObj.fullName,
    phone: shared.phone,
    email: shared.email,
    source: 'Broker Network',
    status: 'negotiating',
    priority: 'medium',
    notes: shared.notes,
    activityNote: shared.activityNote,
    sellerProperty: {
      propertyType,
      bhk,
      buildingName: shared.building,
      flatNumber,
      floor,
      furnishing: 'semi-furnished',
      carpetArea,
      area: shared.area,
      city: shared.city,
      expectedPrice,
      timeline: 'Within 3 months',
      address: `Tower B, ${shared.building}, ${flatNumber}, ${floor} Floor, ${shared.area}, ${shared.city} — 400050`,
    },
  };
}

export function buildTenantLeadFixture(run: TestRunContext, offset = 20): CompleteLeadFixture {
  const shared = buildShared(run, offset, 'tenant');
  const budget = 45_000 + offset * 500;

  return {
    leadType: 'tenant',
    name: shared.nameObj.fullName,
    phone: shared.phone,
    email: shared.email,
    source: 'Walk-in',
    status: 'lost',
    priority: 'low',
    lostReason: 'Found another property',
    notes: shared.notes,
    activityNote: shared.activityNote,
    tenantRequirement: {
      requirement: `Family of four needs furnished ${shared.area} rental near schools. ${shared.snippet}.`,
      budget,
      preferredArea: shared.area,
      moveInDate: moveInDate(45 + offset),
    },
  };
}

export function buildOwnerLeadFixture(run: TestRunContext, offset = 30): CompleteLeadFixture {
  const shared = buildShared(run, offset, 'owner');
  const bhk = 2;
  const propertyType = 'apartment';
  const rentExpected = 55_000 + offset * 100;
  const securityDeposit = rentExpected * 3;
  const flatNumber = `${401 + offset}`;
  const carpetArea = 980 + offset;

  return {
    leadType: 'owner',
    name: shared.nameObj.fullName,
    phone: shared.phone,
    email: shared.email,
    source: 'Social Media',
    status: 'contacted',
    priority: 'medium',
    notes: shared.notes,
    activityNote: shared.activityNote,
    ownerProperty: {
      propertyType,
      bhk,
      buildingName: shared.building,
      flatNumber,
      floor: '4th',
      furnishing: 'furnished',
      carpetArea,
      area: shared.area,
      city: shared.city,
      rentExpected,
      securityDeposit,
      address: `${shared.building}, Flat ${flatNumber}, 4th Floor, ${shared.area}, ${shared.city} — 400051`,
    },
  };
}

/** One fully-populated lead per subtype — every LeadDetails field filled. */
export function buildCompleteLeadFixtures(run: TestRunContext = createTestRun()): CompleteLeadFixture[] {
  return [
    buildBuyerLeadFixture(run, 0),
    buildSellerLeadFixture(run, 10),
    buildTenantLeadFixture(run, 20),
    buildOwnerLeadFixture(run, 30),
  ];
}
