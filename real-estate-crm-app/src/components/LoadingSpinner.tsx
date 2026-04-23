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

  return (
    <div className="text-center">
      <div className={`relative ${sizeClasses[size]} mx-auto`}>
        <div className="absolute inset-0 rounded-full border-4 border-gray-200" />
        <div
          className={`absolute inset-0 rounded-full border-4 border-${color}-500 border-t-transparent animate-spin`}
        />
      </div>
      <p className="mt-4 text-gray-600 animate-pulse font-medium">{message}</p>
    </div>
  );
}
