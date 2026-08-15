import { Coins, AlertTriangle, TrendingDown, TrendingUp, Clock } from 'lucide-react';
import { useCredits } from '../hooks/useCredits';

interface CreditBalanceCardProps {
  onBuyCredits?: () => void;
  lastMonthUsage?: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  aiEmployee: 'AI Employee',
  ai_employee: 'AI Employee',
  whatsapp: 'WhatsApp sends',
  whatsapp_send: 'WhatsApp sends',
  leadCreation: 'Lead creation',
  lead_creation: 'Lead creation',
  lead: 'Lead creation',
  property: 'Property listing',
  call: 'AI calls',
  default: 'Other',
};

export default function CreditBalanceCard({ onBuyCredits, lastMonthUsage }: CreditBalanceCardProps) {
  const { balance, monthlyAllotment, loading, error, percentUsed, costs, refetch } = useCredits();

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 animate-pulse">
        <div className="h-8 bg-slate-200 rounded w-32 mb-4" />
        <div className="h-2 bg-slate-200 rounded-full mb-2" />
        <div className="h-2 bg-slate-200 rounded-full w-3/4" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <div>
              <p className="text-sm text-red-600 font-medium">Failed to load credits</p>
              <p className="text-xs text-red-500 mt-1">{error}</p>
            </div>
          </div>
          <button
            onClick={refetch}
            className="text-sm font-medium text-red-600 hover:text-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const isLow = monthlyAllotment > 0 && balance < monthlyAllotment * 0.2 && balance > 0;
  const isEmpty = balance === 0;

  const thisMonthUsage = Math.max(0, monthlyAllotment - balance);
  const hasComparison = typeof lastMonthUsage === 'number';
  const usageChange = hasComparison ? thisMonthUsage - lastMonthUsage! : 0;

  // Calculate estimated days until credits run out
  const dailyUsageRate = thisMonthUsage > 0 ? thisMonthUsage / Math.max(1, new Date().getDate()) : 0;
  const estimatedDaysLeft = dailyUsageRate > 0 ? Math.ceil(balance / dailyUsageRate) : null;

  const progressColor = isEmpty ? 'bg-red-500' : isLow ? 'bg-amber-500' : 'bg-brand';
  const borderColor = isEmpty ? 'border-red-200' : isLow ? 'border-amber-200' : 'border-slate-200';
  const bgColor = isEmpty ? 'bg-red-50' : isLow ? 'bg-amber-50' : 'bg-white';

  const costEntries = Object.entries(costs || {}).filter(([key]) => key !== 'default');
  const hasBreakdown = costEntries.length > 0;

  return (
    <div className={`rounded-xl border p-4 ${bgColor} ${borderColor}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {isEmpty || isLow ? (
            <AlertTriangle className={`h-5 w-5 ${isEmpty ? 'text-red-500' : 'text-amber-500'}`} />
          ) : (
            <Coins className="h-5 w-5 text-brand" />
          )}
          <div>
            <p className="text-sm text-slate-500">Credits remaining</p>
            <p className="text-2xl font-bold text-slate-900">{balance.toLocaleString('en-IN')}</p>
          </div>
        </div>
        {onBuyCredits && (
          <button
            onClick={onBuyCredits}
            className="text-sm font-medium bg-brand text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Buy more
          </button>
        )}
      </div>

      {monthlyAllotment > 0 && (
        <div className="mt-3">
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${progressColor}`}
              style={{ width: `${Math.min(100, percentUsed)}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {isLow && !isEmpty && `⚠️ Low credits: ${balance} remaining (${Math.max(0, Math.round((balance / monthlyAllotment) * 100))}% of monthly)`}
            {isEmpty && '🛑 Out of credits. Purchase a pack to continue.'}
            {!isLow && !isEmpty && `${balance} of ${monthlyAllotment} monthly credits`}
          </p>
        </div>
      )}

      {/* Warning banner when below 20% */}
      {isLow && !isEmpty && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-100 border border-amber-200 p-3 text-xs text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>
            Your credit balance is below 20% of your monthly allotment. Consider buying more
            credits to avoid interrupted AI service.
          </p>
        </div>
      )}

      {/* This month vs last month + estimated days */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="p-3 rounded-lg bg-white/60 border border-slate-100">
          <p className="text-xs text-slate-500">This month used</p>
          <p className="text-lg font-semibold text-slate-900">{thisMonthUsage.toLocaleString('en-IN')}</p>
        </div>
        <div className="p-3 rounded-lg bg-white/60 border border-slate-100">
          <p className="text-xs text-slate-500">Last month</p>
          <div className="flex items-center gap-1">
            <p className="text-lg font-semibold text-slate-900">
              {hasComparison ? lastMonthUsage!.toLocaleString('en-IN') : '—'}
            </p>
            {hasComparison && (
              usageChange >= 0 ? (
                <TrendingUp className="h-4 w-4 text-amber-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-green-600" />
              )
            )}
          </div>
        </div>
        {estimatedDaysLeft !== null && !isEmpty && (
          <div className="p-3 rounded-lg bg-white/60 border border-slate-100">
            <div className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              <p className="text-xs text-slate-500">Est. days left</p>
            </div>
            <p className={`text-lg font-semibold ${estimatedDaysLeft <= 7 ? 'text-red-600' : 'text-slate-900'}`}>
              {estimatedDaysLeft}
            </p>
          </div>
        )}
      </div>

      {/* Credit breakdown by category */}
      {hasBreakdown && (
        <div className="mt-4">
          <p className="text-xs font-medium text-slate-500 mb-2">Credit rates by category</p>
          <div className="space-y-1.5">
            {costEntries.map(([key, value]) => {
              const label = CATEGORY_LABELS[key] || key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
              return (
                <div key={key} className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">{label}</span>
                  <span className="font-medium text-slate-900">{value} cr</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
