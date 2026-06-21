export interface CRMCustomer {
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
  ownerId: string;
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
  fromOwnerName?: string | null;
  toOwnerName?: string | null;
  saleDate: string;
  salePrice?: number | null;
  soldVia: 'direct' | 'third_party';
  buyerId?: string | null;
  reasonLost?: string | null;
  notes?: string | null;
}

export interface CRMPropertyMedia {
  key: string;
  url: string;
}

export interface CRMProperty {
  propertyId: string;
  ownerId: string | null; // Can be null for unassigned properties
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
    soldVia?: 'direct' | 'third_party' | null;
    brokeragePaid?: number | null;
    brokerageLost?: number | null;
    reasonLost?: string | null;
    thirdPartyNotes?: string | null;
  } | null;
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
  status: 'available' | 'for-sale' | 'for-rent' | 'rented' | 'sold' | 'on-hold' | 'out-of-stock';
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
  ownerSnapshot?: { name?: string | null; phone?: string | null } | null;
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
  agreementsDone: number;
  agreementsPending: number;
  verificationsDone: number;
  verificationsPending: number;
  leadsCount: number;
  buyersCount: number;
  sellersCount: number;
  tenantsCount: number;
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

export interface BuyerProfile {
  requirement?: string;
  budget?: number;
  preferredArea?: string;
  bhk?: number;
  propertyType?: string;
  timeline?: string;
  migratedFrom?: string;
  originalCustomerId?: string;
}

// SellerProfile removed - sellers are now owners with properties listed for sale

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
  propertyDetails?: Record<string, unknown>;
  migratedFrom?: string;
  originalOwnerId?: string;
}

export interface CRMContact {
  contactId: string;
  name: string;
  email?: string;
  phone: string;
  normalizedPhone?: string;
  address?: string;
  // Roles
  roles: ContactRoles;
  // Role-specific profiles
  ownerProfile?: OwnerProfile | null;
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
    notes?: string;
  }>;
  // Timestamps
  createdAt: string;
  updatedAt: string;
  // Helper flags
  wasExisting?: boolean;
  isLegacyOwner?: boolean;
  isLegacyCustomer?: boolean;
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
  status?: 'active' | 'inactive';
}

export interface UpdateContactData {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  roles?: Partial<ContactRoles>;
  ownerProfile?: OwnerProfile;
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
  status?: 'active' | 'inactive';
}

// ============== Lead Types ==============

export type LeadType = 'buyer' | 'seller' | 'tenant' | 'owner';
export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'negotiating' | 'converted' | 'lost';
export type LeadPriority = 'low' | 'medium' | 'high';

export interface BuyerRequirement {
  requirement?: string;
  budget?: number;
  preferredArea?: string;
  bhk?: number;
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
  bhk?: number;
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
  moveInDate?: string;
}

export interface OwnerProperty {
  propertyType?: string;
  area?: string;
  rentExpected?: number;
  notes?: string;
  bhk?: number;
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
}

export interface LeadConversion {
  entityType: 'contact';
  contactId: string;
  role: string;
}

export interface CRMLead {
  leadId: string;
  leadType: LeadType;
  name: string;
  email?: string;
  phone?: string;
  normalizedPhone?: string;
  source?: string;
  status: LeadStatus;
  priority: LeadPriority;
  assignedTo?: string;
  // Type-specific data
  buyerRequirement?: BuyerRequirement | null;
  sellerProperty?: SellerProperty | null;
  tenantRequirement?: TenantRequirement | null;
  ownerProperty?: OwnerProperty | null;
  // Conversion tracking
  convertedAt?: string | null;
  convertedTo?: LeadConversion | null;
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
  priority?: LeadPriority;
  assignedTo?: string;
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
  priority?: LeadPriority;
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
    negotiating: number;
    converted: number;
    lost: number;
  };
  byPriority: {
    low: number;
    medium: number;
    high: number;
  };
  conversionRate: number;
}

export interface ConvertLeadResult {
  lead: CRMLead;
  contact: CRMContact;
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
