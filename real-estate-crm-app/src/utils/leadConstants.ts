export const LEAD_SOURCE_OPTIONS = [
  'Website',
  'Referral',
  'Walk-in',
  'Google Ads',
  'Social Media',
  'Property Portal',
  'Broker Network',
  'Other',
] as const;

export type LeadSourceOption = (typeof LEAD_SOURCE_OPTIONS)[number];

export function isKnownLeadSource(source: string | undefined | null): source is LeadSourceOption {
  return !!source && (LEAD_SOURCE_OPTIONS as readonly string[]).includes(source);
}
