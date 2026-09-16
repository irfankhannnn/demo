export interface CRMCustomer {
  /** Set by the server when phone fields were masked for this role (CONTRACTS.md 7). */
  phoneMasked?: boolean;
  customerId: string;
  name: string;
  email?: string;
  phone: string;
  address?: string;
  
  // Current active rental
  currentRental?: {
    propertyId: string;
    leaseStartDate: string;
    leaseEndDate?: string;
    monthlyRent: number;
    securityDeposit: number;
    brokeragePaid?: number;
    leaseAgreementS3Key?: string;
    leaseAgreementUrl?: string;
    depositReceiptS3Key?: string;
    depositReceiptUrl?: string;
    policeVerificationS3Key?: string;
    policeVerificationUrl?: string;
    notes?: string;
  } | null;
  
  // Past rental records
  rentalHistory?: Array<{
    propertyId: string;
    leaseStartDate: string;
    leaseEndDate?: string;
    monthlyRent: number;
    securityDeposit: number;
    brokeragePaid?: number;
    notes?: string;
  }>;
  
  // KYC Documents
  aadharNumber?: string;
  aadharDocS3Key?: string;
  aadharDocUrl?: string;
  photoS3Key?: string;
  photoUrl?: string;
  policeVerificationS3Key?: string;
  policeVerificationUrl?: string;
  
  status: 'active' | 'inactive' | 'vacated';
  source?: string;
  createdFrom?: string;
  notes?: string;
  tags?: string[];
  priority?: 'low' | 'medium' | 'high';
  preferredArea?: string;
  budget?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CRMCustomerNote {
  noteId: string;
  customerId: string;
  content: string;
  createdBy: string;
  createdAt: string;
}

export interface CRMOwnerNote {
  noteId: string;
  ownerId: string;
  content: string;
  createdBy: string;
  createdAt: string;
}

export interface CRMEnquiryNote {
  noteId: string;
  enquiryId: string;
  content: string;
  createdBy: string;
  createdAt: string;
}

export interface CRMOwner {
  /** Set by the server when phone fields were masked for this role (CONTRACTS.md 7). */
  phoneMasked?: boolean;
  ownerId: string;
  contactId?: string;
  name: string;
  email?: string;
  phone: string;
  address?: string;
  panNumber?: string;
  aadharNumber?: string;
  panDocS3Key?: string;
  aadharDocS3Key?: string;
  photoS3Key?: string;
  // Signed URLs (populated by API)
  photoUrl?: string;
  panDocUrl?: string;
  aadharDocUrl?: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  bankDetails?: string;
  notes?: string;
  status: 'active' | 'inactive';
  propertyCount?: number;
  isConvertedFromBuyer?: boolean;
  convertedFromBuyerId?: string;
  acquisitionHistory?: CRMAcquisitionHistory[];
  createdAt: string;
  updatedAt: string;
}

export interface CRMAcquisitionHistory {
  propertyId: string;
  acquiredFromOwnerId: string | null;
  acquisitionDate: string;
  acquisitionPrice: number;
  originalRole: 'buyer';
}

export interface CRMPropertyOwnershipHistory {
  fromOwnerId: string | null;
  toOwnerId: string | null;
  fromContactId?: string | null;
  toContactId?: string | null;
  fromOwnerName?: string | null;
  toOwnerName?: string | null;
  saleDate: string;
  salePrice?: number | null;
  soldVia: 'direct' | 'third_party';
  buyerId?: string | null;
  buyerContactId?: string | null;
  sellerContactId?: string | null;
  saleTransactionId?: string | null;
  reasonLost?: string | null;
  notes?: string | null;
}

export interface CRMPropertyMedia {
  key: string;
  url: string;
}

export interface CRMSaleTransaction {
  saleTransactionId: string;
  propertyId: string;
  propertyTitle?: string | null;
  sellerContactId?: string | null;
  sellerOwnerId?: string | null;
  buyerContactId?: string | null;
  buyerId?: string | null;
  soldPrice: number;
  soldAt: string;
  soldVia: 'direct' | 'third_party';
  brokerageAmount?: number | null;
  brokerageLost?: number | null;
  reasonLost?: string | null;
  notes?: string | null;
  source?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CRMListing {
  listingId: string;
  propertyId: string;
  listingType: 'sale' | 'rent';
  status: 'draft' | 'active' | 'off_market' | 'expired' | 'withdrawn' | 'sold' | 'rented';
  listedPrice?: number | null;
  expectedRent?: number | null;
  securityDeposit?: number | null;
  listedByContactId?: string | null;
  listedByOwnerId?: string | null;
  title?: string | null;
  notes?: string | null;
  source?: string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string | null;
  saleTransactionId?: string | null;
}

export interface CRMProperty {
  /** Set by the server when phone fields were masked for this role (CONTRACTS.md 7). */
  phoneMasked?: boolean;
  propertyId: string;
  /** @deprecated Prefer currentOwnerContactId — legacy OWNER entity id */
  ownerId: string | null;
  /** Canonical current owner (Contact id) */
  currentOwnerContactId?: string | null;
  /** Alias of currentOwnerContactId (khata / older code) */
  ownerContactId?: string | null;
  previousOwnerContactId?: string | null;
  previousOwnerId?: string | null;
  /**
   * Denormalized owner name/phone written by createProperty for display.
   * Legacy but genuinely persisted, and PropertyDetails falls back to them
   * before ownerSnapshot — they were simply never declared here.
   */
  ownerName?: string | null;
  ownerPhone?: string | null;
  owner?: CRMOwner | null;
  tenantCustomerId?: string;
  tenant?: CRMCustomer;
  title: string;
  description?: string;
  propertyType: 'apartment' | 'house' | 'villa' | 'office';
  bhk: number;
  area: string;
  city: string;
  address?: string;
  flatNumber?: string;
  floor?: string;
  buildingName?: string;
  latitude?: number;
  longitude?: number;
  carpetArea: number;
  rentAmount: number;
  depositAmount: number;
  expectedBrokerage?: number;
  brokerageAmount?: number;
  rentalInfo?: {
    expectedRent?: number;
    currentRent?: number | null;
    currentTenantId?: string | null;
    leaseStartDate?: string | null;
    leaseEndDate?: string | null;
    securityDeposit?: number;
  } | null;
  saleInfo?: {
    listedPrice?: number | null;
    soldPrice?: number | null;
    soldDate?: string | null;
    soldToBuyerId?: string | null;
    soldToBuyerContactId?: string | null;
    soldVia?: 'direct' | 'third_party' | null;
    saleTransactionId?: string | null;
    brokeragePaid?: number | null;
    brokerageLost?: number | null;
    reasonLost?: string | null;
    thirdPartyNotes?: string | null;
  } | null;
  latestSaleTransactionId?: string | null;
  ownershipHistory?: CRMPropertyOwnershipHistory[];
  rentalHistory?: Array<{
    tenantId: string;
    tenantName?: string;
    leaseStartDate?: string;
    leaseEndDate?: string;
    monthlyRent?: number;
    securityDeposit?: number;
    brokeragePaid?: number;
  }>;
  furnishing: 'furnished' | 'semi-furnished' | 'unfurnished';
  amenities: string[];
  availableFrom: string;
  status: 'available' | 'for-sale' | 'for-rent' | 'rented' | 'sold' | 'on-hold' | 'out-of-stock' | 'inactive' | 'not-listed' | 'archived';
  /** Marketing visibility (synced from Listing entity) */
  listingStatus?: 'active' | 'inactive' | string | null;
  /** Active Listing entity id when listed */
  activeListingId?: string | null;
  /**
   * Whether this listing is marked to appear on the agency's public property
   * pages site. Only actually visible there when ALSO `status` is one of
   * available/for-sale/for-rent — see apps/crm/server/publicListingService.js.
   */
  publicVisibility?: 'public' | 'private' | null;
  /** Set the first time publicVisibility was switched to 'public'. */
  publishedAt?: string | null;
  agreementStatus: 'pending' | 'done';
  verificationStatus: 'pending' | 'done' | 'not_done';
  tenantMoveInDate?: string;
  tenureMonths?: number;
  agreementExpiryDate?: string; // Computed from moveInDate + tenureMonths
  images: CRMPropertyMedia[];
  videos: CRMPropertyMedia[];
  featured: boolean;
  verified: boolean;
  views: number;
  // Matches what createProperty writes. There is deliberately no `email`
  // here: the backend never populates one, so typing it in would let callers
  // read a field that is always undefined.
  ownerSnapshot?: { name?: string | null; phone?: string | null; contactId?: string | null } | null;
  convertedFromLeadId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CRMMetrics {
  totalCustomers: number;
  activeCustomers: number;
  totalOwners: number;
  activeOwners: number;
  totalProperties: number;
  availableProperties: number;
  onHoldProperties: number;
  rentedProperties: number;
  soldProperties: number;
  inactiveProperties?: number;
  agreementsDone: number;
  agreementsPending: number;
  verificationsDone: number;
  verificationsPending: number;
  leadsCount: number;
  buyersCount: number;
  sellersCount: number;
  tenantsCount: number;
  contactsCount: number;
}

// Property Agreement
export interface CRMPropertyAgreement {
  agreementId: string;
  propertyId: string;
  startDate?: string;
  endDate?: string;
  monthlyRent: number;
  securityDeposit: number;
  status: 'pending' | 'done';
  documentS3Key?: string;
  documentName?: string;
  documentUrl?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// Property Verification (Police verification etc.)
export interface CRMPropertyVerification {
  verificationId: string;
  propertyId: string;
  verificationType: 'police' | 'background' | 'other';
  status: 'pending' | 'done' | 'not_done';
  verificationDate?: string;
  expiryDate?: string;
  documentS3Key?: string;
  documentName?: string;
  documentUrl?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// Property Document
export interface CRMPropertyDocument {
  documentId: string;
  propertyId: string;
  documentType: 'PHOTO' | 'VIDEO' | 'AGREEMENT' | 'VERIFICATION' | 'OTHER';
  fileName: string;
  fileSize: number;
  mimeType: string;
  s3Key?: string;
  url?: string;
  description?: string;
  createdAt: string;
}

export interface CreateCustomerData {
  name: string;
  email?: string;
  phone: string;
  requirement?: string;
  budget?: number;
  preferredArea?: string;
  status?: 'active' | 'inactive' | 'closed';
  priority?: 'low' | 'medium' | 'high';
  source?: string;
  assignedTo?: string;
}

export interface UpdateCustomerData {
  name?: string;
  email?: string;
  phone?: string;
  requirement?: string;
  budget?: number;
  preferredArea?: string;
  status?: 'active' | 'inactive' | 'closed';
  priority?: 'low' | 'medium' | 'high';
  source?: string;
  assignedTo?: string;
}

export interface CreateOwnerData {
  name: string;
  email?: string;
  phone: string;
  address?: string;
  panNumber?: string;
  aadharNumber?: string;
  bankDetails?: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  notes?: string;
  status?: 'active' | 'inactive';
}

export interface UpdateOwnerData {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  panNumber?: string;
  aadharNumber?: string;
  bankDetails?: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  notes?: string;
  status?: 'active' | 'inactive';
}

export interface CreatePropertyData {
  ownerId?: string | null; // Optional - can be null for unassigned properties
  title: string;
  description?: string;
  propertyType?: 'apartment' | 'house' | 'villa' | 'office';
  bhk?: number;
  area: string;
  city?: string;
  address?: string;
  flatNumber?: string;
  floor?: string;
  buildingName?: string;
  latitude?: number;
  longitude?: number;
  carpetArea?: number;
  rentAmount: number;
  depositAmount?: number;
  rentalInfo?: {
    expectedRent?: number;
    securityDeposit?: number;
  };
  saleInfo?: {
    listedPrice?: number | null;
    soldPrice?: number | null;
    soldDate?: string | null;
    soldToBuyerId?: string | null;
  };
  furnishing?: 'furnished' | 'semi-furnished' | 'unfurnished';
  amenities?: string[];
  availableFrom?: string;
  status?: 'available' | 'for-sale' | 'for-rent' | 'rented' | 'sold' | 'on-hold' | 'out-of-stock';
  tenantCustomerId?: string;
  tenantMoveInDate?: string;
  tenureMonths?: number;
  featured?: boolean;
  verified?: boolean;
  ownerSnapshot?: { name?: string | null; phone?: string | null };
  convertedFromLeadId?: string;
}

export interface UpdatePropertyData {
  ownerId?: string | null; // Can be null for unassigned properties
  title?: string;
  description?: string;
  propertyType?: 'apartment' | 'house' | 'villa' | 'office';
  bhk?: number;
  area?: string;
  city?: string;
  address?: string;
  flatNumber?: string;
  floor?: string;
  buildingName?: string;
  latitude?: number;
  longitude?: number;
  carpetArea?: number;
  rentAmount?: number;
  depositAmount?: number;
  rentalInfo?: {
    expectedRent?: number;
    securityDeposit?: number;
  };
  saleInfo?: {
    listedPrice?: number | null;
    soldPrice?: number | null;
    soldDate?: string | null;
    soldToBuyerId?: string | null;
  };
  furnishing?: 'furnished' | 'semi-furnished' | 'unfurnished';
  amenities?: string[];
  availableFrom?: string;
  status?: 'available' | 'for-sale' | 'for-rent' | 'rented' | 'sold' | 'on-hold' | 'out-of-stock';
  tenantCustomerId?: string;
  tenantMoveInDate?: string;
  tenureMonths?: number;
  agreementStatus?: 'pending' | 'done';
  verificationStatus?: 'pending' | 'done' | 'not_done';
  featured?: boolean;
  verified?: boolean;
  ownerSnapshot?: { name?: string | null; phone?: string | null };
  publicVisibility?: 'public' | 'private';
}

// Agreement Data Types
export interface CreateAgreementData {
  startDate?: string;
  endDate?: string;
  monthlyRent?: number;
  securityDeposit?: number;
  status?: 'pending' | 'done';
  notes?: string;
}

export interface UpdateAgreementData {
  startDate?: string;
  endDate?: string;
  monthlyRent?: number;
  securityDeposit?: number;
  status?: 'pending' | 'done';
  notes?: string;
}

// Verification Data Types
export interface CreateVerificationData {
  verificationType?: 'police' | 'background' | 'other';
  status?: 'pending' | 'done' | 'not_done';
  verificationDate?: string;
  expiryDate?: string;
  notes?: string;
}

export interface UpdateVerificationData {
  verificationType?: 'police' | 'background' | 'other';
  status?: 'pending' | 'done' | 'not_done';
  verificationDate?: string;
  expiryDate?: string;
  notes?: string;
}

// ============== Meeting/Calendar Types ==============

export type MeetingStatus = 'scheduled' | 'completed' | 'cancelled' | 'rescheduled';
export type RelatedEntityType = 'customer' | 'owner' | 'enquiry' | 'b2b_lead' | 'property' | 'lead';

export interface CRMMeeting {
  /** Set by the server when phone fields were masked for this role (CONTRACTS.md 7). */
  phoneMasked?: boolean;
  meetingId: string;
  title: string;
  description?: string;
  meetingDate: string; // ISO date string
  meetingTime: string; // HH:mm format
  duration?: number; // in minutes
  location?: string;
  status: MeetingStatus;
  // Related entity (lead/customer/owner/enquiry)
  relatedEntityType: RelatedEntityType;
  relatedEntityId: string;
  relatedEntityName?: string;
  relatedEntityPhone?: string;
  // Attendee info
  attendeeName?: string;
  attendeePhone?: string;
  attendeeEmail?: string;
  // Meeting outcome
  outcome?: string;
  notes?: string;
  // Timestamps
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMeetingData {
  title: string;
  description?: string;
  meetingDate: string;
  meetingTime: string;
  duration?: number;
  location?: string;
  relatedEntityType: RelatedEntityType;
  relatedEntityId: string;
  relatedEntityName?: string;
  relatedEntityPhone?: string;
  attendeeName?: string;
  attendeePhone?: string;
  attendeeEmail?: string;
  notes?: string;
}

export interface UpdateMeetingData {
  title?: string;
  description?: string;
  meetingDate?: string;
  meetingTime?: string;
  duration?: number;
  location?: string;
  status?: MeetingStatus;
  outcome?: string;
  notes?: string;
}

// ============== Unified Contact Types ==============

export interface ContactRoles {
  owner: boolean;
  buyer: boolean;
  tenant: boolean;
  seller?: boolean;
}

export type SellerLifecycleStatus = 'active' | 'past' | 'inactive';
export type OwnerLifecycleStatus = 'active' | 'passive' | 'inactive';

export interface BuyerProfile {
  requirement?: string;
  budget?: number;
  preferredArea?: string;
  bhk?: number;
  propertyType?: string;
  timeline?: string;
  financingStatus?: string;
  migratedFrom?: string;
  originalCustomerId?: string;
}

export interface SellerProfile {
  lifecycleStatus?: SellerLifecycleStatus;
  listingPreferences?: Record<string, unknown> | null;
  notes?: string | null;
  soldPropertyIds?: string[];
  activeListingIds?: string[];
}

export interface TenantProfile {
  requirement?: string;
  budget?: number;
  preferredArea?: string;
  moveInDate?: string;
  assignedTo?: string;
  priority?: string;
  migratedFrom?: string;
  originalCustomerId?: string;
}

export interface OwnerProfile {
  lifecycleStatus?: OwnerLifecycleStatus;
  ownedPropertyIds?: string[];
  notes?: string | null;
  propertyDetails?: Record<string, unknown>;
  migratedFrom?: string;
  originalOwnerId?: string;
}

export interface CRMContact {
  /** Set by the server when phone fields were masked for this role (CONTRACTS.md 7). */
  phoneMasked?: boolean;
  contactId: string;
  name: string;
  email?: string;
  phone: string;
  normalizedPhone?: string;
  address?: string;
  // Roles
  roles: ContactRoles;
  // Role-specific business profiles
  ownerProfile?: OwnerProfile | null;
  sellerProfile?: SellerProfile | null;
  buyerProfile?: BuyerProfile | null;
  tenantProfile?: TenantProfile | null;
  // Documents
  panNumber?: string;
  aadharNumber?: string;
  panDocS3Key?: string;
  aadharDocS3Key?: string;
  photoS3Key?: string;
  // Signed URLs (populated by API)
  photoUrl?: string;
  panDocUrl?: string;
  aadharDocUrl?: string;
  // Bank details
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  // Meta
  source?: string;
  tags?: string[];
  notes?: string;
  status: 'active' | 'inactive';
  // Migration references
  linkedOwnerId?: string;
  linkedCustomerId?: string;
  // Purchase history (for buyers)
  purchaseHistory?: Array<{
    propertyId: string;
    propertyName?: string;
    area?: string;
    saleAmount: number;
    purchaseDate: string;
    registrationDate?: string | null;
    registrationNumber?: string | null;
    stampDutyPaid?: number;
    registrationCharges?: number;
    brokeragePaid?: number;
    saleTransactionId?: string;
    notes?: string;
  }>;
  // Timestamps
  createdAt: string;
  updatedAt: string;
  // Helper flags
  wasExisting?: boolean;
  isLegacyOwner?: boolean;
  isLegacyCustomer?: boolean;
  // Activity summary (denormalized from timeline). Declared once — this block
  // was duplicated verbatim above the helper flags, which TypeScript reports
  // as TS2300 on all three fields.
  lastActivityAt?: string;
  lastActivityTitle?: string;
  lastActivityType?: string;
}

export interface CRMContactNote {
  noteId: string;
  contactId: string;
  content: string;
  createdBy: string;
  createdAt: string;
}

export interface CreateContactData {
  name: string;
  email?: string;
  phone: string;
  address?: string;
  roles?: Partial<ContactRoles>;
  ownerProfile?: OwnerProfile;
  sellerProfile?: SellerProfile;
  buyerProfile?: BuyerProfile;
  tenantProfile?: TenantProfile;
  panNumber?: string;
  aadharNumber?: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  source?: string;
  tags?: string[];
  notes?: string;
}

export interface UpdateContactData {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  roles?: Partial<ContactRoles>;
  ownerProfile?: OwnerProfile;
  sellerProfile?: SellerProfile;
  buyerProfile?: BuyerProfile;
  tenantProfile?: TenantProfile;
  panNumber?: string;
  aadharNumber?: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  source?: string;
  tags?: string[];
  notes?: string;
}

// ============== Lead Types ==============

export type LeadType = 'buyer' | 'seller' | 'tenant' | 'owner';
// `site_visit` is an active pipeline stage between qualified and negotiating.
// `spam` is terminal and, unlike `lost`, marks a lead that was never real —
// it is excluded from follow-up crons and AI qualification server-side.
export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'site_visit' | 'negotiating' | 'converted' | 'lost' | 'spam';

// Intake adapters that can create a lead. Every one funnels through the same
// server-side ingestLead() entry point, so a lead's downstream treatment
// (AI qualification, scoring, closure) does not depend on which one it was.
export type LeadSourceAdapter = 'manychat' | 'instagram' | 'insta-agent' | 'bailey' | 'website';
// LeadPriority (low/medium/high) is retired on the Lead entity — see
// LeadTemperature. Buyer/Customer/Tenant/B2B-Lead entities keep their own
// separate `priority` field, untouched by this migration.
export type LeadTemperature = 'HOT' | 'WARM' | 'COLD';
export type LeadScoreSource = 'ai_call' | 'llm_text' | 'manual' | 'migrated';

export interface LeadReelRef {
  postId?: string | null;
  permalink?: string | null;
}

export interface BuyerRequirement {
  requirement?: string;
  budget?: number;
  preferredArea?: string;
  city?: string;
  bhk?: string;
  propertyType?: string;
  propertySubType?: string;
  timeline?: string;
}

export interface SellerProperty {
  propertyType?: string;
  propertySubType?: string;
  area?: string;
  expectedPrice?: number;
  timeline?: string;
  timelineValue?: number;
  timelineUnit?: 'days' | 'months';
  notes?: string;
  bhk?: string;
  buildingName?: string;
  flatNumber?: string;
  floor?: string;
  furnishing?: string;
  carpetArea?: number;
  city?: string;
  address?: string;
}

export interface TenantRequirement {
  requirement?: string;
  budget?: number;
  preferredArea?: string;
  city?: string;
  moveInDate?: string;
}

export interface OwnerProperty {
  propertyType?: string;
  area?: string;
  rentExpected?: number;
  notes?: string;
  bhk?: string;
  buildingName?: string;
  flatNumber?: string;
  floor?: string;
  furnishing?: string;
  carpetArea?: number;
  city?: string;
  address?: string;
  securityDeposit?: number;
}

export interface LeadHistoryEntry {
  timestamp: string;
  action: string;
  details: string;
  updatedBy: string;
  updatedByUserId?: string;
}

export interface LeadConversion {
  entityType: string;
  entityId?: string;
  contactId?: string;
  role: string;
}

export interface CRMLead {
  /** Set by the server when phone fields were masked for this role (CONTRACTS.md 7). */
  phoneMasked?: boolean;
  leadId: string;
  leadType: LeadType;
  name: string;
  email?: string;
  phone?: string;
  normalizedPhone?: string;
  source?: string;
  status: LeadStatus;
  // Hot/Warm/Cold, set by an AI qualification call, the LLM fallback, or a
  // human override — null until the lead is actually qualified.
  score?: LeadTemperature | null;
  scoreValue?: number | null;
  scoreReasons?: string | null;
  scoredAt?: string | null;
  scoreSource?: LeadScoreSource | null;
  assignedTo?: string;
  // Instagram-sourced leads carry a reference to the triggering post.
  reelRef?: LeadReelRef | null;
  // Which intake adapter produced this lead. `source` is the coarse channel
  // shown to users ('Instagram'); this distinguishes the paths within it —
  // 'manychat' (ManyChat cloud bot) vs 'instagram' (backend_insta_sol_ms; 'insta-agent' was the retired laptop agent).
  // null for a lead a human typed in.
  sourceAdapter?: LeadSourceAdapter | null;
  // Channel-native identifiers, e.g. { igUsername, igSenderId, sourceMediaId }.
  externalRef?: Record<string, string | null> | null;
  // Stable per-source id used to make repeated deliveries idempotent.
  dedupeKey?: string | null;
  // Type-specific data
  buyerRequirement?: BuyerRequirement | null;
  sellerProperty?: SellerProperty | null;
  tenantRequirement?: TenantRequirement | null;
  ownerProperty?: OwnerProperty | null;
  // Conversion tracking
  convertedAt?: string | null;
  convertedTo?: LeadConversion | null;
  convertingLockAt?: string | null;
  archivedFromSnapshot?: boolean;
  snapshotNotes?: CRMLeadNote[];
  snapshotMeetings?: CRMMeeting[];
  conversionSnapshotId?: string;
  // Lost tracking
  lostReason?: string | null;
  lostAt?: string | null;
  // Notes and history
  notes?: string;
  history?: LeadHistoryEntry[];
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CRMLeadNote {
  noteId: string;
  leadId: string;
  content: string;
  createdBy: string;
  createdAt: string;
}

export interface CreateLeadData {
  leadType: LeadType;
  name: string;
  email?: string;
  phone?: string;
  source?: string;
  status?: LeadStatus;
  assignedTo?: string;
  reelRef?: LeadReelRef;
  buyerRequirement?: BuyerRequirement;
  sellerProperty?: SellerProperty;
  tenantRequirement?: TenantRequirement;
  ownerProperty?: OwnerProperty;
  notes?: string;
}

export interface UpdateLeadData {
  name?: string;
  email?: string;
  phone?: string;
  source?: string;
  status?: LeadStatus;
  // Setting this is always treated as a human override server-side
  // (scoreSource/scoredAt are stamped by the API, not sent by the client).
  score?: LeadTemperature;
  scoreReasons?: string;
  assignedTo?: string;
  buyerRequirement?: BuyerRequirement;
  sellerProperty?: SellerProperty;
  tenantRequirement?: TenantRequirement;
  ownerProperty?: OwnerProperty;
  notes?: string;
}

export interface LeadMetrics {
  total: number;
  byType: {
    buyer: number;
    tenant: number;
    owner: number;
  };
  byStatus: {
    new: number;
    contacted: number;
    qualified: number;
    // Optional: older API responses predate these statuses and omit them.
    site_visit?: number;
    spam?: number;
    negotiating: number;
    converted: number;
    lost: number;
  };
  byTemperature: {
    hot: number;
    warm: number;
    cold: number;
    unscored: number;
  };
  conversionRate: number;
}

export interface ConvertLeadResult {
  entity: Record<string, unknown>;
  entityType: 'buyer' | 'seller' | 'tenant' | 'owner';
  conversionSnapshotId: string;
  convertedAt?: string;
  leadId?: string;
  role?: string;
  lead?: CRMLead | null;
}

export interface ConvertLeadOptions {
  existingContactId?: string;
  purchaseDetails?: Record<string, unknown>;
  leaseDetails?: Record<string, unknown>;
  kycDetails?: { panNumber?: string; aadharNumber?: string };
  createPropertyListing?: boolean;
}

export interface LeadConversionSnapshot {
  conversionSnapshotId: string;
  leadId: string;
  leadType: LeadType;
  role: string;
  entityType: string;
  entityId: string;
  convertedAt: string;
  convertedBy?: string;
  sourceLeadSnapshot?: {
    lead: CRMLead;
    notes?: CRMLeadNote[];
    meetings?: unknown[];
  };
}

// ============== Role-Specific Metrics ==============

export interface RoleMetrics {
  total: number;
  active: number;
  byStatus?: Record<string, number>;
  byPriority?: Record<string, number>;
}

// ============== Real Estate Management - Developers ==============

export interface CRMDeveloper {
  /** Set by the server when phone fields were masked for this role (CONTRACTS.md 7). */
  phoneMasked?: boolean;
  developerId: string;
  name: string;
  slug?: string;
  description?: string;
  logo?: string;
  logoS3Key?: string;
  logoUrl?: string;
  website?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  establishedYear?: number;
  totalProjects?: number;
  completedProjects?: number;
  ongoingProjects?: number;
  upcomingProjects?: number;
  rating?: number;
  reviewCount?: number;
  certifications?: string[];
  awards?: string[];
  socialLinks?: {
    facebook?: string;
    twitter?: string;
    linkedin?: string;
    instagram?: string;
  };
  status: 'active' | 'inactive';
  featured?: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CRMDeveloperNote {
  noteId: string;
  developerId: string;
  content: string;
  createdBy: string;
  createdAt: string;
}

// ============== Real Estate Management - Areas/Communities ==============

export interface CRMRealEstateArea {
  areaId: string;
  name: string;
  slug?: string;
  description?: string;
  image?: string;
  imageS3Key?: string;
  imageUrl?: string;
  city: string;
  state?: string;
  country?: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
  areaType?: 'residential' | 'commercial' | 'mixed' | 'industrial';
  connectivity?: {
    nearestMetro?: string;
    nearestAirport?: string;
    nearestRailway?: string;
    majorRoads?: string[];
  };
  amenities?: {
    schools?: string[];
    hospitals?: string[];
    malls?: string[];
    parks?: string[];
    restaurants?: string[];
  };
  priceRange?: {
    min: number;
    max: number;
    averagePerSqft?: number;
  };
  totalProjects?: number;
  totalProperties?: number;
  popularityScore?: number;
  rating?: number;
  reviewCount?: number;
  status: 'active' | 'inactive';
  featured?: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CRMRealEstateAreaNote {
  noteId: string;
  areaId: string;
  content: string;
  createdBy: string;
  createdAt: string;
}

// ============== Real Estate Management - Projects ==============

export type ProjectLifecycleStatus = 
  | 'planning' 
  | 'approved' 
  | 'under-construction' 
  | 'ready-to-move' 
  | 'completed' 
  | 'on-hold' 
  | 'cancelled';

export interface CRMProject {
  projectId: string;
  name: string;
  slug?: string;
  developerId: string;
  developerName?: string;
  areaId?: string;
  areaName?: string;
  description?: string;
  shortDescription?: string;
  coverImage?: string;
  coverImageS3Key?: string;
  coverImageUrl?: string;
  images?: string[];
  imageS3Keys?: string[];
  imageUrls?: string[];
  brochureS3Key?: string;
  brochureUrl?: string;
  address: string;
  city: string;
  state?: string;
  country?: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
  
  // Project Details
  projectType?: 'residential' | 'commercial' | 'mixed';
  totalArea?: number;
  totalUnits?: number;
  availableUnits?: number;
  soldUnits?: number;
  
  // Configuration
  configurations?: Array<{
    type: string;
    size: number;
    priceRange: { min: number; max: number };
    available: number;
  }>;
  
  // Lifecycle
  lifecycleStatus: ProjectLifecycleStatus;
  launchDate?: string;
  possessionDate?: string;
  completionDate?: string;
  
  // Pricing
  priceRange?: {
    min: number;
    max: number;
    averagePerSqft?: number;
  };
  
  // Amenities & Features
  amenities?: string[];
  specifications?: Record<string, unknown>;
  
  // Approvals
  reraNumber?: string;
  reraApprovalDate?: string;
  otherApprovals?: string[];
  
  // Metrics
  views?: number;
  enquiries?: number;
  siteVisits?: number;
  rating?: number;
  reviewCount?: number;
  
  // SEO & Marketing
  featured?: boolean;
  trending?: boolean;
  tags?: string[];
  
  status: 'active' | 'inactive' | 'draft';
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CRMProjectNote {
  noteId: string;
  projectId: string;
  content: string;
  createdBy: string;
  createdAt: string;
}
