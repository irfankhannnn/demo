/** Shared Contracts §3.4 — canonical event names for PostHog (CRM-side). */
export type AnalyticsEvent =
  | 'signup_started'
  | 'signup_completed'
  | 'otp_verified'
  | 'onboarding_role_selected'
  | 'onboarding_plan_buy_clicked'
  | 'onboarding_trial_started'
  | 'agency_registered'
  | 'buyer_added'
  | 'owner_added'
  | 'property_added'
  | 'lead_added'
  | 'lead_converted'
  | 'khata_entry_created'
  | 'khata_settled'
  | 'meeting_scheduled'
  | 'whatsapp_share_clicked'
  | 'feature_first_use'
  | 'trial_paywall_shown'
  | 'trial_paywall_clicked'
  | 'subscription_started'
  | 'subscription_cancelled'
  | 'ai_employee_connected'
  | 'ai_employee_lead_handled'
  | 'nps_response'
  | 'paywall_seat_limit_hit'
  | 'seat_added'
  | 'invite_accepted'
  | 'grievance_submitted';

/** Shared Contracts §3.4 — traits sent once via identifyUser after login. */
export interface UserTraits {
  tenantId: string;
  role: string;
  plan: string;
  trialEndsAt?: string;
  agencyName?: string;
  utm_source?: string;
  utm_campaign?: string;
  utm_medium?: string;
}
