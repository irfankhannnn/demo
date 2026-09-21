/**
 * Wraps /me/* pages: waits for the bootstrap refresh, then either renders
 * the page or a friendly login prompt (never a redirect — keeps the URL so
 * a deep link into an enquiry survives login).
 */
import type { ReactNode } from 'react';
import { LockKeyhole } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePageMeta } from '@/lib/seo';
import { Button } from '@/components/ui/Button';
import { EmptyState, PageSpinner } from '@/components/ui/States';

export function RequireLogin({ children, title, reason }: { children: ReactNode; title: string; reason: string }) {
  const { status, openModal } = useAuth();
  usePageMeta({ title, noindex: true });
  if (status === 'loading') return <PageSpinner />;
  if (status === 'anon') {
    return (
      <div className="container-x py-16">
        <EmptyState
          icon={<LockKeyhole size={26} aria-hidden />}
          title="Login first"
          body={reason}
          action={
            <Button onClick={() => openModal({ reason })} size="lg">
              Login with phone
            </Button>
          }
        />
      </div>
    );
  }
  return <>{children}</>;
}

export function MePageHeader({ eyebrow, title, count, action }: { eyebrow: string; title: string; count?: number; action?: ReactNode }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-3">
      <div>
        <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-marigold-deep">{eyebrow}</p>
        <h1 className="mt-1 font-display text-2xl font-extrabold sm:text-3xl">
          {title}
          {count != null && <span className="ml-2 align-middle text-base font-bold text-dust-dim tabular">({count})</span>}
        </h1>
      </div>
      {action}
    </div>
  );
}
