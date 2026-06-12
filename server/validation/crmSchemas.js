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
});

export const updateCustomerSchema = createCustomerSchema.partial();

// ============== Owner Schemas ==============
export const createOwnerSchema = z.object({
  name: z.string().min(1).max(200),
  phone: z.string().min(1).max(50),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
});

export const updateOwnerSchema = createOwnerSchema.partial();

// ============== Property Schemas ==============
export const createPropertySchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(2000).optional(),
  address: z.string().max(500).optional(),
  price: z.number().min(0).optional(),
  rent: z.number().min(0).optional(),
  type: z.enum(['residential', 'commercial', 'land', 'other']).optional(),
  status: z.enum(['available', 'for-sale', 'for-rent', 'sold', 'rented', 'unavailable']).optional(),
  area: z.number().min(0).optional(),
  bedrooms: z.number().min(0).optional(),
  bathrooms: z.number().min(0).optional(),
  ownerId: z.string().optional(),
});

export const updatePropertySchema = createPropertySchema.partial();

// ============== Meeting Schemas ==============
export const createMeetingSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(2000).optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime().optional(),
  attendees: z.array(z.string()).optional(),
  location: z.string().max(300).optional(),
  customerId: z.string().optional(),
  propertyId: z.string().optional(),
});

export const updateMeetingSchema = createMeetingSchema.partial();
