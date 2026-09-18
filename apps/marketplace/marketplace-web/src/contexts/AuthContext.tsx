/**
 * AuthContext — consumer session for marketplace-web.
 *
 * Access token lives in memory only (a ref, never storage). The httpOnly
 * `mp_refresh` cookie set by marketplace-authentication is the durable part:
 * on load we call POST /auth/refresh (credentials: include) to restore the
 * session, and the API client calls `refresh()` once on any 401 before retrying.
 *
 * AUTH DESIGN CHOICE (see README "Auth"):
 *   Phone OTP is the PRIMARY login. Google is offered as a secondary,
 *   convenience sign-in. Chat / ping / site-visit / save all require a profile
 *   with BOTH `name` and `phone` (marketplace-api rejects POST /me/threads
 *   otherwise, and the agency needs a number to call back).
 *
 *   The auth service only stores a phone that came through OTP, and the
 *   contract has no "link identity" endpoint — PATCH /auth/profile accepts
 *   only { name, email }. So when a Google-signed-in user has no phone, the
 *   modal shows a "Verify your phone" step that runs the same
 *   /auth/phone/start → /auth/phone/confirm flow. The tokens returned by
 *   confirm replace the current session, i.e. the user continues as the
 *   phone-keyed account. Account linking (merging the Google identity into the
 *   phone account by phone match) is a server-side concern; if/when the auth
 *   service adds it, nothing here has to change — confirm would simply return
 *   the same userId.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { registerTokenProvider } from '@/services/api';
import { authService } from '@/services/auth';
import type { AuthUser, TokenResponse } from '@/types/api';

export type AuthStatus = 'loading' | 'anon' | 'authed';

export interface AuthGateOptions {
  /** Short line shown at the top of the modal, e.g. "Login to chat with Sharma Realty". */
  reason?: string;
}

export interface AuthModalState {
  open: boolean;
  reason?: string;
}

export interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  isAuthed: boolean;
  /** name + phone present — required for chat/ping/visit/save */
  profileComplete: boolean;
  getAccessToken: () => string | null;
  /** Store tokens+user after OTP confirm or Google exchange. */
  setSession: (tokens: TokenResponse) => void;
  refreshSession: () => Promise<string | null>;
  logout: () => Promise<void>;
  updateProfile: (patch: { name?: string; email?: string }) => Promise<AuthUser>;
  deleteAccount: () => Promise<void>;
  /**
   * Gate an action behind login + complete profile. Opens the auth modal when
   * needed and resolves true once the user can proceed, false if they closed it.
   */
  requireAuth: (opts?: AuthGateOptions) => Promise<boolean>;
  modal: AuthModalState;
  openModal: (opts?: AuthGateOptions) => void;
  closeModal: () => void;
  /** Called by the modal when the gate is satisfied. */
  completeGate: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function isComplete(user: AuthUser | null): boolean {
  return !!user && !!user.name?.trim() && !!user.phone?.trim();
}

export function AuthProvider({ children, skipBootstrap = false }: { children: ReactNode; skipBootstrap?: boolean }) {
  const tokenRef = useRef<string | null>(null);
  const refreshInFlight = useRef<Promise<string | null> | null>(null);
  const gateResolver = useRef<((ok: boolean) => void) | null>(null);

  const [status, setStatus] = useState<AuthStatus>(skipBootstrap ? 'anon' : 'loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [modal, setModal] = useState<AuthModalState>({ open: false });

  const getAccessToken = useCallback(() => tokenRef.current, []);

  const clearSession = useCallback(() => {
    tokenRef.current = null;
    setUser(null);
    setStatus('anon');
  }, []);

  const refreshSession = useCallback((): Promise<string | null> => {
    if (refreshInFlight.current) return refreshInFlight.current;
    const p = (async () => {
      try {
        const r = await authService.refresh();
        // The ID token is what we present as the bearer: unlike the access
        // token it carries phone_number / email / name, which marketplace-api
        // needs to build the buyer profile (and it verifies either token_use).
        tokenRef.current = r.idToken || r.accessToken;
        return tokenRef.current;
      } catch {
        tokenRef.current = null;
        return null;
      } finally {
        refreshInFlight.current = null;
      }
    })();
    refreshInFlight.current = p;
    return p;
  }, []);

  // Register with the fetch wrapper so every authed call gets the bearer + refresh-on-401.
  useEffect(() => {
    registerTokenProvider({
      getAccessToken,
      refresh: refreshSession,
      onSessionLost: clearSession,
    });
    return () => registerTokenProvider(null);
  }, [getAccessToken, refreshSession, clearSession]);

  // Bootstrap: refresh cookie → token → /auth/me.
  useEffect(() => {
    if (skipBootstrap) return;
    let cancelled = false;
    (async () => {
      const token = await refreshSession();
      if (cancelled) return;
      if (!token) {
        setStatus('anon');
        return;
      }
      try {
        const { user: me } = await authService.me();
        if (cancelled) return;
        setUser(me);
        setStatus('authed');
      } catch {
        if (!cancelled) clearSession();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [skipBootstrap, refreshSession, clearSession]);

  const setSession = useCallback((tokens: TokenResponse) => {
    tokenRef.current = tokens.idToken || tokens.accessToken;
    setUser(tokens.user);
    setStatus('authed');
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      /* cookie may already be gone — local state is what matters */
    }
    clearSession();
  }, [clearSession]);

  const updateProfile = useCallback(async (patch: { name?: string; email?: string }) => {
    const { user: updated } = await authService.updateProfile(patch);
    setUser(updated);
    return updated;
  }, []);

  const deleteAccount = useCallback(async () => {
    await authService.deleteAccount();
    clearSession();
  }, [clearSession]);

  const openModal = useCallback((opts?: AuthGateOptions) => setModal({ open: true, reason: opts?.reason }), []);

  const closeModal = useCallback(() => {
    setModal({ open: false });
    if (gateResolver.current) {
      gateResolver.current(false);
      gateResolver.current = null;
    }
  }, []);

  const completeGate = useCallback(() => {
    setModal({ open: false });
    if (gateResolver.current) {
      gateResolver.current(true);
      gateResolver.current = null;
    }
  }, []);

  const requireAuth = useCallback(
    (opts?: AuthGateOptions): Promise<boolean> => {
      if (status === 'authed' && isComplete(user)) return Promise.resolve(true);
      return new Promise<boolean>((resolve) => {
        if (gateResolver.current) gateResolver.current(false);
        gateResolver.current = resolve;
        setModal({ open: true, reason: opts?.reason });
      });
    },
    [status, user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      isAuthed: status === 'authed',
      profileComplete: isComplete(user),
      getAccessToken,
      setSession,
      refreshSession,
      logout,
      updateProfile,
      deleteAccount,
      requireAuth,
      modal,
      openModal,
      closeModal,
      completeGate,
    }),
    [status, user, getAccessToken, setSession, refreshSession, logout, updateProfile, deleteAccount, requireAuth, modal, openModal, closeModal, completeGate],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
