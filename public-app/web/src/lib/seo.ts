import { useEffect } from 'react';
import { env } from '@/config/env';

interface PageMeta {
  title?: string;
  description?: string;
  /** noindex for private pages (/me/*) */
  noindex?: boolean;
  canonical?: string;
}

function setMeta(selector: string, attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

/** Per-page <title> + meta. Restores the site default on unmount. */
export function usePageMeta({ title, description, noindex, canonical }: PageMeta) {
  useEffect(() => {
    const fullTitle = title ? `${title} · ${env.siteName}` : env.siteName;
    document.title = fullTitle;
    setMeta('meta[property="og:title"]', 'property', 'og:title', fullTitle);
    if (description) {
      setMeta('meta[name="description"]', 'name', 'description', description);
      setMeta('meta[property="og:description"]', 'property', 'og:description', description);
    }
    setMeta('meta[name="robots"]', 'name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow');

    let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (canonical) {
      if (!link) {
        link = document.createElement('link');
        link.rel = 'canonical';
        document.head.appendChild(link);
      }
      link.href = canonical;
    } else if (link) {
      link.remove();
    }

    return () => {
      document.title = env.siteName;
    };
  }, [title, description, noindex, canonical]);
}
