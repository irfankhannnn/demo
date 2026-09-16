export const LEAD_BHK_OPTIONS = [
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

export type LeadBhkOption = (typeof LEAD_BHK_OPTIONS)[number];
