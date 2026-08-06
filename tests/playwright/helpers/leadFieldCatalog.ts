/**
 * Lead entity field catalog — aligned with LeadDetails.tsx (/crm/leads/new, /crm/leads/:id),
 * server/crmDynamodbService.js createLead, and real-estate-crm-app/src/types/crm.ts.
 *
 * Mandatory at API: leadType, name
 * Mandatory at UI: leadType, name (marked with *)
 * All other shared + subtype fields are optional but should be filled in comprehensive E2E tests.
 */

export const LEAD_UI_SOURCES = [
  'Website',
  'Referral',
  'Walk-in',
  'Google Ads',
  'Social Media',
  'Property Portal',
  'Broker Network',
  'Other',
] as const;

export const LEAD_UI_STATUSES = [
  'new',
  'contacted',
  'qualified',
  'negotiating',
  'lost',
] as const;

export const LEAD_UI_PRIORITIES = ['low', 'medium', 'high'] as const;

export const LEAD_UI_LOST_REASONS = [
  'Price too high',
  'Found another property',
  'Not interested anymore',
  "Couldn't reach",
  'Other',
] as const;

export const BUYER_PROPERTY_TYPES = ['apartment', 'house', 'villa', 'office'] as const;
export const SELLER_PROPERTY_TYPES = ['apartment', 'house', 'villa', 'office', 'land'] as const;
export const OWNER_PROPERTY_TYPES = ['apartment', 'house', 'villa', 'office'] as const;
export const BHK_VALUES = [
  'Studio',
  '1 RK',
  '1 BHK',
  '1.5 BHK',
  '2 BHK',
  '2.5 BHK',
  '3 BHK',
  '3.5 BHK',
  '4 BHK',
  '4.5 BHK',
  '5 BHK',
  '5+ BHK',
] as const;
export const FURNISHING_VALUES = ['furnished', 'semi-furnished', 'unfurnished'] as const;

export type LeadType = 'buyer' | 'seller' | 'tenant' | 'owner';

/** Shared PROFILE fields editable on LeadDetails create/edit form */
export const SHARED_LEAD_FIELDS = [
  { key: 'leadType', label: 'Lead Type', required: true, ui: 'LeadDetails Lead Type select' },
  { key: 'name', label: 'Name', required: true, ui: 'placeholder Full name' },
  { key: 'phone', label: 'Phone', required: false, ui: 'placeholder Phone number' },
  { key: 'email', label: 'Email', required: false, ui: 'placeholder Email address' },
  { key: 'source', label: 'Source', required: false, ui: 'Source select (+ custom when Other)' },
  { key: 'status', label: 'Status', required: false, ui: 'Status select', default: 'new' },
  { key: 'priority', label: 'Priority', required: false, ui: 'Priority select', default: 'medium' },
  { key: 'lostReason', label: 'Reason for Loss', required: false, ui: 'shown when status=lost' },
  { key: 'lostAt', label: 'Lost At', required: false, ui: 'auto-set when status=lost' },
  { key: 'notes', label: 'Notes', required: false, ui: 'placeholder General notes about this lead...' },
  { key: 'draftActivityNote', label: 'Add Activity Note', required: false, ui: 'create-only; saved as NOTE# after create' },
] as const;

/** buyerRequirement — LeadDetails Buyer Requirements section */
export const BUYER_REQUIREMENT_FIELDS = [
  { key: 'requirement', label: 'Requirement', ui: 'textarea What are they looking for?' },
  { key: 'budget', label: 'Budget', ui: 'placeholder Budget amount' },
  { key: 'preferredArea', label: 'Preferred Area', ui: 'placeholder Preferred location' },
  { key: 'city', label: 'City', ui: 'select Mumbai|Pune|Thane|Navi Mumbai' },
  { key: 'propertyType', label: 'Property Type', ui: 'select apartment|house|villa|office' },
  { key: 'bhk', label: 'BHK', ui: 'select Studio|1 RK|1 BHK|1.5 BHK|2 BHK|2.5 BHK|3 BHK|3.5 BHK|4 BHK|4.5 BHK|5 BHK|5+ BHK' },
  { key: 'propertySubType', label: 'Property Sub Type', ui: 'NOT on LeadDetails (drawer/AI only)' },
  { key: 'timeline', label: 'Timeline', ui: 'NOT on LeadDetails (types/AI only)' },
] as const;

