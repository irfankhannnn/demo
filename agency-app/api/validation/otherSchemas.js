import { z } from 'zod';

// ============== Khata Schemas ==============
export const createKhataEntrySchema = z.object({
  propertyId: z.string().min(1),
  partyType: z.enum(['owner', 'tenant', 'buyer', 'seller', 'vendor', 'agent', 'other']),
  partyId: z.string().min(1),
  partyName: z.string().min(1).max(200),
  transactionType: z.enum(['credit', 'debit', 'advance', 'deposit', 'refund', 'rent', 'brokerage', 'maintenance', 'other']),
  amount: z.number().min(0),
  description: z.string().max(1000).optional(),
  transactionDate: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional(),
  reminderAt: z.string().datetime().optional(),
  reminderNote: z.string().max(500).optional(),
  sourceRef: z.string().max(200).optional(),
}).strict();

export const updateKhataEntrySchema = createKhataEntrySchema.partial().strict();

export const settleKhataEntrySchema = z.object({
  settlementNotes: z.string().max(1000).optional(),
}).strict();

// ============== Notification Schemas ==============
export const updateNotificationSettingsSchema = z.object({
  rentedExpiryThresholdDays: z.number().min(1).max(365).optional(),
  enableRentExpiryNotifications: z.boolean().optional(),
  enableMeetingReminders: z.boolean().optional(),
  enableKhataReminders: z.boolean().optional(),
}).strict();

export const createTestNotificationSchema = z.object({
  category: z.string().min(1).max(100),
  type: z.string().min(1).max(100),
  title: z.string().min(1).max(300),
  message: z.string().min(1).max(2000),
  deepLink: z.string().max(500).optional(),
}).strict();

// Push device registration. FCM tokens are ~160 chars today but Google has
// never committed to a length, so the bound is generous rather than exact.
export const registerPushDeviceSchema = z.object({
  token: z.string().min(20).max(4096),
  platform: z.enum(['ios', 'android']),
  deviceId: z.string().max(200).optional(),
}).strict();

// ============== Enquiry Schemas ==============
export const createEnquirySchema = z.object({
  formType: z.enum(['contact', 'consultation', 'callback', 'other']).optional(),
  name: z.string().min(1).max(200),
  phone: z.string().min(1).max(50),
  email: z.string().email().optional().or(z.literal('')),
  propertyType: z.string().max(100).optional(),
  budget: z.string().max(100).optional(),
  location: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
  status: z.enum(['new', 'contacted', 'qualified', 'converted', 'closed', 'lost']).optional(),
  assignedTo: z.string().optional(),
}).strict();

export const updateEnquirySchema = z.object({
  status: z.enum(['new', 'contacted', 'qualified', 'converted', 'closed', 'lost']).optional(),
  notes: z.string().max(2000).optional(),
  assignedTo: z.string().optional(),
}).strict();

export const convertEnquirySchema = z.object({
  convertTo: z.enum(['owner', 'tenant']),
}).strict();

export const closeEnquirySchema = z.object({
  reason: z.string().min(1).max(1000),
}).strict();

export const createEnquiryNoteSchema = z.object({
  text: z.string().min(1).max(2000),
}).strict();

export const updateEnquiryNoteSchema = z.object({
  text: z.string().min(1).max(2000),
}).strict();
