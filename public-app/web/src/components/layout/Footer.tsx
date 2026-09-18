import { Link } from 'react-router-dom';
import { LogoMark } from './Logo';

export function Footer() {
  return (
    <footer className="mt-16 bg-ink text-paper">
      <div className="container-x grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <div className="flex items-center gap-2 text-paper">
            <LogoMark size={30} />
            <span className="font-display text-base font-extrabold">RealEstateFlow Homes</span>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-dust">
            Ghar dhoondna, minus the 40 tabs. Describe what you want in plain words; we match it against every listing from partner brokers and tell you why each one fits.
          </p>
        </div>
        <div>
          <h3 className="font-display text-[11px] font-extrabold uppercase tracking-[0.18em] text-marigold">Browse</h3>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li><Link className="hover:text-marigold" to="/search?mode=sale">Buy</Link></li>
            <li><Link className="hover:text-marigold" to="/search?mode=rent">Rent</Link></li>
            <li><Link className="hover:text-marigold" to="/search?sort=newest">New listings</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="font-display text-[11px] font-extrabold uppercase tracking-[0.18em] text-marigold">You</h3>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li><Link className="hover:text-marigold" to="/me/saved">Saved homes</Link></li>
            <li><Link className="hover:text-marigold" to="/me/searches">Saved searches</Link></li>
            <li><Link className="hover:text-marigold" to="/me/enquiries">Enquiries</Link></li>
            <li><Link className="hover:text-marigold" to="/me/profile">Profile</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-x flex flex-col gap-2 py-5 text-xs text-dust sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} RealEstateFlow · Listings are posted by partner agencies; verify details before you pay anything.</p>
          <p>Broker? <a className="font-bold text-marigold hover:underline" href="https://realestateflow.in" rel="noreferrer">List with RealEstateFlow CRM</a></p>
        </div>
      </div>
    </footer>
  );
}
