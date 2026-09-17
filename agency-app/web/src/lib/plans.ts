export type PlanTierId = 'solo' | 'team' | 'teamplus';

export interface PlanTier {
  id: PlanTierId;
  name: string;
  monthly: number;
  features: string[];
  cta: string;
  popular: boolean;
}

export const PLAN_TIERS: PlanTier[] = [
  {
    id: 'solo',
    name: 'Solo',
    monthly: 999,
    features: ['1 member', 'Unlimited properties', 'Full CRM + Khata', 'GST invoicing', 'Free onboarding'],
    cta: 'Start Solo',
    popular: false,
  },
  {
    id: 'team',
    name: 'Team',
    monthly: 1999,
    features: ['Up to 3 members', 'Everything in Solo', 'Multi-agent hierarchy', 'Shared Khata', 'Member reports'],
    cta: 'Start Team',
    popular: true,
  },
  {
    id: 'teamplus',
    name: 'Team+',
    monthly: 4999,
    features: ['Up to 10 members', 'Everything in Team', 'Dedicated CSM', 'Priority support', 'Custom onboarding'],
    cta: 'Start Team+',
    popular: false,
  },
];

export const ANNUAL_DISCOUNT = 0.8;

export function planPrice(monthly: number, cycle: 'monthly' | 'annual'): number {
  return cycle === 'annual' ? Math.round(monthly * ANNUAL_DISCOUNT) : monthly;
}

/** The ?plan= a visitor arrived with from the marketing site, kept across the login redirect. */
export const SIGNUP_PLAN_KEY = 'signup_plan';

export function isPlanTierId(value: string | null): value is PlanTierId {
  return value === 'solo' || value === 'team' || value === 'teamplus';
}
