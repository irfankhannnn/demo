/**
 * Real Estate Management Types
 * Types for Developers, Areas, and Projects
 */

// ============== Developer Types ==============

export interface Developer {
  developerId: string;
  tenantId: string;
  
  // Core Identity
  name: string;
  slug: string;
  
  // Company Information
  description: string;
  aboutText: string;
  logoUrl: string | null;
  logoS3Key: string | null;
  
  // Company Details
  headquarters: string;
  country: string; // India, UAE, etc.
  establishedYear: number | null;
  companyType: 'Private' | 'Public' | 'Government';
  website: string | null;
  email: string | null;
  phone: string | null;
  
  // Legal/Registration (India & Dubai)
  reraRegistrationNumber: string | null; // India RERA
  reraState: string | null;
  dedLicenseNumber: string | null; // Dubai DED
  tradeLicenseNumber: string | null;
  
  // Key Features
  keyFeatures: string[];
  specializations: ('residential' | 'commercial' | 'mixed-use')[];
  
  // Statistics
  totalProjects: number;
  completedProjects: number;
  ongoingProjects: number;
  totalUnitsDelivered: number;
  
  // Media
  images: MediaAsset[];
  videos: MediaAsset[];
  
  // SEO & Marketing
  metaTitle: string | null;
  metaDescription: string | null;
  
  // Flags
  featured: boolean;
  verified: boolean;
  displayOrder: number;
  
  // Status
  status: 'active' | 'inactive' | 'archived';
  visibility: 'public' | 'private' | 'draft';
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface CreateDeveloperData {
  name: string;
  slug?: string;
  description?: string;
  aboutText?: string;
  logoUrl?: string;
  logoS3Key?: string;
  headquarters?: string;
  establishedYear?: number;
  companyType?: 'Private' | 'Public' | 'Government';
  website?: string;
  email?: string;
  phone?: string;
  reraRegistrationNumber?: string;
  reraState?: string;
  dedLicenseNumber?: string;
  tradeLicenseNumber?: string;
  keyFeatures?: string[];
  specializations?: ('residential' | 'commercial' | 'mixed-use')[];
  totalUnitsDelivered?: number;
  images?: MediaAsset[];
  videos?: MediaAsset[];
  metaTitle?: string;
  metaDescription?: string;
  featured?: boolean;
  verified?: boolean;
  displayOrder?: number;
  status?: 'active' | 'inactive' | 'archived';
  visibility?: 'public' | 'private' | 'draft';
}

export interface UpdateDeveloperData extends Partial<CreateDeveloperData> {
  updatedBy?: string;
}

// ============== Real Estate Area Types ==============

export interface RealEstateArea {
  areaId: string;
  tenantId: string;
  
  // Core Identity
  name: string;
  slug: string;
  
  // Location
  city: string;
  country: string;
  emirate: string | null; // Dubai specific
  district: string | null;
  state: string | null; // India specific
  pincode: string | null; // India specific
  
  // Area Overview
  description: string;
  overviewText: string;
  tagline: string | null;
  
  // Size & Scale
  totalAreaSqFt: number | null;
  totalAreaAcres: number | null;
  
  // Community Features
  communityFeatures: Record<string, any>;
  
  // Amenities & Infrastructure
  amenities: string[];
  
  // Nearby Landmarks
  nearbyLandmarks: NearbyLandmark[];
  
  // Connectivity & Transport
  accessibility: AreaAccessibility;
  
  // Property Types Available
  propertyTypes: PropertyType[];
  
  // Project Statistics
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  
  // Price Range
  priceRangeMin: number | null;
  priceRangeMax: number | null;
  currency: 'INR' | 'AED' | 'USD';
  
  // Developer Association
  primaryDeveloper: string | null;
  primaryDeveloperId: string | null;
  
  // Media
  images: MediaAsset[];
  videos: MediaAsset[];
  virtualTour360Url: string | null;
  
  // Geolocation
  latitude: number | null;
  longitude: number | null;
  mapEmbedUrl: string | null;
  
