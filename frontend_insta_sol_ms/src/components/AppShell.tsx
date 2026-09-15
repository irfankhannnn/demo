import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  AtSign,
  BarChart3,
  Film,
  MessageSquare,
  Menu,
  Users,
  X,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { CRM_URL } from '../api/client';
import { ErrorBoundary } from './ErrorBoundary';
import { cn } from '../lib/format';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** One line explaining what the screen is for, shown on wide sidebars. */
  hint: string;
}

const NAV: NavItem[] = [
  { to: '/', label: 'Overview', icon: BarChart3, hint: 'Counters and 30-day trend' },
  { to: '/threads', label: 'DM inbox', icon: MessageSquare, hint: 'Reply inside the 24h window' },
  { to: '/enquiries', label: 'Enquiries', icon: Users, hint: 'Scored leads from Instagram' },
  { to: '/reels', label: 'Reels', icon: Film, hint: 'Which reel actually earns' },
  { to: '/rules', label: 'Keyword rules', icon: Zap, hint: 'Comment to DM triggers' },
  { to: '/accounts', label: 'Instagram accounts', icon: AtSign, hint: 'Connect and sync health' },
];

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  // Navigating on a phone should close the drawer, not leave it covering the page.
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const backToCrm = CRM_URL || '/';

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-ink">
      {/* Top bar — the only chrome on phones, a slim header on desktop */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="flex h-14 items-center gap-3 px-3 sm:px-5">
          <button
            type="button"
            onClick={() => setMobileOpen((open) => !open)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            className="inline-flex h-touch w-touch items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 lg:hidden"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand text-sm font-bold text-white">
              IG
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight">
                Instagram Console
              </p>
              <p className="hidden text-xs leading-tight text-slate-500 sm:block">
                RealtyFlow
              </p>
            </div>
          </div>

          <div className="ml-auto">
            <a
              href={backToCrm}
              className="inline-flex min-h-touch items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-brand hover:text-brand"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back to CRM</span>
              <span className="sm:hidden">CRM</span>
            </a>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1600px]">
        {/* Desktop sidebar */}
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-60 shrink-0 border-r border-slate-200 bg-white px-3 py-4 lg:block">
          <SidebarNav />
        </aside>

        {/* Mobile drawer */}
        {mobileOpen ? (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setMobileOpen(false)}
              className="absolute inset-0 bg-ink/40"
            />
            <div className="absolute left-0 top-0 h-full w-72 max-w-[85%] overflow-y-auto bg-white px-3 py-4 shadow-xl">
              <div className="mb-3 flex items-center justify-between px-2">
                <span className="text-sm font-semibold">Menu</span>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close menu"
                  className="inline-flex h-touch w-touch items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <SidebarNav />
            </div>
          </div>
        ) : null}

        <main className="min-w-0 flex-1 px-3 py-5 sm:px-6 sm:py-6">
          {/* Keyed on the path so navigating away clears a crashed screen
              instead of stranding the user on the error card. */}
          <ErrorBoundary key={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

function SidebarNav() {
  return (
    <nav className="flex flex-col gap-0.5">
      {NAV.map(({ to, label, icon: Icon, hint }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            cn(
              'group flex min-h-touch items-center gap-3 rounded-lg px-3 py-2 text-sm transition',
              isActive
                ? 'bg-blue-50 font-semibold text-brand'
                : 'text-slate-600 hover:bg-slate-100 hover:text-ink',
            )
          }
        >
          {({ isActive }) => (
            <>
              <Icon
                className={cn(
                  'h-4 w-4 shrink-0',
                  isActive ? 'text-brand' : 'text-slate-400 group-hover:text-slate-600',
                )}
              />
              <span className="min-w-0">
                <span className="block truncate">{label}</span>
                <span className="block truncate text-xs font-normal text-slate-400">
                  {hint}
                </span>
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
