import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { LogOut, Phone, ShieldCheck, Trash2, UserRound } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { errorMessage } from '@/services/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ConfirmModal } from '@/components/ui/Modal';
import { MePageHeader, RequireLogin } from './RequireLogin';

export default function Profile() {
  return (
    <RequireLogin title="Profile" reason="Login to manage your profile.">
      <ProfileInner />
    </RequireLogin>
  );
}

function ProfileInner() {
  const { user, updateProfile, logout, deleteAccount, openModal } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setName(user?.name ?? '');
    setEmail(user?.email ?? '');
  }, [user?.name, user?.email]);

  const dirty = name.trim() !== (user?.name ?? '') || email.trim() !== (user?.email ?? '');

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) {
      toast.error('Name is too short');
      return;
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error('That email does not look right');
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ name: name.trim(), email: email.trim() || undefined });
      toast.success('Profile updated');
    } catch (err) {
      toast.error('Could not save', errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const doLogout = async () => {
    await logout();
    qc.clear();
    toast.info('Logged out. Phir milenge!');
    navigate('/');
  };

  const doDelete = async () => {
    setDeleting(true);
    try {
      await deleteAccount();
      qc.clear();
      setConfirmDelete(false);
      toast.success('Account deleted', 'Your profile, saved homes and searches are gone. Chats are anonymised.');
      navigate('/');
    } catch (err) {
      toast.error('Could not delete account', errorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="container-x max-w-xl py-6 sm:py-10">
      <MePageHeader eyebrow="Your account" title="Profile" />

      <form onSubmit={save} className="space-y-4 rounded-card border border-line bg-paper p-5 shadow-card">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-marigold font-display text-lg font-extrabold text-ink">{(user?.name?.trim()?.[0] ?? 'U').toUpperCase()}</span>
          <div>
            <p className="text-sm font-extrabold">{user?.name || 'Add your name'}</p>
            <p className="text-xs text-dust-dim">Shared with an agency only when you contact them.</p>
          </div>
        </div>
        <Input label="Name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} leftIcon={<UserRound size={16} />} />
        <Input label="Email (optional)" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} hint="For replies when you are not on the site." />
        <div>
          <p className="mb-1.5 block text-[13px] font-bold">Phone</p>
          <div className="flex h-12 items-center gap-2 rounded-xl border border-line bg-paper-2/60 px-4 text-[15px]">
            <Phone size={16} className="text-dust-dim" aria-hidden />
            {user?.phone ? (
              <>
                <span className="tabular">{user.phone}</span>
                <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wider text-tulsi-deep">
                  <ShieldCheck size={13} aria-hidden /> Verified
                </span>
              </>
            ) : (
              <>
                <span className="text-dust-dim">Not verified</span>
                <button type="button" className="ml-auto text-xs font-bold text-marigold-deep underline" onClick={() => openModal({ reason: 'Verify your phone to chat, ping and book visits' })}>
                  Verify now
                </button>
              </>
            )}
          </div>
          <p className="mt-1.5 text-xs text-dust-dim">Your phone is verified by OTP and cannot be edited here — login with a different number to switch.</p>
        </div>
        <Button type="submit" full size="lg" disabled={!dirty} loading={saving}>
          Save changes
        </Button>
      </form>

      <div className="mt-6 space-y-3">
        <Button variant="secondary" full size="lg" onClick={() => void doLogout()} leftIcon={<LogOut size={16} aria-hidden />}>
          Log out
        </Button>
        <Button variant="danger" full size="lg" onClick={() => setConfirmDelete(true)} leftIcon={<Trash2 size={16} aria-hidden />}>
          Delete my account
        </Button>
      </div>

      <ConfirmModal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={doDelete}
        loading={deleting}
        danger
        title="Delete your account?"
        confirmLabel="Yes, delete"
        body={
          <>
            <p>This removes your profile, saved homes and saved searches for good. Messages you sent to agencies stay in their inbox but your name is replaced with “Deleted user”.</p>
            <p className="mt-2 font-bold">This cannot be undone.</p>
          </>
        }
      />
    </div>
  );
}
