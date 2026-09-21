export const LEAD_SOURCE_OPTIONS = [
  'Website',
  'Referral',
  'Walk-in',
  'Google Ads',
  'Social Media',
  'Instagram',
  'Property Portal',
  'Marketplace',
  'Broker Network',
  'Other',
] as const;

export const LEAD_TEMPERATURE_OPTIONS = ['HOT', 'WARM', 'COLD'] as const;
export type LeadTemperature = (typeof LEAD_TEMPERATURE_OPTIONS)[number];

export type LeadSourceOption = (typeof LEAD_SOURCE_OPTIONS)[number];

export function isKnownLeadSource(source: string | undefined | null): source is LeadSourceOption {
  return !!source && (LEAD_SOURCE_OPTIONS as readonly string[]).includes(source);
}
