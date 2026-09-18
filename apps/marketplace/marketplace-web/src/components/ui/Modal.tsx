/**
 * Modal — a Sheet that is always a centred dialog on ≥sm, used for confirm
 * prompts. Same focus / scroll-lock behaviour.
 */
import type { ReactNode } from 'react';
import { Sheet } from './Sheet';
import { Button } from './Button';

export interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
}

export function ConfirmModal({ open, onClose, onConfirm, title, body, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger, loading }: ConfirmModalProps) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" full onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} full loading={loading} onClick={() => void onConfirm()}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      {body && <div className="text-sm leading-relaxed text-ink/80">{body}</div>}
    </Sheet>
  );
}
