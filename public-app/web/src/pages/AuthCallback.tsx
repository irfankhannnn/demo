/**
 * /auth/callback?code=&state= — Google OAuth return. Validates `state`
 * against the PKCE record in sessionStorage, exchanges the code, then goes
 * back to where the user started. If the Google account has no phone, the
 * gate will ask for OTP verification on the next protected action.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { errorMessage } from '@/services/api';
import { authService, clearGooglePkce, readGooglePkce } from '@/services/auth';
import { usePageMeta } from '@/lib/seo';
import { Button } from '@/components/ui/Button';
import { EmptyState, PageSpinner } from '@/components/ui/States';

export default function AuthCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { setSession, openModal } = useAuth();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);
  usePageMeta({ title: 'Signing you in', noindex: true });

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const code = params.get('code');
    const state = params.get('state');
    const oauthError = params.get('error');
    const pkce = readGooglePkce();

    if (oauthError) {
      setError(oauthError === 'access_denied' ? 'Google sign-in was cancelled.' : `Google returned: ${oauthError}`);
      return;
    }
    if (!code || !state || !pkce || pkce.state !== state) {
      setError('This sign-in link is stale or was opened in a different browser. Try again.');
      clearGooglePkce();
      return;
    }
    (async () => {
      try {
        const tokens = await authService.exchangeCode(code, pkce.codeVerifier, pkce.redirectUri);
        clearGooglePkce();
        setSession(tokens);
        toast.success(tokens.user.name ? `Welcome, ${tokens.user.name.split(' ')[0]}` : 'Signed in with Google');
        navigate(pkce.returnTo && pkce.returnTo.startsWith('/') ? pkce.returnTo : '/', { replace: true });
        // A Google account has no verified phone yet — nudge now rather than at
        // the first chat attempt. See AuthContext.tsx for the design note.
        if (!tokens.user.phone) window.setTimeout(() => openModal({ reason: 'One more step: verify your phone so agencies can call you back' }), 400);
      } catch (e) {
        clearGooglePkce();
        setError(errorMessage(e, 'Could not complete Google sign-in.'));
      }
    })();
  }, [params, navigate, setSession, openModal, toast]);

  if (error) {
    return (
      <div className="container-x py-16">
        <EmptyState
          title="Sign-in did not go through"
          body={error}
          action={
            <Button
              onClick={() => {
                navigate('/', { replace: true });
                openModal();
              }}
            >
              Try again
            </Button>
          }
        />
      </div>
    );
  }
  return <PageSpinner />;
}
