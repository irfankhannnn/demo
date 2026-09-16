/**
 * Shared phone renderer.
 *
 *   <PhoneNumber value={phone} masked={record.phoneMasked} entityType="lead" entityId={id} showCallButton />
 *
 * Rules (APPROVAL-PLAN.md 3.5 / 3.6):
 *  - If the signed-in role cannot view full numbers (not ADMIN/FOUNDER/OWNER)
 *    OR the record came back with `phoneMasked: true`, the value is shown as
 *    text and NEVER as a `tel:` link. Those users get a "Call" button that
 *    goes through Exotel click-to-call — the server dials both legs, so the
 *    number never needs to be in the page.
 *  - Admins see the plain, copyable number (a `tel:` link when `linkWhenVisible`
 *    is set) and, when requested, the same Call button.
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type MouseEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, PhoneCall } from 'lucide-react';
import { clickToCallApi, type ClickToCallEntityType } from '../services/clickToCallApi';
import { canViewFullPhone, isMaskedPhoneValue } from '../utils/phoneMasking';

// ---------------------------------------------------------------------------
// Role subscription
// ---------------------------------------------------------------------------

function subscribeAuth(onChange: () => void): () => void {
  window.addEventListener('auth-changed', onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener('auth-changed', onChange);
    window.removeEventListener('storage', onChange);
  };
}

/** True when the current user's role receives unmasked phone numbers. Re-renders on login/logout. */
export function useCanViewFullPhone(): boolean {
  return useSyncExternalStore(subscribeAuth, canViewFullPhone, () => false);
}

/**
 * Map a CRM related-entity type (meetings, enquiries) to a click-to-call
 * entity type, or undefined when the server cannot resolve a phone for it
 * (`enquiry`, `b2b_lead`, ...). Callers then render the number without a
 * Call button. `tenant` is the UI name for the `customer` entity.
 */
const CLICK_TO_CALL_ENTITY_TYPES: readonly ClickToCallEntityType[] = ['lead', 'buyer', 'owner', 'customer', 'contact', 'property'];

export function clickToCallEntityFor(relatedEntityType?: string | null): ClickToCallEntityType | undefined {
  if (!relatedEntityType) return undefined;
  const normalized = relatedEntityType === 'tenant' ? 'customer' : relatedEntityType;
  return (CLICK_TO_CALL_ENTITY_TYPES as readonly string[]).includes(normalized)
    ? (normalized as ClickToCallEntityType)
    : undefined;
}

// ---------------------------------------------------------------------------
// "Not configured" is a deployment/tenant state, not per-record: once one
// call attempt answers 503, every Call button on the page disables itself.
// ---------------------------------------------------------------------------

let clickToCallDisabledReason: string | null = null;
const disabledListeners = new Set<() => void>();

function subscribeDisabled(onChange: () => void): () => void {
  disabledListeners.add(onChange);
  return () => disabledListeners.delete(onChange);
}

function setClickToCallDisabled(reason: string | null) {
  clickToCallDisabledReason = reason;
  disabledListeners.forEach((fn) => fn());
}

