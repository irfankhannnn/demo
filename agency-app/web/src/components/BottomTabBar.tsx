import { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Building2, Contact, MoreHorizontal } from 'lucide-react';
import { isNativeApp } from '../lib/platform';
import { tapFeedback } from '../lib/nativeInit';

interface Tab {
  to: string;
  label: string;
  Icon: typeof LayoutDashboard;
  /** Extra path prefixes that should also light this tab up. */
  matches?: string[];
}

const TABS: Tab[] = [
  { to: '/crm', label: 'Home', Icon: LayoutDashboard },
  { to: '/crm/leads', label: 'Leads', Icon: Users, matches: ['/crm/enquiries', '/crm/b2b-leads', '/crm/marketplace'] },
  { to: '/crm/properties', label: 'Properties', Icon: Building2, matches: ['/crm/rented-properties'] },
  { to: '/crm/contacts', label: 'Contacts', Icon: Contact, matches: ['/crm/owners', '/crm/tenants', '/crm/buyers', '/crm/customers'] },
  { to: '/profile', label: 'More', Icon: MoreHorizontal, matches: ['/crm/settings', '/crm/calendar', '/crm/khata', '/crm/analytics', '/admin'] },
];

/**
 * Route prefixes with no tab bar: unauthenticated screens, onboarding, and
 * public pages. Showing navigation to someone who cannot use it is confusing,
 * and it would sit on top of the login form.
 */
const HIDDEN_PREFIXES = [
  '/login',
  '/phone-login',
  '/signup',
  '/auth/callback',
  '/onboarding',
  '/legal',
  '/grievance',
  '/nps',
  '/member/no-access',
];

/**
 * Bottom tab navigation for phone-sized surfaces — the native app and mobile web.
 *
 * The app previously had no navigation shell of any kind — no sidebar, drawer,
 * hamburger or tab bar. Getting from Leads to Properties meant backing all the
 * way out to the dashboard and picking a card. That hub-and-spoke pattern reads
 * as a website rather than an app, which is exactly what Apple's guideline 4.2
 * rejects, and it is poor mobile UX regardless.
 *
 * Rendered globally rather than as a layout route: App.tsx is a flat list of 55
 * routes with no <Outlet>, so restructuring it into nested layouts would be a
 * far larger and riskier change than this needs to be.
 *
 * Mobile web gets the same bar. The problem it solves is not specific to the
 * Capacitor build — a phone browser has the identical 55 flat routes and the
 * identical lack of any way to move between them. Gating on `isNativeApp()`
 * left the one surface most brokers actually open with no navigation at all.
 *
 * Desktop web is untouched: on web the bar carries `md:hidden`, so it is a
 * pure CSS no-op at >= 768px where the existing in-page navigation lives. On
 * native it is always visible, including on tablets — unchanged from before.
 */
export default function BottomTabBar() {
  const location = useLocation();
  const native = isNativeApp();
  const hidden = HIDDEN_PREFIXES.some((p) => location.pathname.startsWith(p));

  /*
   * Content clearance is driven off this class rather than a blanket rule, so
   * the routes that hide the bar (login, onboarding, legal) do not get dead
   * space below the fold. The native build keeps its own `.native-app` rule.
   */
  useEffect(() => {
    if (hidden || native) return;
    document.body.classList.add('has-tab-bar');
    return () => document.body.classList.remove('has-tab-bar');
  }, [hidden, native]);

  if (hidden) return null;

  const isActive = (tab: Tab): boolean => {
    if (tab.to === '/crm') return location.pathname === '/crm';
    if (location.pathname.startsWith(tab.to)) return true;
    return (tab.matches ?? []).some((m) => location.pathname.startsWith(m));
  };

  return (
    <nav
      aria-label="Main"
      /* pb-[env(safe-area-inset-bottom)] keeps the row clear of the iOS home
         indicator and the Android gesture bar. */
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] ${
        native ? '' : 'md:hidden'
      }`}
    >
      <ul className="flex items-stretch justify-around">
        {TABS.map((tab) => {
          const active = isActive(tab);
          return (
            <li key={tab.to} className="flex-1">
              <NavLink
                to={tab.to}
                onClick={() => tapFeedback()}
                aria-current={active ? 'page' : undefined}
                /* min-h-[56px] clears the 44pt Apple HIG and 48dp Material
                   minimums with room for the label. */
                className={`flex min-h-[56px] flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[11px] font-medium transition-colors ${
                  active ? 'text-brand' : 'text-slate-500'
                }`}
              >
                <tab.Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 1.8} />
                <span className="leading-none">{tab.label}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
