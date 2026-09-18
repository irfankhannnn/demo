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

  const isDanger = confirmVariant === 'danger';
  const iconBg = isDanger ? 'bg-rose-50' : 'bg-indigo-50';
  const iconColor = isDanger ? 'text-rose-600' : 'text-indigo-600';
  const confirmGradient = isDanger
    ? 'bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 shadow-rose-500/25'
    : 'bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-700 hover:to-purple-800 shadow-indigo-500/25';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn"
      style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(8px)' }}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-message"
    >
      <div className="glass-premium rounded-3xl w-full max-w-md p-8 animate-scaleInCenter shadow-2xl shadow-black/10">
        {/* Icon */}
        <div className="flex justify-center mb-5">
          <div
            className={`w-[68px] h-[68px] rounded-2xl flex items-center justify-center ${iconBg} shadow-inner`}
          >
            {isDanger ? (
              <Trash2 className={`w-8 h-8 ${iconColor}`} />
            ) : (
              <AlertCircle className={`w-8 h-8 ${iconColor}`} />
            )}
          </div>
        </div>

        {/* Content */}
        <div className="text-center mb-7">
          <h2 id="confirm-title" className="text-xl font-bold text-slate-900 mb-2 tracking-tight">
            {title}
          </h2>
          <p id="confirm-message" className="text-slate-500 leading-relaxed text-[15px]">
            {message}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-5 py-3.5 border-2 border-slate-200/80 text-slate-600 rounded-2xl font-semibold hover:bg-slate-50/80 hover:border-slate-300 transition-all duration-200 active:scale-[0.97]"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 px-5 py-3.5 text-white rounded-2xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl active:scale-[0.97] ${confirmGradient}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
