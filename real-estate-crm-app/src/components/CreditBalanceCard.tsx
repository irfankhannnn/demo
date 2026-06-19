import { useState } from 'react';
import { Coins, AlertTriangle } from 'lucide-react';
import { useCredits } from '../hooks/useCredits';

interface CreditBalanceCardProps {
  onBuyCredits?: () => void;
}

export default function CreditBalanceCard({ onBuyCredits }: CreditBalanceCardProps) {
  const { balance, monthlyAllotment, loading, percentUsed } = useCredits();

  if (loading) return null;

  const isLow = percentUsed >= 90 && balance > 0;
  const isEmpty = balance === 0;

  return (
    <div className={`rounded-xl border p-4 ${
      isEmpty ? 'bg-red-50 border-red-200' : isLow ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'
    }`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {isEmpty || isLow ? (
            <AlertTriangle className={`h-5 w-5 ${isEmpty ? 'text-red-500' : 'text-amber-500'}`} />
          ) : (
            <Coins className="h-5 w-5 text-[#2563EB]" />
          )}
          <div>
            <p className="text-sm text-slate-500">Credits remaining</p>
            <p className="text-2xl font-bold text-slate-900">{balance.toLocaleString('en-IN')}</p>
          </div>
        </div>
        {onBuyCredits && (
          <button
            onClick={onBuyCredits}
            className="text-sm font-medium bg-[#2563EB] text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Buy more
          </button>
        )}
      </div>

      {monthlyAllotment > 0 && (
        <div className="mt-3">
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                isEmpty ? 'bg-red-500' : isLow ? 'bg-amber-500' : 'bg-[#2563EB]'
              }`}
              style={{ width: `${Math.min(100, percentUsed)}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {isLow && !isEmpty && `⚠️ Low credits: ${balance} remaining (${100 - Math.round(percentUsed)}% left)`}
            {isEmpty && '🛑 Out of credits. Purchase a pack to continue.'}
            {!isLow && !isEmpty && `${balance} of ${monthlyAllotment} monthly credits`}
          </p>
        </div>
      )}
    </div>
  );
}
