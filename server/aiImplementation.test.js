/**
 * AI Implementation Tests — Verify normalizers, view builders, and middleware
 *
 * Run with: npm test -- aiImplementation.test.js
 */

import { normalizeLead, normalizeLeads } from './normalizers/leadNormalizer.js';
import { normalizeOwner, normalizeOwners } from './normalizers/ownerNormalizer.js';
import { normalizeTenant, normalizeTenants } from './normalizers/tenantNormalizer.js';
import { normalizeNote, normalizeNotes } from './normalizers/noteNormalizer.js';

import * as LeadAIViewBuilder from './aiViewBuilders/leadAIViewBuilder.js';
import * as OwnerAIViewBuilder from './aiViewBuilders/ownerAIViewBuilder.js';
import * as TenantAIViewBuilder from './aiViewBuilders/tenantAIViewBuilder.js';
import * as MeetingAIViewBuilder from './aiViewBuilders/meetingAIViewBuilder.js';

// ─── Test Fixtures ───────────────────────────────────────────────────────────

const mockLeadFromDb = {
  PK: 'TENANT#abc123#LEAD#lead-001',
  SK: 'LEAD#lead-001',
  GSI1PK: 'TENANT#abc123#LEAD#STATUS#new',
  GSI1SK: '2026-01-15T10:30:00Z',
  EntityType: 'Lead',
  tenantId: 'abc123',
  normalizedPhone: '9876543210',
  leadId: 'lead-001',
  name: 'Raj Kumar',
  phone: '+91-9876543210',
  email: 'raj@example.com',
  status: 'new',
  leadType: 'buyer',
  score: 'HOT',
  scoreValue: 75,
  source: 'website',
  createdAt: '2026-01-15T10:30:00Z',
  updatedAt: '2026-01-15T10:30:00Z',
  lastInteractionAt: '2026-01-16T14:20:00Z',
  notes: ['Interested in 2BHK', 'Budget 50L'],
  tags: ['hot', 'urgent'],
};

const mockOwnerFromDb = {
  PK: 'TENANT#abc123#OWNER#owner-001',
  SK: 'OWNER#owner-001',
  GSI1PK: 'TENANT#abc123#OWNER#STATUS#active',
  EntityType: 'Owner',
  tenantId: 'abc123',
  normalizedPhone: '9876543211',
  ownerId: 'owner-001',
  name: 'Priya Singh',
  phone: '+91-9876543211',
  email: 'priya@example.com',
  status: 'active',
  source: 'referral',
  createdAt: '2026-01-10T09:00:00Z',
  updatedAt: '2026-01-16T11:00:00Z',
  lastInteractionAt: '2026-01-16T11:00:00Z',
  notes: ['Has 2 properties'],
  tags: ['premium'],
  properties: ['prop-001', 'prop-002'],
};

const mockTenantFromDb = {
  PK: 'TENANT#abc123#CUSTOMER#cust-001',
  SK: 'CUSTOMER#cust-001',
  GSI1PK: 'TENANT#abc123#CUSTOMER#STATUS#active',
  EntityType: 'Customer',
  tenantId: 'abc123',
  normalizedPhone: '9876543212',
  customerId: 'cust-001',
  name: 'Amit Patel',
  phone: '+91-9876543212',
  email: 'amit@example.com',
  address: 'Bandra, Mumbai',
  status: 'active',
  source: 'agent',
  createdAt: '2026-01-05T08:00:00Z',
  updatedAt: '2026-01-16T12:00:00Z',
  lastInteractionAt: '2026-01-16T12:00:00Z',
  aadharNumber: '1234567890123456',
  aadharDocUrl: 'https://s3.amazonaws.com/aadhar.pdf',
  photoUrl: 'https://s3.amazonaws.com/photo.jpg',
  aadharDocS3Key: 's3://bucket/aadhar.pdf',
  photoS3Key: 's3://bucket/photo.jpg',
  notes: ['Active tenant', 'Pays on time'],
  tags: ['reliable'],
  currentRental: {
    propertyId: 'prop-001',
    leaseStartDate: '2025-06-01T00:00:00Z',
    leaseEndDate: '2027-05-31T00:00:00Z',
    monthlyRent: 25000,
    securityDeposit: 75000,
    leaseAgreementUrl: 'https://s3.amazonaws.com/lease.pdf',
    leaseAgreementS3Key: 's3://bucket/lease.pdf',
  },
  rentalHistory: [],
};

