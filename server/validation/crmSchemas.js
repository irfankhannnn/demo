import { z } from 'zod';

// ============== Customer Schemas ==============
export const createCustomerSchema = z.object({
  name: z.string().min(1).max(200),
  phone: z.string().min(1).max(50),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().max(500).optional(),
  source: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
  type: z.enum(['buyer', 'tenant', 'investor', 'other']).optional(),
}).strict();

export const updateCustomerSchema = createCustomerSchema.partial().strict();

// ============== Owner Schemas ==============
export const createOwnerSchema = z.object({
  name: z.string().min(1).max(200),
  phone: z.string().min(1).max(50),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
}).strict();

export const updateOwnerSchema = createOwnerSchema.partial().strict();

// ============== Property Schemas ==============
// Aligned with frontend CreatePropertyData and backend createProperty service.
// Uses .passthrough() so the service receives all fields it expects without
// needing to mirror every possible field in the schema.
export const createPropertySchema = z.object({
  ownerId: z.string().optional().nullable(),
  title: z.string().min(1).max(300),
  description: z.string().max(2000).optional(),
  propertyType: z.enum(['apartment', 'house', 'villa', 'office']).optional(),
  bhk: z.number().min(0).optional(),
  area: z.string().optional(),
  city: z.string().optional(),
  address: z.string().max(500).optional(),
  flatNumber: z.string().optional(),
  floor: z.string().optional(),
  buildingName: z.string().optional(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  carpetArea: z.number().min(0).optional(),
  rentAmount: z.number().min(0).optional(),
  depositAmount: z.number().min(0).optional(),
  rentalInfo: z.object({
    expectedRent: z.number().min(0).optional(),
    securityDeposit: z.number().min(0).optional(),
    currentRent: z.number().optional().nullable(),
    currentTenantId: z.string().optional().nullable(),
    leaseStartDate: z.string().optional().nullable(),
    leaseEndDate: z.string().optional().nullable(),
  }).optional(),
  furnishing: z.enum(['furnished', 'semi-furnished', 'unfurnished']).optional(),
  amenities: z.array(z.string()).optional(),
  availableFrom: z.string().optional(),
  status: z.enum(['available', 'for-sale', 'for-rent', 'rented', 'sold', 'on-hold', 'out-of-stock']).optional(),
  tenantCustomerId: z.string().optional().nullable(),
  tenantMoveInDate: z.string().optional().nullable(),
  tenureMonths: z.number().optional(),
  featured: z.boolean().optional(),
  verified: z.boolean().optional(),
  ownerSnapshot: z.object({
    name: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
  }).optional().nullable(),
  convertedFromLeadId: z.string().optional().nullable(),
  expectedBrokerage: z.number().min(0).optional().nullable(),
  brokerageAmount: z.number().min(0).optional(),
  agreementStatus: z.string().optional(),
  verificationStatus: z.string().optional(),
  saleInfo: z.object({
    listedPrice: z.number().optional().nullable(),
    soldPrice: z.number().optional().nullable(),
    soldDate: z.string().optional().nullable(),
    soldToBuyerId: z.string().optional().nullable(),
  }).optional(),
  ownershipHistory: z.array(z.any()).optional(),
  rentalHistory: z.array(z.any()).optional(),
  images: z.array(z.any()).optional(),
  videos: z.array(z.any()).optional(),
  views: z.number().optional(),
}).passthrough();

export const updatePropertySchema = createPropertySchema.partial().passthrough();

// ============== Meeting Schemas ==============
export const createMeetingSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(2000).optional().nullable(),
  meetingDate: z.string().min(1).max(50),
  meetingTime: z.string().min(1).max(50),
  duration: z.number().optional(),
  location: z.string().max(300).optional().nullable(),
  relatedEntityType: z.string().min(1).max(50),
  relatedEntityId: z.string().min(1).max(100),
  relatedEntityName: z.string().max(200).optional().nullable(),
  relatedEntityPhone: z.string().max(50).optional().nullable(),
  attendeeName: z.string().max(200).optional().nullable(),
  attendeePhone: z.string().max(50).optional().nullable(),
  attendeeEmail: z.string().email().optional().nullable().or(z.literal('')),
  notes: z.string().max(2000).optional().nullable(),
  status: z.enum(['scheduled', 'completed', 'cancelled', 'no-show']).optional(),
}).strict();

export const updateMeetingSchema = createMeetingSchema.partial().strict();
