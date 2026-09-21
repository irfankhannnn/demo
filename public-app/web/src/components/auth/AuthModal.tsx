/**
 * Auth modal sheet.
 *
 * Steps:
 *   phone  → OTP (6 digits, resend timer) → name (if isNew or no name) → done
 *   Google (secondary) → redirect → /auth/callback → back here if profile incomplete
 *   verify-phone: shown to a logged-in user whose profile lacks a phone
 *                 (Google sign-in). Uses the same OTP endpoints; see the
 *                 AUTH DESIGN CHOICE note in AuthContext.tsx.
 */
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { ArrowLeft, Phone, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { errorMessage, isApiError } from '@/services/api';
import { authService, storeGooglePkce } from '@/services/auth';
import { googleRedirectUri } from '@/config/env';
import { normalisePhone } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Sheet } from '../ui/Sheet';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

type Step = 'phone' | 'otp' | 'name';

const OTP_LEN = 6;
const RESEND_SECONDS = 30;

export function AuthModal() {
  const { modal, closeModal, completeGate, setSession, user, isAuthed, profileComplete, updateProfile } = useAuth();
  const toast = useToast();
  const location = useLocation();

  const [step, setStep] = useState<Step>('phone');
  const [phoneText, setPhoneText] = useState('');
  const [phone, setPhone] = useState('');
  const [session, setSession_] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const otpRef = useRef<HTMLInputElement>(null);

  // Decide the first step whenever the modal opens.
  useEffect(() => {
    if (!modal.open) return;
    setError(null);
    setOtp('');
    if (isAuthed && !user?.phone) {
      setStep('phone'); // verify-phone path for Google users
    } else if (isAuthed && !user?.name) {
      setName('');
      setStep('name');
    } else if (isAuthed && profileComplete) {
      completeGate();
    } else {
      setStep('phone');
    }
  }, [modal.open, isAuthed, user?.phone, user?.name, profileComplete, completeGate]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = window.setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [resendIn]);

  useEffect(() => {
    if (step === 'otp') window.setTimeout(() => otpRef.current?.focus(), 60);
  }, [step]);

  const verifyingPhoneOnly = isAuthed && !user?.phone;

  const title = useMemo(() => {
    if (step === 'otp') return 'Enter the OTP';
    if (step === 'name') return 'Aapka naam?';
    return verifyingPhoneOnly ? 'Verify your phone' : 'Login / Sign up';
  }, [step, verifyingPhoneOnly]);

  const startOtp = async (e?: FormEvent) => {
    e?.preventDefault();
    const normalised = normalisePhone(phoneText);
    if (!normalised) {
      setError('Enter a 10-digit Indian mobile number.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await authService.phoneStart(normalised);
      setPhone(r.phone);
      setSession_(r.session);
      setStep('otp');
      setResendIn(RESEND_SECONDS);
    } catch (err) {
      setError(errorMessage(err, 'Could not send the OTP. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  const confirmOtp = async (e?: FormEvent) => {
    e?.preventDefault();
    if (otp.length !== OTP_LEN) {
      setError('OTP is 6 digits.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const tokens = await authService.phoneConfirm(phone, otp, session);
      // For a Google user verifying their phone this replaces the session with
      // the phone-keyed account (see AuthContext.tsx — linking is server-side).
      setSession(tokens);
      if (tokens.user.isNew || !tokens.user.name?.trim()) {
        setName(tokens.user.name ?? '');
        setStep('name');
      } else {
        toast.success(`Welcome back, ${tokens.user.name.split(' ')[0]}`);
        completeGate();
      }
    } catch (err) {
      // A wrong code consumes the Cognito session; the 400 carries the next one.
      const next = isApiError(err) ? err.body?.session : undefined;
      if (typeof next === 'string' && next) setSession_(next);
      setError(errorMessage(err, 'That OTP did not match. Try again.'));
      setOtp('');
      otpRef.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  const saveName = async (e?: FormEvent) => {
    e?.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError('Please enter your name — the agency needs to know who to call back.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updateProfile({ name: trimmed });
      toast.success(`Namaste, ${trimmed.split(' ')[0]}! You are all set.`);
      completeGate();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    setError(null);
    try {
      const redirectUri = googleRedirectUri();
      const r = await authService.googleUrl(redirectUri);
      storeGooglePkce({ state: r.state, codeVerifier: r.codeVerifier, redirectUri, returnTo: location.pathname + location.search });
      window.location.assign(r.url);
    } catch (err) {
      setError(errorMessage(err, 'Google sign-in is not available right now.'));
      setBusy(false);
    }
  };

  return (
    <Sheet open={modal.open} onClose={closeModal} title={title} size="sm" description={step === 'phone' ? modal.reason : undefined}>
      {step === 'phone' && (
        <form onSubmit={startOtp} className="space-y-4">
          {verifyingPhoneOnly && (
            <p className="rounded-xl bg-marigold-soft px-3 py-2 text-[13px] leading-snug text-ink/85">
              Agencies call back on a verified number, so we need your phone before you can chat, ping or book a visit.
            </p>
          )}
          <Input
            label="Mobile number"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            placeholder="98765 43210"
            leftIcon={<span className="text-sm font-bold text-ink">+91</span>}
            value={phoneText}
            onChange={(e) => setPhoneText(e.target.value)}
            error={error ?? undefined}
            autoFocus
          />
          <Button type="submit" full size="lg" loading={busy} leftIcon={<Phone size={16} aria-hidden />}>
            Send OTP
          </Button>
          {!verifyingPhoneOnly && (
            <>
              <div className="flex items-center gap-3 text-xs text-dust-dim">
                <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
              </div>
              <Button type="button" variant="outline" full size="lg" onClick={google} disabled={busy} leftIcon={<GoogleG />}>
                Continue with Google
              </Button>
            </>
          )}
          <p className="text-center text-[11px] leading-relaxed text-dust-dim">
            No password, no spam. We only share your number with an agency when you contact them.
          </p>
        </form>
      )}

      {step === 'otp' && (
        <form onSubmit={confirmOtp} className="space-y-4">
          <button type="button" onClick={() => setStep('phone')} className="inline-flex items-center gap-1 text-xs font-bold text-dust-dim hover:text-ink">
            <ArrowLeft size={14} aria-hidden /> {phone}
          </button>
          <div>
            <label htmlFor="otp" className="mb-1.5 block text-[13px] font-bold">
              6-digit OTP sent by SMS
            </label>
            <input
              id="otp"
              ref={otpRef}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={OTP_LEN}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, OTP_LEN))}
              className={cn(
                'h-14 w-full rounded-xl border border-line bg-white/70 text-center font-display text-2xl font-extrabold tracking-[0.5em] text-ink focus:border-ink focus:outline-none focus:ring-2 focus:ring-marigold/40',
                error && 'border-danger',
              )}
              aria-invalid={!!error || undefined}
            />
            {error && <p className="mt-1.5 text-xs font-semibold text-danger">{error}</p>}
          </div>
          <Button type="submit" full size="lg" loading={busy} leftIcon={<ShieldCheck size={16} aria-hidden />}>
            Verify
          </Button>
          <p className="text-center text-xs text-dust-dim">
            {resendIn > 0 ? (
              <>Resend in {resendIn}s</>
            ) : (
              <button type="button" className="font-bold text-marigold-deep hover:underline" onClick={() => void startOtp()} disabled={busy}>
                Resend OTP
              </button>
            )}
          </p>
        </form>
      )}

      {step === 'name' && (
        <form onSubmit={saveName} className="space-y-4">
          <p className="text-sm text-dust-dim">So the agency knows who is asking. First name is fine.</p>
          <Input label="Your name" autoComplete="name" placeholder="Asha Sharma" value={name} onChange={(e) => setName(e.target.value)} error={error ?? undefined} autoFocus />
          <Button type="submit" full size="lg" loading={busy}>
            Done
          </Button>
        </form>
      )}
    </Sheet>
  );
}

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.6 30.1 0 24 0 14.6 0 6.5 5.4 2.6 13.3l7.8 6C12.3 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17z" />
      <path fill="#FBBC05" d="M10.4 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.8-6A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.7l7.8-6z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.7-4.1-13.6-9.9l-7.8 6C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}