function useClickToCallDisabledReason(): string | null {
  return useSyncExternalStore(subscribeDisabled, () => clickToCallDisabledReason, () => null);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type CallState =
  | { kind: 'idle' }
  | { kind: 'connecting' }
  | { kind: 'connected' }
  | { kind: 'caller_phone_missing'; message: string }
  | { kind: 'error'; message: string };

export interface PhoneNumberProps {
  value?: string | null;
  /** `phoneMasked` flag from the record (set by the server for masked roles). */
  masked?: boolean;
  entityType?: ClickToCallEntityType;
  entityId?: string;
  /** Render the Exotel "Call" button (needs entityType + entityId). */
  showCallButton?: boolean;
  /** For admins with a full number: render the value as a `tel:` link. */
  linkWhenVisible?: boolean;
  /** Icon-only call button, for dense rows. */
  compact?: boolean;
  /** Rendered when there is no value at all. */
  fallback?: ReactNode;
  /** Classes for the number text itself. */
  className?: string;
  /** Classes for the outer wrapper. */
  wrapperClassName?: string;
  /** Classes for the call button (overrides the default look). */
  callButtonClassName?: string;
  callLabel?: string;
}

const CONNECTING_TEXT = 'Connecting… you will receive a call on your phone first';

export function PhoneNumber({
  value,
  masked,
  entityType,
  entityId,
  showCallButton = false,
  linkWhenVisible = false,
  compact = false,
  fallback = null,
  className = '',
  wrapperClassName = '',
  callButtonClassName,
  callLabel = 'Call',
}: PhoneNumberProps) {
  const roleCanView = useCanViewFullPhone();
  const disabledReason = useClickToCallDisabledReason();
  const [state, setState] = useState<CallState>({ kind: 'idle' });
  const resetTimer = useRef<number | null>(null);

  useEffect(() => () => {
    if (resetTimer.current) window.clearTimeout(resetTimer.current);
  }, []);

  const text = (value ?? '').toString().trim();
  const isHidden = !roleCanView || masked === true || isMaskedPhoneValue(text);
  const canCall = showCallButton && !!entityType && !!entityId;

  const scheduleReset = useCallback((ms: number) => {
    if (resetTimer.current) window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => setState({ kind: 'idle' }), ms);
  }, []);

  const handleCall = useCallback(async (e: MouseEvent<HTMLButtonElement>) => {
    // Rows in list pages navigate on click; a call must not also open the record.
    e.stopPropagation();
    e.preventDefault();
    if (!entityType || !entityId) return;
    setState({ kind: 'connecting' });
    const result = await clickToCallApi.connect({ entityType, entityId });
    if (result.ok) {
      setState({ kind: 'connected' });
      scheduleReset(8000);
      return;
    }
    if (result.code === 'caller_phone_missing') {
      setState({ kind: 'caller_phone_missing', message: result.message });
      return;
    }
    if (result.code === 'click_to_call_not_configured' || result.code === 'unavailable') {
      setClickToCallDisabled(result.message);
      setState({ kind: 'idle' });
      return;
    }
    setState({ kind: 'error', message: result.message });
    scheduleReset(8000);
  }, [entityType, entityId, scheduleReset]);

  if (!text && !canCall) return <>{fallback}</>;

  const numberNode = !text ? (
    fallback
  ) : isHidden || !linkWhenVisible ? (
    <span className={`select-all ${className}`} title={isHidden ? 'Number hidden for your role' : undefined}>
      {text}
    </span>
  ) : (
    <a href={`tel:${text}`} className={`select-all ${className}`} onClick={(e) => e.stopPropagation()}>
      {text}
    </a>
  );

  if (!canCall) return <>{numberNode}</>;

  const busy = state.kind === 'connecting';
  const disabled = busy || !!disabledReason;
  const buttonClass =
    callButtonClassName ??
    (compact
      ? 'inline-flex items-center justify-center h-7 w-7 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed'
      : 'inline-flex items-center gap-1 px-2 py-1 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-medium hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed');

  return (
    <span className={`inline-flex items-center gap-2 flex-wrap ${wrapperClassName}`}>
      {numberNode}
      <button
        type="button"
        onClick={handleCall}
        disabled={disabled}
        className={buttonClass}
        title={disabledReason ?? (busy ? CONNECTING_TEXT : `${callLabel} via Exotel`)}
        aria-label={callLabel}
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PhoneCall className="h-3.5 w-3.5" />}
        {!compact && <span>{busy ? 'Connecting…' : callLabel}</span>}
      </button>
      {state.kind === 'connecting' && (
        <span className="text-xs text-slate-500">{CONNECTING_TEXT}</span>
      )}
      {state.kind === 'connected' && (
        <span className="text-xs text-emerald-700">Call placed. Pick up your phone to be connected.</span>
      )}
      {state.kind === 'caller_phone_missing' && (
        <span className="text-xs text-amber-700">
          {state.message}{' '}
          <Link to="/profile" className="underline font-medium" onClick={(e) => e.stopPropagation()}>
            Add it in Profile
          </Link>
        </span>
      )}
      {state.kind === 'error' && (
        <span className="text-xs text-red-600">{state.message}</span>
      )}
    </span>
  );
}

export default PhoneNumber;