  // Investment Highlights
  investmentHighlights: string[];
  
  // Education & Healthcare
  nearbySchools: NearbyFacility[];
  nearbyHospitals: NearbyFacility[];
  
  // SEO & Marketing
  metaTitle: string | null;
  metaDescription: string | null;
  
  // Flags
  featured: boolean;
  verified: boolean;
  popularity: number;
  displayOrder: number;
  
  // Status
  status: 'active' | 'inactive' | 'planned' | 'under-construction' | 'archived';
  visibility: 'public' | 'private' | 'draft';
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface CreateAreaData {
  name: string;
  city: string;
  slug?: string;
  country?: string;
  emirate?: string;
  district?: string;
  state?: string;
  pincode?: string;
  description?: string;
  overviewText?: string;
  tagline?: string;
  totalAreaSqFt?: number;
  totalAreaAcres?: number;
  communityFeatures?: Record<string, any>;
  amenities?: string[];
  nearbyLandmarks?: NearbyLandmark[];
  accessibility?: AreaAccessibility;
  propertyTypes?: PropertyType[];
  priceRangeMin?: number;
  priceRangeMax?: number;
  currency?: 'INR' | 'AED' | 'USD';
  primaryDeveloper?: string;
  primaryDeveloperId?: string;
  images?: MediaAsset[];
  videos?: MediaAsset[];
  virtualTour360Url?: string;
  latitude?: number;
  longitude?: number;
  mapEmbedUrl?: string;
  investmentHighlights?: string[];
  nearbySchools?: NearbyFacility[];
  nearbyHospitals?: NearbyFacility[];
  metaTitle?: string;
  metaDescription?: string;
  featured?: boolean;
  verified?: boolean;
  popularity?: number;
  displayOrder?: number;
  status?: 'active' | 'inactive' | 'planned' | 'under-construction' | 'archived';
  visibility?: 'public' | 'private' | 'draft';
}

export interface UpdateAreaData extends Partial<CreateAreaData> {
  updatedBy?: string;
}

// ============== Project Types ==============

export interface Project {
  projectId: string;
  tenantId: string;
  
  // Core Identity
  name: string;
  slug: string;
  
  // Associations
  developerId: string;
  developerName: string;
  developerSlug: string;
  areaId: string;
  areaName: string;
  areaSlug: string;
  
  // Project Overview
  tagline: string | null;
  description: string;
  fullDescription: string;
  
  // Project Type & Category
  projectType: 'residential' | 'commercial' | 'mixed-use';
  propertyCategory: 'off-plan' | 'ready' | 'secondary';
  
  // Property Types Offered
  propertyTypes: ProjectPropertyType[];
  
  // Pricing
  startingPrice: number | null;
  startingPriceCurrency: string;
  priceRangeMin: number | null;
  priceRangeMax: number | null;
  pricePerSqFt: number | null;
  currency: 'INR' | 'AED' | 'USD';
  
  // Project Scale
  totalUnits: number | null;
  totalFloors: number | null;
  totalBuildings: number;
  totalTowers: number | null;
  
  // Timeline
  launchDate: string | null;
  handoverDate: string | null;
  handoverQuarter: 'Q1' | 'Q2' | 'Q3' | 'Q4' | null;
  handoverYear: number | null;
  constructionStatus: ConstructionStatus;
  completionPercentage: number;
  
  // Payment Plan
  paymentPlan: PaymentPlan;
  
  // Amenities & Features
  amenities: string[];
  keyFeatures: string[];
  
  // Location Details
  address: string | null;
  city: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  
  // Nearby Landmarks
  nearbyLandmarks: NearbyLandmark[];
  
  // Investment Potential
  investmentHighlights: string[];
  expectedROI: number | null;
  rentalYield: number | null;
  
  // Legal & Compliance (India)
  reraNumber: string | null;
  reraState: string | null;
  reraApprovalDate: string | null;
  reraExpiryDate: string | null;
  
