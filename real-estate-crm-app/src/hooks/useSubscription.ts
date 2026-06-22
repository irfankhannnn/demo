import { useSubscriptionContext } from '../contexts/SubscriptionContext';

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
