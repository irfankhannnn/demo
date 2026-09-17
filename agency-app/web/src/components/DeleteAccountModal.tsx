import { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import {
  getDeletionPreview,
  deleteMyAccount,
  type DeletionPreview,
} from '../services/accountApi';

const CONFIRMATION_PHRASE = 'DELETE';

interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called after a successful deletion so the caller can clear auth and redirect. */
  onDeleted: () => void;
}

/**
 * Confirmation flow for permanent account deletion.
 *
 * Two deliberate pieces of friction, because this is irreversible:
 *   1. The consequences are fetched from the server first, so an agency owner
 *      is told how many team members they are about to remove rather than
 *      discovering it afterwards.
 *   2. The user types DELETE. A single tap on a destructive control is too easy
 *      to hit by accident on a phone.
 */
export default function DeleteAccountModal({
  isOpen,
  onClose,
  onDeleted,
}: DeleteAccountModalProps) {
  const [preview, setPreview] = useState<DeletionPreview | null>(null);
  const [typed, setTyped] = useState('');
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) {
      // Reset so a reopened modal never starts pre-confirmed.
      setTyped('');
      setError('');
      setPreview(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    getDeletionPreview()
      .then((p) => {
        if (!cancelled) setPreview(p);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message || 'Could not load account details.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const canDelete = typed.trim().toUpperCase() === CONFIRMATION_PHRASE && !!preview && !deleting;

  const handleDelete = async () => {
    if (!preview) return;
    setDeleting(true);
    setError('');
    try {
      await deleteMyAccount(preview.deletesAgency);
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deletion failed. Please try again.');
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl p-6 my-8">
        <button
          onClick={onClose}
          disabled={deleting}
          aria-label="Close"
          className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3 mb-4 pr-8">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Delete your account</h2>
        </div>

        {loading && <p className="text-sm text-slate-500">Checking what will be deleted…</p>}

        {!loading && preview && (
          <>
            <p className="text-sm text-slate-600 mb-3">
              This is permanent and cannot be undone.
            </p>

            {preview.deletesAgency ? (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                <p className="font-semibold mb-1">This deletes your entire agency.</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>You are the agency owner, so the agency is removed with your account.</li>
                  {preview.memberCount > 0 && (
                    <li>
                      <strong>
                        {preview.memberCount} team{' '}
                        {preview.memberCount === 1 ? 'member' : 'members'}
                      </strong>{' '}
                      will immediately lose access.
                    </li>
                  )}
                  <li>
                    All CRM data — leads, properties, contacts, khata records and uploaded
                    documents — is scheduled for deletion within {preview.gracePeriodDays} days.
                  </li>
                </ul>
              </div>
            ) : (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Your personal account and sign-in are removed immediately. Records you created
                stay with the agency, which continues to operate.
              </div>
            )}

            <label htmlFor="delete-confirm" className="block text-sm text-slate-600 mb-2">
              Type <span className="font-mono font-semibold text-slate-900">DELETE</span> to
              confirm.
            </label>
            <input
              id="delete-confirm"
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              disabled={deleting}
              autoComplete="off"
              autoCapitalize="characters"
              className="w-full min-h-[44px] rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 disabled:opacity-50"
              placeholder="DELETE"
            />
          </>
        )}

        {error && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <div className="mt-6 flex flex-col-reverse sm:flex-row gap-3">
          <button
            onClick={onClose}
            disabled={deleting}
            className="flex-1 min-h-[44px] rounded-lg bg-slate-100 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={!canDelete}
            className="flex-1 min-h-[44px] rounded-lg bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {deleting ? 'Deleting…' : 'Delete permanently'}
          </button>
        </div>
      </div>
    </div>
  );
}