  // Legal & Compliance (Dubai/UAE)
  oqoodNumber: string | null;
  escrowAccountNumber: string | null;
  escrowBankName: string | null;
  
  // Documents
  documents: ProjectDocuments;
  
  // Media Assets
  images: MediaAsset[];
  videos: MediaAsset[];
  virtualTour360Url: string | null;
  
  // FAQs
  faqs: FAQ[];
  
  // SEO & Marketing
  metaTitle: string | null;
  metaDescription: string | null;
  keywords: string[];
  
  // Tags & Flags
  tags: string[];
  featured: boolean;
  verified: boolean;
  trending: boolean;
  newLaunch: boolean;
  soldOut: boolean;
  
  // Engagement Metrics
  views: number;
  enquiries: number;
  popularity: number;
  
  // Inventory
  inventory: ProjectInventory;
  
  // Availability
  unitsAvailable: number;
  unitsSold: number;
  availabilityStatus: 'available' | 'limited' | 'sold-out';
  
  // Status
  status: 'active' | 'inactive' | 'archived';
  visibility: 'public' | 'private' | 'draft';
  displayOrder: number;
  
  // Lifecycle
  lifecycle: ProjectLifecycle;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  createdBy: string;
}

export interface CreateProjectData {
  name: string;
  developerId: string;
  areaId: string;
  slug?: string;
  tagline?: string;
  description?: string;
  fullDescription?: string;
  projectType?: 'residential' | 'commercial' | 'mixed-use';
  propertyCategory?: 'off-plan' | 'ready' | 'secondary';
  propertyTypes?: ProjectPropertyType[];
  startingPrice?: number;
  priceRangeMin?: number;
  priceRangeMax?: number;
  pricePerSqFt?: number;
  currency?: 'INR' | 'AED' | 'USD';
  totalUnits?: number;
  totalFloors?: number;
  totalBuildings?: number;
  totalTowers?: number;
  launchDate?: string;
  handoverDate?: string;
  handoverQuarter?: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  handoverYear?: number;
  constructionStatus?: ConstructionStatus;
  completionPercentage?: number;
  paymentPlan?: PaymentPlan;
  amenities?: string[];
  keyFeatures?: string[];
  address?: string;
  latitude?: number;
  longitude?: number;
  nearbyLandmarks?: NearbyLandmark[];
  investmentHighlights?: string[];
  expectedROI?: number;
  rentalYield?: number;
  reraNumber?: string;
  reraState?: string;
  reraApprovalDate?: string;
  reraExpiryDate?: string;
  oqoodNumber?: string;
  escrowAccountNumber?: string;
  escrowBankName?: string;
  documents?: Partial<ProjectDocuments>;
  images?: MediaAsset[];
  videos?: MediaAsset[];
  virtualTour360Url?: string;
  faqs?: FAQ[];
  metaTitle?: string;
  metaDescription?: string;
  keywords?: string[];
  tags?: string[];
  featured?: boolean;
  verified?: boolean;
  trending?: boolean;
  newLaunch?: boolean;
  popularity?: number;
  inventory?: Partial<ProjectInventory>;
  status?: 'active' | 'inactive' | 'archived';
  visibility?: 'public' | 'private' | 'draft';
  displayOrder?: number;
  constructionMilestones?: ConstructionMilestone[];
}

export interface UpdateProjectData extends Partial<CreateProjectData> {
  updatedBy?: string;
}

// ============== Supporting Types ==============

export type PropertyType = 'apartment' | 'villa' | 'townhouse' | 'penthouse' | 'duplex' | 'plot' | 'studio' | 'office' | 'retail' | 'warehouse';

export type ConstructionStatus = 'planned' | 'launched' | 'booking-open' | 'under-construction' | 'nearing-completion' | 'ready-to-move' | 'completed' | 'sold-out';

export interface MediaAsset {
  url: string;
  s3Key?: string;
  title?: string;
  description?: string;
  type?: 'image' | 'video' | 'document';
  order?: number;
}

export interface NearbyLandmark {
  name: string;
  distance: string;
  distanceKm?: number;
  type?: 'transport' | 'retail' | 'education' | 'healthcare' | 'entertainment' | 'landmark';
}

export interface NearbyFacility {
  name: string;
  distance: string;
  distanceKm?: number;
  rating?: number;
}

export interface AreaAccessibility {
  nearestMetro: string | null;
  metroDistanceKm: number | null;
  nearestMall: string | null;
  mallDistanceKm: number | null;
  airportDistanceKm: number | null;
  beachDistanceKm: number | null;
  downtownDistanceKm: number | null;
}

export interface ProjectPropertyType {
  type: PropertyType;
  bedrooms: string; // "2-BR", "3-BR", "Studio"
  bedroomsMin: number;
  bedroomsMax: number;
  areaMin: number;
  areaMax: number;
  areaUnit: 'sq ft' | 'sq m';
  priceMin: number;
  priceMax: number;
  priceOnRequest: boolean;
  availability: 'available' | 'limited' | 'sold-out';
}

export interface PaymentPlan {
  planType: '60/40' | '70/30' | '80/20' | 'construction-linked' | 'post-handover' | 'custom' | null;
  bookingPercentage: number | null;
  duringConstructionPercentage: number | null;
  onHandoverPercentage: number | null;
  postHandoverPercentage: number | null;
  postHandoverYears: number | null;
  installments: PaymentInstallment[];
  specialOffers: Record<string, any>;
  notes: string | null;
}

export interface PaymentInstallment {
  stageNumber: number;
  name: string;
  percentage: number;
  amount: number | null;
  dueDate: string;
  linkedToMilestone: boolean;
  milestoneDescription?: string;
}

export interface ProjectDocuments {
  brochure: DocumentInfo | null;
  floorPlans: DocumentInfo[];
  masterPlan: DocumentInfo | null;
  priceList: DocumentInfo | null;
  paymentPlanDoc: DocumentInfo | null;
  reraDocument: DocumentInfo | null;
  oqoodDocument: DocumentInfo | null;
}

export interface DocumentInfo {
  s3Key: string;
  url: string;
  name?: string;
  uploadedAt?: string;
}

export interface ProjectInventory {
  totalUnits: number;
  availableUnits: number;
  reservedUnits: number;
  soldUnits: number;
  blockedUnits: number;
  breakdown: InventoryBreakdown[];
  lastUpdated: string;
}

export interface InventoryBreakdown {
  type: string;
  total: number;
  available: number;
  reserved: number;
  sold: number;
}

export interface ProjectLifecycle {
  currentStatus: ConstructionStatus;
  statusHistory: StatusHistoryEntry[];
  constructionMilestones: ConstructionMilestone[];
  overallCompletionPercentage: number;
}

export interface StatusHistoryEntry {
  status: ConstructionStatus;
  date: string;
  updatedBy: string;
  notes?: string;
}

export interface ConstructionMilestone {
  milestone: string;
  targetDate: string;
  actualDate: string | null;
  status: 'pending' | 'in-progress' | 'completed' | 'delayed';
  completionPercentage: number;
}

export interface FAQ {
  question: string;
  answer: string;
  order?: number;
}

// ============== Buyer Project Interest Types ==============

export interface ProjectInterest {
  interestId: string;
  projectId: string;
  projectName: string;
  projectSlug: string;
  developerId: string;
  developerName: string;
  areaId: string;
  areaName: string;
  interestedAt: string;
  preferredUnitType: string | null;
  preferredFloor: 'low' | 'mid' | 'high' | null;
  budget: number | null;
  budgetCurrency: 'INR' | 'AED' | 'USD';
  notes: string;
  status: ProjectInterestStatus;
  followUpDate: string | null;
  lastContactedAt: string;
  assignedAgent: string | null;
  source: 'crm' | 'website' | 'walk-in' | 'referral';
}

export type ProjectInterestStatus = 'interested' | 'site-visit-scheduled' | 'site-visit-done' | 'negotiating' | 'booked' | 'dropped';

export interface AddProjectInterestData {
  projectId: string;
  projectName?: string;
  projectSlug?: string;
  developerId?: string;
  developerName?: string;
  areaId?: string;
  areaName?: string;
  preferredUnitType?: string;
  preferredFloor?: 'low' | 'mid' | 'high';
  budget?: number;
  budgetCurrency?: 'INR' | 'AED' | 'USD';
  notes?: string;
  status?: ProjectInterestStatus;
  followUpDate?: string;
  assignedAgent?: string;
  source?: 'crm' | 'website' | 'walk-in' | 'referral';
}

export interface UpdateProjectInterestData {
  preferredUnitType?: string;
  preferredFloor?: 'low' | 'mid' | 'high';
  budget?: number;
  notes?: string;
  status?: ProjectInterestStatus;
  followUpDate?: string;
  assignedAgent?: string;
}

// ============== Property-Project Link Types ==============

export interface PropertyProjectLink {
  projectId: string;
  projectName: string;
  projectSlug: string;
  developerId: string;
  developerName: string;
  unitNumber: string | null;
  tower: string | null;
  floor: number | null;
  marketType: 'primary' | 'secondary';
}

// ============== Metrics Types ==============

export interface DeveloperMetrics {
  totalDevelopers: number;
  activeDevelopers: number;
  verifiedDevelopers: number;
  featuredDevelopers: number;
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  ongoingProjects: number;
  bySpecialization: Record<string, number>;
  byCompanyType: Record<string, number>;
}

export interface AreaMetrics {
  totalAreas: number;
  activeAreas: number;
  featuredAreas: number;
  totalProjects: number;
  activeProjects: number;
  byCity: Record<string, number>;
  byCountry: Record<string, number>;
  byPropertyType: Record<string, number>;
}

export interface ProjectMetrics {
  totalProjects: number;
  activeProjects: number;
  featuredProjects: number;
  trendingProjects: number;
  soldOutProjects: number;
  totalViews: number;
  totalEnquiries: number;
  totalUnits: number;
  availableUnits: number;
  soldUnits: number;
  byConstructionStatus: Record<string, number>;
  byProjectType: Record<string, number>;
  byCity: Record<string, number>;
  byHandoverYear: Record<string, number>;
  priceRange: {
    min: number | null;
    max: number | null;
  };
}

export interface ProjectDetailedMetrics {
  projectId: string;
  name: string;
  views: number;
  enquiries: number;
  popularity: number;
  inventory: ProjectInventory;
  unitsAvailable: number;
  unitsSold: number;
  availabilityStatus: 'available' | 'limited' | 'sold-out';
  completionPercentage: number;
  constructionStatus: ConstructionStatus;
  conversionRate: number;
}

// ============== Filter Types ==============

export interface DeveloperFilters {
  status?: 'active' | 'inactive' | 'archived';
  featured?: boolean;
  verified?: boolean;
  visibility?: 'public' | 'private' | 'draft';
  limit?: number;
  offset?: number;
}

export interface AreaFilters {
  status?: 'active' | 'inactive' | 'planned' | 'under-construction' | 'archived';
  city?: string;
  country?: string;
  emirate?: string;
  featured?: boolean;
  visibility?: 'public' | 'private' | 'draft';
  limit?: number;
  offset?: number;
}

export interface ProjectFilters {
  status?: 'active' | 'inactive' | 'archived';
  developerId?: string;
  areaId?: string;
  projectType?: 'residential' | 'commercial' | 'mixed-use';
  propertyCategory?: 'off-plan' | 'ready' | 'secondary';
  constructionStatus?: ConstructionStatus;
  handoverYear?: number;
  city?: string;
  country?: string;
  featured?: boolean;
  trending?: boolean;
  newLaunch?: boolean;
  soldOut?: boolean;
  visibility?: 'public' | 'private' | 'draft';
  priceMin?: number;
  priceMax?: number;
  sortBy?: 'startingPrice' | 'handoverDate' | 'popularity' | 'views' | 'name' | 'createdAt' | 'displayOrder';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}
