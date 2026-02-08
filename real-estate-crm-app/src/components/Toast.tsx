import { useEffect } from 'react';
import { CheckCircle, X, AlertCircle } from 'lucide-react';

interface ToastProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
  duration?: number;
}

export default function Toast({ message, type, onClose, duration = 3000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div className="fixed top-4 right-4 z-50 animate-slide-in-right">
      <div
        className={`flex items-center gap-3 px-6 py-4 rounded-lg shadow-lg ${
          type === 'success'
            ? 'bg-green-50 border border-green-200'
            : 'bg-red-50 border border-red-200'
        }`}
      >
        {type === 'success' ? (
          <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
        ) : (
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
        )}
        <p
          className={`text-sm font-medium ${
            type === 'success' ? 'text-green-800' : 'text-red-800'
          }`}
        >
          {message}
        </p>
        <button
          onClick={onClose}
          className={`ml-4 ${
            type === 'success'
              ? 'text-green-600 hover:text-green-800'
              : 'text-red-600 hover:text-red-800'
          }`}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
