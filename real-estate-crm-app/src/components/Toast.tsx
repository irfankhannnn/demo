import { useEffect, useState } from 'react';
import { CheckCircle, X, AlertCircle } from 'lucide-react';

interface ToastProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
  duration?: number;
}

export default function Toast({ message, type, onClose, duration = 3000 }: ToastProps) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration]);

  const handleClose = () => {
    setExiting(true);
    setTimeout(onClose, 300);
  };

  const isSuccess = type === 'success';
  const gradientFrom = isSuccess ? 'from-emerald-500/10' : 'from-rose-500/10';
  const gradientTo = isSuccess ? 'to-emerald-500/5' : 'to-rose-500/5';
  const borderColor = isSuccess ? 'border-emerald-200/60' : 'border-rose-200/60';
  const iconColor = isSuccess ? 'text-emerald-600' : 'text-rose-600';
  const iconBg = isSuccess ? 'bg-emerald-50' : 'bg-rose-50';
  const textColor = isSuccess ? 'text-emerald-900' : 'text-rose-900';
  const progressFrom = isSuccess ? 'from-emerald-400' : 'from-rose-400';
  const progressTo = isSuccess ? 'to-emerald-300' : 'to-rose-300';

  return (
    <div
      className={`fixed top-5 right-5 z-[70] ${
        exiting ? 'animate-fadeIn' : 'animate-slideInRight'
      }`}
      style={
        exiting
          ? { animation: 'fadeIn 0.25s ease-in-out reverse both' }
          : undefined
      }
    >
      <div
        className={`relative flex items-center gap-3 pl-4 pr-5 py-3.5 rounded-2xl shadow-xl shadow-black/5 overflow-hidden glass-premium ${borderColor} min-w-[280px] max-w-[420px]`}
      >
        {/* Subtle gradient bg */}
        <div className={`absolute inset-0 bg-gradient-to-br ${gradientFrom} ${gradientTo} pointer-events-none`} />

        {/* Progress bar */}
        <div
          className={`absolute bottom-0 left-0 h-[2px] bg-gradient-to-r ${progressFrom} ${progressTo} toast-progress`}
          style={{ animationDuration: `${duration}ms` }}
        />

        {/* Icon */}
        <div className={`relative flex-shrink-0 w-9 h-9 rounded-xl ${iconBg} flex items-center justify-center`}>
          {isSuccess ? (
            <CheckCircle className={`h-5 w-5 ${iconColor}`} />
          ) : (
            <AlertCircle className={`h-5 w-5 ${iconColor}`} />
          )}
        </div>

        {/* Message */}
        <p className={`relative text-sm font-semibold ${textColor} leading-snug flex-1`}>
          {message}
        </p>

        {/* Close */}
        <button
          onClick={handleClose}
          className={`relative p-1.5 rounded-lg transition-all duration-200 ${
            isSuccess
              ? 'text-emerald-400 hover:text-emerald-700 hover:bg-emerald-50'
              : 'text-rose-400 hover:text-rose-700 hover:bg-rose-50'
          }`}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