const mockBuyerLeadFromDb = {
  ...mockLeadFromDb,
  leadType: 'buyer',
  assignedTo: 'agent-001',
  buyerRequirement: {
    budget: 5000000,
    preferredArea: 'Andheri',
    bhk: '2',
    propertyType: 'apartment',
    furnishing: 'semi-furnished',
    requirement: 'Looking for 2BHK near metro',
  },
};

const mockNoteFromDb = {
  PK: 'TENANT#abc123#LEAD#lead-001',
  SK: 'NOTE#note-001',
  EntityType: 'NOTE',
  tenantId: 'abc123',
  leadId: 'lead-001',
  noteId: 'note-001',
  content: 'Interested in 2BHK',
  createdBy: 'agent-001',
  createdAt: '2026-01-16T10:00:00Z',
};

// ─── Normalizer Tests ────────────────────────────────────────────────────────

describe('LeadNormalizer', () => {
  test('normalizeLead removes internal fields', () => {
    const normalized = normalizeLead(mockLeadFromDb);

    expect(normalized.PK).toBeUndefined();
    expect(normalized.SK).toBeUndefined();
    expect(normalized.GSI1PK).toBeUndefined();
    expect(normalized.EntityType).toBeUndefined();
    expect(normalized.tenantId).toBeUndefined();
    expect(normalized.normalizedPhone).toBeUndefined();
  });

  test('normalizeLead preserves key fields', () => {
    const normalized = normalizeLead(mockLeadFromDb);

    expect(normalized.leadId).toBe('lead-001');
    expect(normalized.name).toBe('Raj Kumar');
    expect(normalized.phone).toBe('9876543210');
    expect(normalized.email).toBe('raj@example.com');
    expect(normalized.status).toBe('new');
    expect(normalized.leadType).toBe('buyer');
  });

  test('normalizeLead normalizes timestamps to ISO', () => {
    const normalized = normalizeLead(mockLeadFromDb);

    expect(normalized.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(normalized.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(normalized.lastInteractionAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test('normalizeLeads handles arrays', () => {
    const normalized = normalizeLeads([mockLeadFromDb, mockLeadFromDb]);

    expect(Array.isArray(normalized)).toBe(true);
    expect(normalized.length).toBe(2);
    expect(normalized[0].leadId).toBe('lead-001');
  });
});

describe('OwnerNormalizer', () => {
  test('normalizeOwner removes internal fields', () => {
    const normalized = normalizeOwner(mockOwnerFromDb);

    expect(normalized.PK).toBeUndefined();
    expect(normalized.SK).toBeUndefined();
    expect(normalized.EntityType).toBeUndefined();
  });

  test('normalizeOwner computes propertyCount', () => {
    const normalized = normalizeOwner(mockOwnerFromDb);

    expect(normalized.propertyCount).toBe(2);
  });
});

describe('TenantNormalizer', () => {
  test('normalizeTenant removes internal fields', () => {
    const normalized = normalizeTenant(mockTenantFromDb);

    expect(normalized.PK).toBeUndefined();
    expect(normalized.aadharDocS3Key).toBeUndefined();
    expect(normalized.photoS3Key).toBeUndefined();
  });

  test('normalizeTenant removes S3 keys from currentRental', () => {
    const normalized = normalizeTenant(mockTenantFromDb);

    expect(normalized.currentRental.leaseAgreementS3Key).toBeUndefined();
    expect(normalized.currentRental.leaseAgreementUrl).toBe('https://s3.amazonaws.com/lease.pdf');
  });

  test('normalizeTenant derives KYC status', () => {
    const normalized = normalizeTenant(mockTenantFromDb);

    expect(normalized.kycStatus.hasAadhar).toBe(true);
    expect(normalized.kycStatus.hasAadharDoc).toBe(true);
    expect(normalized.kycStatus.hasPhoto).toBe(true);
    expect(normalized.kycStatus.complete).toBe(true);
  });

  test('normalizeTenant marks hasCurrentRental', () => {
    const normalized = normalizeTenant(mockTenantFromDb);

    expect(normalized.hasCurrentRental).toBe(true);
  });
});

describe('NoteNormalizer', () => {
  test('normalizeNote removes internal fields', () => {
    const normalized = normalizeNote(mockNoteFromDb);

    expect(normalized.PK).toBeUndefined();
    expect(normalized.SK).toBeUndefined();
    expect(normalized.EntityType).toBeUndefined();
    expect(normalized.tenantId).toBeUndefined();
    expect(normalized.leadId).toBeUndefined();
  });

  test('normalizeNote preserves key fields', () => {
    const normalized = normalizeNote(mockNoteFromDb);

    expect(normalized.noteId).toBe('note-001');
    expect(normalized.content).toBe('Interested in 2BHK');
    expect(normalized.createdBy).toBe('agent-001');
    expect(normalized.createdAt).toBe('2026-01-16T10:00:00Z');
  });

  test('normalizeNotes handles arrays', () => {
    const normalized = normalizeNotes([mockNoteFromDb, mockNoteFromDb]);

    expect(Array.isArray(normalized)).toBe(true);
    expect(normalized.length).toBe(2);
    expect(normalized[0].noteId).toBe('note-001');
  });
});

// ─── View Builder Tests ──────────────────────────────────────────────────────

describe('LeadAIViewBuilder', () => {
  test('buildSearchResults returns envelope with metadata', () => {
    const normalized = normalizeLead(mockLeadFromDb);
    const result = LeadAIViewBuilder.buildSearchResults([normalized]);

    expect(result.metadata).toBeDefined();
    expect(result.data).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data[0].leadId).toBe('lead-001');
  });

  test('buildLeadDetails includes notes', () => {
    const normalized = normalizeLead(mockLeadFromDb);
    const result = LeadAIViewBuilder.buildLeadDetails(normalized, { includeNotes: true });

    expect(result.data.notes).toBeDefined();
    expect(Array.isArray(result.data.notes)).toBe(true);
  });

  test('buildCreateConfirmation has action metadata', () => {
    const normalized = normalizeLead(mockLeadFromDb);
    const result = LeadAIViewBuilder.buildCreateConfirmation(normalized);

    expect(result.metadata.action).toBe('created');
    expect(result.data.leadId).toBe('lead-001');
  });

  test('buildLeadNotFoundError returns error DTO', () => {
    const result = LeadAIViewBuilder.buildLeadNotFoundError('lead-999');

    expect(result.metadata.error).toBe('lead_not_found');
    expect(result.data.leadId).toBe('lead-999');
  });

  test('buildLeadDetails includes requirement for buyer lead', () => {
    const normalized = normalizeLead(mockBuyerLeadFromDb);
    const result = LeadAIViewBuilder.buildLeadDetails(normalized);

    expect(result.data.requirement).toBeDefined();
    expect(result.data.requirement.budget).toBe('₹50L');
    expect(result.data.requirement.preferredArea).toBe('Andheri');
    expect(result.data.requirement.bhk).toBe('2');
    expect(result.data.temperature).toBe('HOT');
    expect(result.data.scoreValue).toBe(75);
    expect(result.data.assignedTo).toBe('agent-001');
  });

  test('buildSearchResults includes requirement summary for buyer lead', () => {
    const normalized = normalizeLead(mockBuyerLeadFromDb);
    const result = LeadAIViewBuilder.buildSearchResults([normalized]);

    expect(result.data[0].budget).toBe('₹50L');
    expect(result.data[0].area).toBe('Andheri');
    expect(result.data[0].propertyType).toBe('apartment');
  });

  test('buildDeleteConfirmation returns deleted action', () => {
    const normalized = normalizeLead(mockLeadFromDb);
    const result = LeadAIViewBuilder.buildDeleteConfirmation(normalized);

    expect(result.metadata.action).toBe('deleted');
    expect(result.data.leadId).toBe('lead-001');
  });

  test('buildAlreadyConvertedError returns error DTO', () => {
    const result = LeadAIViewBuilder.buildAlreadyConvertedError({ leadId: 'lead-001', name: 'Raj' });

    expect(result.metadata.error).toBe('already_converted');
    expect(result.data.leadId).toBe('lead-001');
  });
});

describe('OwnerAIViewBuilder', () => {
  test('buildSearchResults returns envelope', () => {
    const normalized = normalizeOwner(mockOwnerFromDb);
    const result = OwnerAIViewBuilder.buildSearchResults([normalized]);

    expect(result.metadata).toBeDefined();
    expect(result.data).toBeDefined();
    expect(result.data[0].ownerId).toBe('owner-001');
  });

  test('buildPhoneLookupResult handles found owner', () => {
    const normalized = normalizeOwner(mockOwnerFromDb);
    const result = OwnerAIViewBuilder.buildPhoneLookupResult(normalized, '9876543211');

    expect(result.data.found).toBe(true);
    expect(result.data.ownerId).toBe('owner-001');
  });

  test('buildPhoneLookupResult handles not found', () => {
    const result = OwnerAIViewBuilder.buildPhoneLookupResult(null, '9999999999');

    expect(result.data.found).toBe(false);
    expect(result.data.phone).toBe('9999999999');
  });

  test('buildOwnerDetails includes properties', () => {
    const normalized = normalizeOwner({ ...mockOwnerFromDb, properties: [{ propertyId: 'prop-001', title: 'Flat 101', area: 'Bandra', propertyType: 'apartment', status: 'for-rent' }] });
    const result = OwnerAIViewBuilder.buildOwnerDetails(normalized, { includeProperties: true });

    expect(result.data.properties).toBeDefined();
    expect(Array.isArray(result.data.properties)).toBe(true);
    expect(result.data.properties[0].propertyId).toBe('prop-001');
  });

  test('buildOwnerPropertiesList returns properties list', () => {
    const properties = [{ propertyId: 'prop-001', title: 'Flat 101', area: 'Bandra', propertyType: 'apartment', status: 'for-rent' }];
    const result = OwnerAIViewBuilder.buildOwnerPropertiesList(properties);

    expect(result.metadata).toBeDefined();
    expect(result.data).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
  });

  test('buildProfileNotesProtectedError returns error', () => {
    const normalized = normalizeOwner(mockOwnerFromDb);
    const result = OwnerAIViewBuilder.buildProfileNotesProtectedError(normalized, 'note-001');

    expect(result.metadata.error).toBe('profile_notes_protected');
    expect(result.data.ownerId).toBe('owner-001');
  });
});

describe('TenantAIViewBuilder', () => {
  test('buildSearchResults returns envelope', () => {
    const normalized = normalizeTenant(mockTenantFromDb);
    const result = TenantAIViewBuilder.buildSearchResults([normalized]);

    expect(result.metadata).toBeDefined();
    expect(result.data).toBeDefined();
    expect(result.data[0].customerId).toBe('cust-001');
  });

  test('buildTenantDetails includes rental info', () => {
    const normalized = normalizeTenant(mockTenantFromDb);
    const result = TenantAIViewBuilder.buildTenantDetails(normalized);

    expect(result.data.currentRental).toBeDefined();
    expect(result.metadata.rental.hasCurrentRental).toBe(true);
  });

  test('buildRentalHistory returns rental data', () => {
    const normalized = normalizeTenant(mockTenantFromDb);
    const result = TenantAIViewBuilder.buildRentalHistory(normalized);

    expect(result.data.currentRental).toBeDefined();
    expect(Array.isArray(result.data.rentalHistory)).toBe(true);
  });

  test('buildProfileNotesProtectedError returns error', () => {
    const normalized = normalizeTenant(mockTenantFromDb);
    const result = TenantAIViewBuilder.buildProfileNotesProtectedError(normalized, 'note-001');

    expect(result.metadata.error).toBe('profile_notes_protected');
    expect(result.data.customerId).toBe('cust-001');
  });

  test('buildRentalHistoryList returns list of rentals', () => {
    const rentals = [
      { propertyId: 'prop-002', leaseStartDate: '2023-01-01T00:00:00Z', leaseEndDate: '2025-05-31T00:00:00Z', monthlyRent: 20000, securityDeposit: 60000 },
    ];
    const result = TenantAIViewBuilder.buildRentalHistoryList(rentals);

    expect(result.metadata).toBeDefined();
    expect(result.data).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data[0].monthlyRent).toBe('₹20k');
  });
});

describe('MeetingAIViewBuilder', () => {
  test('buildMeetingCreateConfirmation returns envelope', () => {
    const meeting = {
      meetingId: 'meet-001',
      title: 'Property viewing',
      scheduledDate: '2026-02-01T10:00:00Z',
      status: 'scheduled',
    };

    const result = MeetingAIViewBuilder.buildMeetingCreateConfirmation(meeting);

    expect(result.metadata.action).toBe('meeting_created');
    expect(result.data.meetingId).toBe('meet-001');
  });
});

// ─── Integration Tests ───────────────────────────────────────────────────────

describe('Integration: Normalizer → View Builder', () => {
  test('Lead flow: DB → Normalizer → ViewBuilder', () => {
    const normalized = normalizeLead(mockLeadFromDb);
    const view = LeadAIViewBuilder.buildLeadDetails(normalized);

    expect(view.metadata).toBeDefined();
    expect(view.data.leadId).toBe('lead-001');
    expect(view.data.PK).toBeUndefined(); // Internal field removed
    expect(view.data.name).toBe('Raj Kumar');
  });

  test('Owner flow: DB → Normalizer → ViewBuilder', () => {
    const normalized = normalizeOwner(mockOwnerFromDb);
    const view = OwnerAIViewBuilder.buildOwnerDetails(normalized);

    expect(view.metadata).toBeDefined();
    expect(view.data.ownerId).toBe('owner-001');
    expect(view.data.propertyCount).toBe(2);
  });

  test('Tenant flow: DB → Normalizer → ViewBuilder', () => {
    const normalized = normalizeTenant(mockTenantFromDb);
    const view = TenantAIViewBuilder.buildTenantDetails(normalized);

    expect(view.metadata).toBeDefined();
    expect(view.data.customerId).toBe('cust-001');
    expect(view.data.kycStatus.complete).toBe(true);
    expect(view.data.currentRental).toBeDefined();
  });
});

// ─── DTO Structure Tests ─────────────────────────────────────────────────────

describe('DTO Structure Compliance', () => {
  test('All view builders return { metadata, data } envelope', () => {
    const normalized = normalizeLead(mockLeadFromDb);

    const views = [
      LeadAIViewBuilder.buildSearchResults([normalized]),
      LeadAIViewBuilder.buildLeadDetails(normalized),
      LeadAIViewBuilder.buildCreateConfirmation(normalized),
    ];

    views.forEach(view => {
      expect(view).toHaveProperty('metadata');
      expect(view).toHaveProperty('data');
    });
  });

  test('Error DTOs have error and message in metadata', () => {
    const errors = [
      LeadAIViewBuilder.buildLeadNotFoundError('lead-999'),
      OwnerAIViewBuilder.buildOwnerNotFoundError('owner-999'),
      TenantAIViewBuilder.buildTenantNotFoundError('cust-999'),
    ];

    errors.forEach(error => {
      expect(error.metadata).toHaveProperty('error');
      expect(error.metadata).toHaveProperty('message');
    });
  });

  test('Pagination metadata is consistent', () => {
    const normalized = normalizeLead(mockLeadFromDb);
    const result = LeadAIViewBuilder.buildSearchResults([normalized], { total: 10, shown: 1, hasMore: true });

    expect(result.metadata.total).toBe(10);
    expect(result.metadata.shown).toBe(1);
    expect(result.metadata.hasMore).toBe(true);
  });
});

export default {
  // Normalizers
  normalizeLead,
  normalizeLeads,
  normalizeOwner,
  normalizeOwners,
  normalizeTenant,
  normalizeTenants,

  // View Builders
  LeadAIViewBuilder,
  OwnerAIViewBuilder,
  TenantAIViewBuilder,
  MeetingAIViewBuilder,
};
