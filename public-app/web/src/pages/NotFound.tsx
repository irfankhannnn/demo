import { usePageMeta } from '@/lib/seo';
import { LinkButton } from '@/components/ui/Button';

export default function NotFound() {
  usePageMeta({ title: 'Page not found', noindex: true });
  return (
    <div className="container-x flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
      <p className="font-display text-7xl font-extrabold text-ink/10">404</p>
      <h1 className="mt-2 font-display text-2xl font-extrabold">Yeh page toh hai hi nahi.</h1>
      <p className="mt-2 max-w-sm text-sm text-dust-dim">The link may be old, or the listing moved. Search is the fastest way back.</p>
      <div className="mt-6 flex gap-2">
        <LinkButton to="/">Go home</LinkButton>
        <LinkButton to="/search" variant="outline">
          Search homes
        </LinkButton>
      </div>
    </div>
  );
}
