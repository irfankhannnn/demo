interface LoadingSpinnerProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  color?: string;
}

export default function LoadingSpinner({
  message = 'Loading...',
  size = 'md',
  color = 'indigo',
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-16 h-16',
    lg: 'w-24 h-24',
  };

  const strokeWidths = {
    sm: 3,
    md: 4,
    lg: 5,
  };

  const colorMap: Record<string, string> = {
    indigo: '#6366f1',
    purple: '#a855f7',
    emerald: '#10b981',
    rose: '#f43f5e',
    amber: '#f59e0b',
    blue: '#3b82f6',
  };

  const c = colorMap[color] || colorMap.indigo;

  return (
    <div className="text-center">
      <div className={`relative ${sizeClasses[size]} mx-auto`}>
        {/* Track ring */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            border: `${strokeWidths[size]}px solid rgba(226, 232, 240, 0.6)`,
          }}
        />
        {/* Spinning gradient arc */}
        <svg
          className="absolute inset-0 w-full h-full animate-spin"
          style={{ animationDuration: '1.1s' }}
          viewBox="0 0 100 100"
        >
          <defs>
            <linearGradient id={`spinnerGrad-${color}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={c} stopOpacity="0.1" />
              <stop offset="50%" stopColor={c} stopOpacity="1" />
              <stop offset="100%" stopColor={c} stopOpacity="0.1" />
            </linearGradient>
          </defs>
          <circle
            cx="50"
            cy="50"
            r={45 - strokeWidths[size] * 2}
            fill="none"
            stroke={`url(#spinnerGrad-${color})`}
            strokeWidth={strokeWidths[size] * 3.5}
            strokeLinecap="round"
            strokeDasharray="180 360"
          />
        </svg>
        {/* Inner dot */}
        <div
          className="absolute inset-0 m-auto rounded-full animate-gentlePulse"
          style={{
            width: size === 'sm' ? 6 : size === 'md' ? 10 : 14,
            height: size === 'sm' ? 6 : size === 'md' ? 10 : 14,
            background: `linear-gradient(135deg, ${c}, ${c}88)`,
            boxShadow: `0 0 12px ${c}44`,
          }}
        />
      </div>
      <p className="mt-5 text-sm text-slate-500 font-medium animate-fadeInUp" style={{ animationDelay: '0.2s' }}>
        {message}
      </p>
    </div>
  );
}
