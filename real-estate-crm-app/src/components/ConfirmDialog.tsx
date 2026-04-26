import { AlertCircle, Trash2 } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmVariant = 'primary',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm animate-fadeIn"
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-message"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 transform transition-all animate-scaleIn">
        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div
            className={`w-16 h-16 rounded-full flex items-center justify-center ${
              confirmVariant === 'danger' ? 'bg-red-100' : 'bg-blue-100'
            }`}
          >
            {confirmVariant === 'danger' ? (
              <Trash2 className={`w-8 h-8 ${confirmVariant === 'danger' ? 'text-red-600' : 'text-blue-600'}`} />
            ) : (
              <AlertCircle className={`w-8 h-8 ${confirmVariant === 'danger' ? 'text-red-600' : 'text-blue-600'}`} />
            )}
          </div>
        </div>

        {/* Content */}
        <div className="text-center mb-6">
          <h2 id="confirm-title" className="text-2xl font-bold text-slate-900 mb-2">
            {title}
          </h2>
          <p id="confirm-message" className="text-slate-600">
            {message}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-3 border-2 border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-all"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 px-4 py-3 text-white rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] ${
              confirmVariant === 'danger'
                ? 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800'
                : 'bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
