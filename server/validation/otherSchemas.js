import { z } from 'zod';

// ============== Khata Schemas ==============
export const createKhataEntrySchema = z.object({
  propertyId: z.string().min(1),
  partyType: z.enum(['owner', 'tenant', 'buyer', 'seller', 'vendor', 'agent', 'other']),
  partyId: z.string().min(1),
  partyName: z.string().min(1).max(200),
  transactionType: z.enum(['credit', 'debit', 'advance', 'deposit', 'refund', 'rent', 'brokerage', 'maintenance', 'other']),
  amount: z.number().min(0).optional(),
  description: z.string().max(1000).optional(),
  transactionDate: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional(),
  reminderAt: z.string().datetime().optional(),
  reminderNote: z.string().max(500).optional(),
  sourceRef: z.string().max(200).optional(),
});

export const updateKhataEntrySchema = createKhataEntrySchema.partial();

export const settleKhataEntrySchema = z.object({
  settlementNotes: z.string().max(1000).optional(),
});

// ============== Notification Schemas ==============
export const updateNotificationSettingsSchema = z.object({
  rentedExpiryThresholdDays: z.number().min(1).max(365).optional(),
  enableRentExpiryNotifications: z.boolean().optional(),
  enableMeetingReminders: z.boolean().optional(),
  enableKhataReminders: z.boolean().optional(),
});

export const createTestNotificationSchema = z.object({
  category: z.string().min(1).max(100),
  type: z.string().min(1).max(100),
  title: z.string().min(1).max(300),
  message: z.string().min(1).max(2000),
  deepLink: z.string().max(500).optional(),
});

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
});

export const updateEnquirySchema = z.object({
  status: z.enum(['new', 'contacted', 'qualified', 'converted', 'closed', 'lost']).optional(),
  notes: z.string().max(2000).optional(),
  assignedTo: z.string().optional(),
});

export const convertEnquirySchema = z.object({
  convertTo: z.enum(['owner', 'tenant']),
});

export const closeEnquirySchema = z.object({
  reason: z.string().min(1).max(1000),
});

export const createEnquiryNoteSchema = z.object({
  text: z.string().min(1).max(2000),
});

export const updateEnquiryNoteSchema = z.object({
  text: z.string().min(1).max(2000),
});
