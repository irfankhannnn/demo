/**
 * Realistic seed data for Playwright tests
 * Uses Indian names, realistic phone numbers, and proper addresses
 */

export const SEED_DATA = {
  owners: [
    { firstName: 'Rajesh', lastName: 'Kumar' },
    { firstName: 'Priya', lastName: 'Sharma' },
    { firstName: 'Amit', lastName: 'Patel' },
    { firstName: 'Sneha', lastName: 'Reddy' },
    { firstName: 'Vikram', lastName: 'Singh' },
    { firstName: 'Anita', lastName: 'Desai' },
    { firstName: 'Rahul', lastName: 'Mehta' },
    { firstName: 'Pooja', lastName: 'Verma' },
    { firstName: 'Sanjay', lastName: 'Kapoor' },
    { firstName: 'Neha', lastName: 'Gupta' },
  ],

  buyers: [
    { firstName: 'Arjun', lastName: 'Menon' },
    { firstName: 'Kavya', lastName: 'Nair' },
    { firstName: 'Deepak', lastName: 'Iyer' },
    { firstName: 'Divya', lastName: 'Krishnan' },
    { firstName: 'Karthik', lastName: 'Subramanian' },
    { firstName: 'Lakshmi', lastName: 'Venkat' },
    { firstName: 'Ravi', lastName: 'Chandran' },
    { firstName: 'Meera', lastName: 'Sundaram' },
    { firstName: 'Suresh', lastName: 'Balakrishnan' },
    { firstName: 'Anjali', lastName: 'Raghavan' },
  ],

  tenants: [
    { firstName: 'Siddharth', lastName: 'Joshi' },
    { firstName: 'Riya', lastName: 'Pillai' },
    { firstName: 'Aditya', lastName: 'Kulkarni' },
    { firstName: 'Ishita', lastName: 'Jadhav' },
    { firstName: 'Vishal', lastName: 'Patil' },
    { firstName: 'Tanvi', lastName: 'Desai' },
    { firstName: 'Rohan', lastName: 'Kale' },
    { firstName: 'Sakshi', lastName: 'Gokhale' },
    { firstName: 'Aarav', lastName: 'Thakur' },
    { firstName: 'Diya', lastName: 'Chopra' },
  ],

  properties: {
    titles: [
      'Sunrise Heights Apartment',
      'Green Valley Residency',
      'Lake View Villa',
      'Metro Prime Towers',
      'Garden Enclave',
      'City Center Flats',
      'Palm Grove Society',
      'Hillside Retreat',
      'Riverside Apartments',
      'Skyline Towers',
    ],
    areas: [
      'Andheri West',
      'Bandra East',
      'Powai',
      'Juhu',
      'Malad West',
      'Borivali East',
      'Thane West',
      'Dadar',
      'Worli',
      'Chembur',
    ],
    cities: ['Mumbai', 'Mumbai', 'Mumbai', 'Mumbai', 'Mumbai', 'Mumbai', 'Mumbai', 'Mumbai', 'Mumbai', 'Mumbai'],
    types: ['apartment', 'apartment', 'villa', 'apartment', 'apartment', 'apartment', 'apartment', 'villa', 'apartment', 'apartment'],
    bhk: [2, 3, 4, 2, 3, 2, 3, 4, 2, 3],
  },

  propertyDetails: {
    buildings: [
      'Omkar Alta Monte',
      'Lodha World Towers',
      'Godrej Properties',
      'Piramal Realty',
      'Raheja Universal',
      'Hiranandani Developers',
      'Godrej Infinity',
      'Kalyani Developers',
      'Rustomjee',
      'Amit Enterprises',
    ],
  },

  leadRequirements: {
    buyer: [
      { requirement: '3BHK with parking near metro station', budget: 15000000, preferredArea: 'Andheri West' },
      { requirement: '2BHK sea-facing apartment', budget: 12000000, preferredArea: 'Bandra West' },
      { requirement: '4BHK villa with garden', budget: 25000000, preferredArea: 'Juhu' },
      { requirement: '1BHK studio for investment', budget: 8000000, preferredArea: 'Malad West' },
      { requirement: '3BHK in gated community', budget: 18000000, preferredArea: 'Powai' },
    ],
    tenant: [
      { requirement: '2BHK near office with parking', budget: 65000, preferredArea: 'Andheri East' },
      { requirement: '1BHK near metro', budget: 35000, preferredArea: 'Bandra Kurla Complex' },
      { requirement: '3BHK for family with amenities', budget: 85000, preferredArea: 'Powai' },
      { requirement: 'Studio apartment near IT park', budget: 25000, preferredArea: 'Malad West' },
      { requirement: '2BHK with balcony', budget: 55000, preferredArea: 'Thane West' },
    ],
    seller: [
      { propertyType: 'apartment', area: 'Bandra West', expectedPrice: 18000000, timeline: 'Within 2 months' },
      { propertyType: 'villa', area: 'Juhu', expectedPrice: 35000000, timeline: 'Within 3 months' },
      { propertyType: 'apartment', area: 'Andheri East', expectedPrice: 12000000, timeline: 'Immediate' },
      { propertyType: 'house', area: 'Powai', expectedPrice: 22000000, timeline: 'Within 6 months' },
      { propertyType: 'apartment', area: 'Malad West', expectedPrice: 9500000, timeline: 'Within 4 months' },
    ],
    owner: [
      { propertyType: 'apartment', area: 'Andheri West', rentExpected: 65000 },
      { propertyType: 'apartment', area: 'Bandra East', rentExpected: 85000 },
      { propertyType: 'villa', area: 'Juhu', rentExpected: 250000 },
      { propertyType: 'apartment', area: 'Powai', rentExpected: 55000 },
      { propertyType: 'apartment', area: 'Malad West', rentExpected: 45000 },
    ],
  },

  sources: ['Website', 'Referral', 'Walk-in', 'Social Media', 'Justdial', 'MagicBricks', '99acres', 'Housing.com', 'Facebook', 'WhatsApp'],
  statuses: ['new', 'contacted', 'qualified', 'negotiating', 'lost'],
  priorities: ['low', 'medium', 'high'],
};

/**
 * Generate a unique phone number for testing
 * Uses 7000xxxxxx format (Indian mobile number range)
 */
export function generateTestPhone(offset: number, base: number = 7000000000): string {
  return String(base + offset);
}

/**
 * Generate a unique email for testing
 */
export function generateTestEmail(prefix: string, offset: number, suffix: string = 'test.com'): string {
  return `${prefix}.${offset}@${suffix}`.toLowerCase();
}

/**
 * Get a random item from an array
 */
export function getRandomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Get a random item from array by index
 */
export function getItemByIndex<T>(array: T[], index: number): T {
  return array[index % array.length];
}