/** sellerProperty — LeadDetails → LeadPropertyFields (variant=seller); fields vary by propertyType */
export const SELLER_PROPERTY_FIELDS = [
  { key: 'propertyType', label: 'Property Type', ui: 'select incl. land' },
  { key: 'bhk', label: 'BHK / Size Category', ui: 'hidden for land/office (office uses Size Category)' },
  { key: 'buildingName', label: 'Building Name (dynamic label)', ui: 'LeadPropertyFields + leadPropertySchema labels' },
  { key: 'flatNumber', label: 'Flat No. / Office Unit', ui: 'hidden for house, villa, land' },
  { key: 'floor', label: 'Floor', ui: 'hidden for house, villa, land' },
  { key: 'furnishing', label: 'Furnishing', ui: 'hidden for land' },
  { key: 'carpetArea', label: 'Carpet/Built-up/Plot Area', ui: 'label varies by propertyType' },
  { key: 'area', label: 'Area/Location', ui: 'always shown' },
  { key: 'city', label: 'City', ui: 'select Mumbai|Pune|Thane|Navi Mumbai' },
  { key: 'expectedPrice', label: 'Expected Price', ui: 'seller only' },
  { key: 'timeline', label: 'Timeline', ui: 'create: placeholder e.g., Within 3 months' },
  { key: 'address', label: 'Detailed Address', ui: 'textarea always shown' },
  { key: 'notes', label: 'notes', ui: 'NOT on LeadDetails (backend/AI only)' },
] as const;

/** tenantRequirement — LeadDetails Rental Requirements section */
export const TENANT_REQUIREMENT_FIELDS = [
  { key: 'requirement', label: 'Requirement', ui: 'textarea What type of rental are they looking for?' },
  { key: 'budget', label: 'Budget (Monthly)', ui: 'placeholder Monthly budget' },
  { key: 'preferredArea', label: 'Preferred Area', ui: 'placeholder Preferred location' },
  { key: 'city', label: 'City', ui: 'select Mumbai|Pune|Thane|Navi Mumbai' },
  { key: 'moveInDate', label: 'Move-in Date', ui: 'input[type=date]' },
] as const;

/** ownerProperty — LeadDetails → LeadPropertyFields (variant=owner); fields vary by propertyType */
export const OWNER_PROPERTY_FIELDS = [
  { key: 'propertyType', label: 'Property Type', ui: 'select apartment|house|villa|office' },
  { key: 'bhk', label: 'BHK / Size Category', ui: 'visibility same as seller schema' },
  { key: 'buildingName', label: 'Building Name (dynamic label)', ui: 'LeadPropertyFields' },
  { key: 'flatNumber', label: 'Flat No.', ui: 'apartment/office only' },
  { key: 'floor', label: 'Floor', ui: 'apartment/office only' },
  { key: 'furnishing', label: 'Furnishing', ui: 'hidden for land (owner has no land type)' },
  { key: 'carpetArea', label: 'Carpet/Built-up Area', ui: 'label varies by propertyType' },
  { key: 'area', label: 'Area/Location', ui: 'always shown' },
  { key: 'city', label: 'City', ui: 'select Mumbai|Pune|Thane|Navi Mumbai' },
  { key: 'rentExpected', label: 'Expected Rent', ui: 'placeholder Expected monthly rent' },
  { key: 'securityDeposit', label: 'Security Deposit', ui: 'placeholder Security deposit' },
  { key: 'address', label: 'Detailed Address', ui: 'textarea always shown' },
  { key: 'notes', label: 'notes', ui: 'NOT on LeadDetails (backend/AI only)' },
] as const;
