// Khata Book Types for tracking money transactions

export type KhataTransactionType = 'TO_GIVE' | 'TO_TAKE';
export type KhataPartyType = 'OWNER' | 'TENANT' | 'BUYER' | 'SELLER';
export type KhataSettlementStatus = 'PENDING' | 'SETTLED';

// Predefined categories
export const KHATA_CATEGORIES = {
  BROKERAGE: 'Brokerage',
  MAINTENANCE: 'Maintenance',
  DEEP_CLEANING: 'Deep Cleaning',
  REPAIR: 'Repair',
  SECURITY_DEPOSIT: 'Security Deposit',
  RENT: 'Rent',
  UTILITY_BILLS: 'Utility Bills',
  OTHER: 'Other',
} as const;

export interface KhataCategory {
  categoryId: string;
  tenantId: string;
  name: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface KhataLineItem {
  categoryId: string;
  categoryName: string;
  amount: number;
}

export interface KhataEntry {
  entryId: string;
  tenantId: string;
  propertyId: string;
  property?: {
    propertyId: string;
    title: string;
    area: string;
    flatNumber?: string;
  };
  partyType: KhataPartyType;
  partyId: string; // ownerId or customerId
  partyName: string;
  transactionType: KhataTransactionType;
  amount: number;
  categoryId: string;
  categoryName: string;
  lineItems?: KhataLineItem[];
  description?: string;
  settlementStatus: KhataSettlementStatus;
  settledAt?: string;
  settledBy?: string;
  settlementNotes?: string;
  reminderAt?: string;
  reminderNote?: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
}

export interface KhataSummary {
  totalToGive: number;
  totalToTake: number;
  netBalance: number; // positive means money to take, negative means money to give
  pendingEntries: number;
  settledEntries: number;
}

export interface KhataPropertySummary {
  propertyId: string;
  propertyTitle: string;
  area: string;
  flatNumber?: string;
  toGive: number;
  toTake: number;
  netBalance: number;
  entriesCount: number;
}

// API Request/Response Types
export interface CreateKhataEntryData {
  propertyId: string;
  partyType: KhataPartyType;
  partyId: string;
  transactionType: KhataTransactionType;
  amount?: number;
  categoryId?: string;
  lineItems?: Array<{
    categoryId: string;
    amount: number;
  }>;
  description?: string;
  reminderAt?: string;
  reminderNote?: string;
}

export interface UpdateKhataEntryData {
  propertyId?: string;
  partyType?: KhataPartyType;
  partyId?: string;
  transactionType?: KhataTransactionType;
  amount?: number;
  categoryId?: string;
  lineItems?: Array<{
    categoryId: string;
    amount: number;
  }>;
  description?: string;
  reminderAt?: string;
  reminderNote?: string;
}

export interface SettleKhataEntryData {
  settlementNotes?: string;
}

export interface CreateKhataCategoryData {
  name: string;
}

export interface KhataFilters {
  propertyId?: string;
  partyType?: KhataPartyType;
  partyId?: string;
  transactionType?: KhataTransactionType;
  settlementStatus?: KhataSettlementStatus;
  categoryId?: string;
}
