import { useSubscriptionContext } from '../contexts/SubscriptionContext';

/**
 * Hook to access subscription state.
 * Fetches GET /api/subscriptions/trial-status on mount + every 5 minutes (via SubscriptionContext).
 * Returns null/defaults when user not authenticated or endpoint returns 404.
 */
export function useSubscription() {
  const ctx = useSubscriptionContext();
  return {
    subscription: ctx.subscription,
    loading: ctx.loading,
    isPaying: ctx.isPaying,
    isTrialing: ctx.isTrialing,
    trialDaysLeft: ctx.trialDaysLeft,
    isTrialExpired: ctx.isTrialExpired,
    gracePeriodActive: ctx.subscription?.gracePeriodActive ?? false,
    refetch: ctx.refetch,
  };
}
