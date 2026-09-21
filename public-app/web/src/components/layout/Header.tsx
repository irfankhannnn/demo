import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Heart, MapPin, MessageCircle, Search, UserRound, ChevronDown, Menu, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/cn';
import { useAuth } from '@/contexts/AuthContext';
import { useCity } from '@/contexts/CityContext';
import { marketplace, qk } from '@/services/marketplace';
import { Wordmark } from './Logo';
import { CityPicker } from '../search/CityPicker';
import { Button } from '../ui/Button';

function useUnreadCount(enabled: boolean) {
  const { data } = useQuery({
    // Its own key under the 'threads' prefix: the Enquiries page caches an
    // infinite query ({ pages }) at qk.threads, and sharing the key hands this
    // hook that shape. Invalidating qk.threads still refreshes both.
    queryKey: [...qk.threads, 'unread'],
    queryFn: () => marketplace.threads(),
    enabled,
    staleTime: 30_000,
    refetchInterval: enabled ? 60_000 : false,
  });
  return data?.items?.reduce((n, t) => n + (t.unreadBuyer > 0 ? 1 : 0), 0) ?? 0;
}

export function Header() {
  const { isAuthed, user, openModal } = useAuth();
  const { city } = useCity();
  const [cityOpen, setCityOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const unread = useUnreadCount(isAuthed);

  useEffect(() => setMenuOpen(false), [location.pathname]);

  const onHome = location.pathname === '/';

  const navItem = (to: string, label: string, Icon: typeof Heart, badge?: number) => (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'relative inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-[13px] font-bold transition-colors',
          isActive ? 'bg-ink text-paper' : 'text-ink hover:bg-ink/5',
        )
      }
    >
      <Icon size={16} aria-hidden />
      {label}
      {!!badge && (
        <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-pill bg-gulal px-1.5 text-[11px] font-extrabold text-paper" aria-label={`${badge} unread`}>
          {badge}
        </span>
      )}
    </NavLink>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-paper/85 backdrop-blur-md">
      <div className="container-x flex h-14 items-center gap-2 sm:h-16 sm:gap-3">
        <Wordmark compact />

        <button
          type="button"
          onClick={() => setCityOpen(true)}
          className="ml-1 inline-flex h-9 max-w-[42vw] items-center gap-1 rounded-pill border border-line bg-paper-2/60 px-3 text-[13px] font-bold text-ink hover:border-ink/40 sm:max-w-none"
          aria-label={`City: ${city || 'choose'}`}
        >
          <MapPin size={14} className="shrink-0 text-marigold" aria-hidden />
          <span className="truncate">{city || 'Choose city'}</span>
          <ChevronDown size={14} className="shrink-0 text-dust-dim" aria-hidden />
        </button>

        <div className="flex-1" />

        {!onHome && (
          <Link
            to="/search"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-ink hover:bg-ink/5 sm:w-auto sm:gap-1.5 sm:px-3 sm:text-[13px] sm:font-bold"
            aria-label="Search"
          >
            <Search size={18} aria-hidden />
            <span className="hidden sm:inline">Search</span>
          </Link>
        )}

        <nav className="hidden items-center gap-1 md:flex" aria-label="Account">
          {navItem('/me/saved', 'Saved', Heart)}
          {navItem('/me/enquiries', 'Enquiries', MessageCircle, unread)}
          {isAuthed ? (
            <NavLink
              to="/me/profile"
              className={({ isActive }) =>
                cn('inline-flex h-10 items-center gap-2 rounded-xl px-2.5 text-[13px] font-bold', isActive ? 'bg-ink text-paper' : 'hover:bg-ink/5')
              }
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-marigold text-[12px] font-extrabold text-ink">
                {(user?.name?.trim()?.[0] ?? 'U').toUpperCase()}
              </span>
              <span className="max-w-[9rem] truncate">{user?.name?.split(' ')[0] || 'Profile'}</span>
            </NavLink>
          ) : (
            <Button size="sm" className="ml-1" onClick={() => openModal()}>
              Login
            </Button>
          )}
        </nav>

        <button
          type="button"
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl text-ink hover:bg-ink/5 md:hidden"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          {menuOpen ? <X size={20} aria-hidden /> : <Menu size={20} aria-hidden />}
          {!!unread && !menuOpen && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-gulal" aria-hidden />}
        </button>
      </div>

      {menuOpen && (
        <nav className="container-x flex flex-col gap-1 border-t border-line py-3 md:hidden animate-rise" aria-label="Account">
          {navItem('/me/saved', 'Saved homes', Heart)}
          {navItem('/me/enquiries', 'Enquiries', MessageCircle, unread)}
          {navItem('/me/searches', 'Saved searches', Search)}
          {isAuthed ? (
            navItem('/me/profile', user?.name || 'Profile', UserRound)
          ) : (
            <Button
              full
              onClick={() => {
                setMenuOpen(false);
                openModal();
              }}
            >
              Login / Sign up
            </Button>
          )}
        </nav>
      )}

      <CityPicker
        open={cityOpen}
        onClose={() => setCityOpen(false)}
        onPick={(name) => {
          setCityOpen(false);
          if (location.pathname === '/search') {
            const p = new URLSearchParams(location.search);
            p.set('city', name);
            navigate({ pathname: '/search', search: p.toString() });
          }
        }}
      />
    </header>
  );
}
