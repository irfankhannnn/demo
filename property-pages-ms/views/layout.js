/**
 * HTML shell and escaping primitives.
 *
 * Every page is assembled from template literals, so escaping is not optional
 * and not something to remember case by case — `esc()` is the only sanctioned
 * way to put a value into markup, and `attr()` the only way to put one into an
 * attribute. Property titles, descriptions and agency names are authored by
 * tenants in the CRM and rendered to anonymous visitors, so they are untrusted
 * input in exactly the way a comment box is.
 *
 * There is deliberately no CSS framework and no client-side rendering: the
 * whole point of server-rendering this is that a link pasted into WhatsApp or
 * an Instagram DM previews as the actual property, and that the page is
 * readable on a slow phone. A CDN round-trip for Tailwind would undo both.
 */

const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escape for HTML text and double-quoted attribute content. */
export function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

/** Alias that reads correctly at attribute call sites. */
export const attr = esc;

/**
 * Serialise data for an inline <script type="application/json">.
 *
 * `<` is escaped because a `</script>` inside any string value would otherwise
 * close the block early and hand the rest of the payload to the HTML parser —
 * the classic JSON-in-HTML injection. U+2028/U+2029 are escaped because they
 * are literal line terminators in JavaScript and break the parse.
 */
export function jsonScript(data) {
  // Built from char codes rather than written as literals: putting a raw
  // U+2028 in this file makes the file itself unparseable, which is the very
  // failure this function exists to prevent. Please don't "simplify" it back.
  const BS = String.fromCharCode(92);
  const LS = String.fromCharCode(0x2028);
  const PS = String.fromCharCode(0x2029);
  return JSON.stringify(data)
    .replace(/</g, BS + 'u003c')
    .replace(new RegExp(LS, 'g'), BS + 'u2028')
    .replace(new RegExp(PS, 'g'), BS + 'u2029');
}

/** ₹ formatting in the Indian lakh/crore convention, which is what buyers read. */
export function formatPrice(amount) {
  if (!amount || amount <= 0) return 'Price on request';
  if (amount >= 10000000) {
    const cr = amount / 10000000;
    return `₹${cr % 1 === 0 ? cr : cr.toFixed(2).replace(/\.?0+$/, '')} Cr`;
  }
  if (amount >= 100000) {
    const lakh = amount / 100000;
    return `₹${lakh % 1 === 0 ? lakh : lakh.toFixed(2).replace(/\.?0+$/, '')} L`;
  }
  return `₹${amount.toLocaleString('en-IN')}`;
}

export function formatArea(sqft) {
  if (!sqft || sqft <= 0) return null;
  return `${Number(sqft).toLocaleString('en-IN')} sq.ft.`;
}

/**
 * Brand tokens.
 *
 * Defaults are the RealEstateFlow "Bazaar Signal" palette; a tenant's own
 * primary colour overrides the accent. The value is validated as a six-digit
 * hex upstream in the CRM's serialiser, so it is safe to interpolate into CSS
 * here — an unvalidated value would be a CSS injection point.
 */
function brandCss(primary) {
  return `
:root{
  --brand:${primary};
  --ink:#1C1512;
  --muted:#6B5F57;
  --paper:#FBF2E4;
  --card:#FFFFFF;
  --line:#E8DCC8;
  --ok:#22C55E;
  --danger:#D14343;
  --radius:14px;
  --shadow:0 1px 2px rgba(28,21,18,.06),0 8px 24px rgba(28,21,18,.06);
}
*,*::before,*::after{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);
  font:16px/1.55 'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
  -webkit-font-smoothing:antialiased}
img{max-width:100%;display:block}
a{color:inherit}
.wrap{max-width:1080px;margin:0 auto;padding:0 16px}
.site-header{background:var(--card);border-bottom:1px solid var(--line);position:sticky;top:0;z-index:20}
.site-header .wrap{display:flex;align-items:center;gap:12px;padding-block:12px}
.logo{width:40px;height:40px;border-radius:10px;object-fit:cover;flex:none}
.logo-fallback{width:40px;height:40px;border-radius:10px;flex:none;background:var(--brand);
  color:#fff;display:grid;place-items:center;font-weight:800;font-size:17px}
.agency-name{font-weight:800;font-size:17px;letter-spacing:-.01em;margin:0;line-height:1.2}
.agency-meta{color:var(--muted);font-size:13px;margin:0}
.header-cta{margin-left:auto}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;
  min-height:48px;padding:0 20px;border-radius:999px;border:0;cursor:pointer;
  font:inherit;font-weight:700;text-decoration:none;transition:transform .06s ease,opacity .15s ease}
.btn:active{transform:translateY(1px)}
.btn-primary{background:var(--brand);color:#fff}
.btn-primary:disabled{opacity:.55;cursor:not-allowed}
.btn-ghost{background:transparent;color:var(--ink);border:1.5px solid var(--line)}
.btn-block{width:100%}
h1{font-size:clamp(22px,5vw,32px);line-height:1.2;letter-spacing:-.02em;margin:0 0 6px}
h2{font-size:19px;letter-spacing:-.01em;margin:0 0 12px}
.muted{color:var(--muted)}
.card{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);
  box-shadow:var(--shadow);overflow:hidden}
.section{margin:28px 0}
.price{font-size:clamp(21px,4.5vw,27px);font-weight:800;letter-spacing:-.02em}
.pill{display:inline-block;padding:5px 11px;border-radius:999px;background:var(--paper);
  border:1px solid var(--line);font-size:13px;font-weight:600}
.pill-live{background:#EAF9EF;border-color:#BFE9CD;color:#116B33}
.grid{display:grid;gap:16px;grid-template-columns:repeat(auto-fill,minmax(260px,1fr))}
.facts{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));
  list-style:none;padding:0;margin:0}
.facts li{background:var(--paper);border:1px solid var(--line);border-radius:10px;padding:10px 12px}
.facts .k{display:block;font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em}
.facts .v{font-weight:700}
.gallery{display:grid;gap:6px;grid-template-columns:2fr 1fr}
.gallery img{width:100%;height:100%;object-fit:cover;background:var(--line)}
.gallery .main{grid-row:span 2;aspect-ratio:4/3}
.gallery .side{aspect-ratio:4/3}
.gallery.single{grid-template-columns:1fr}
.gallery.single .main{grid-row:auto;aspect-ratio:16/9}
.amenities{display:flex;flex-wrap:wrap;gap:8px;list-style:none;padding:0;margin:0}
.doc-link{display:flex;align-items:center;gap:10px;padding:14px 16px;text-decoration:none;
  border-bottom:1px solid var(--line);font-weight:600}
.doc-link:last-child{border-bottom:0}
.map{width:100%;aspect-ratio:16/10;border:0;display:block}
.field{margin-bottom:16px}
.field label{display:block;font-weight:700;font-size:14px;margin-bottom:6px}
.field input,.field select,.field textarea{width:100%;min-height:48px;padding:12px 14px;
  border:1.5px solid var(--line);border-radius:10px;font:inherit;background:var(--card);color:var(--ink)}
.field input:focus,.field select:focus,.field textarea:focus{outline:2px solid var(--brand);
  outline-offset:1px;border-color:var(--brand)}
.field .hint{font-size:13px;color:var(--muted);margin-top:5px}
.field-error{color:var(--danger);font-size:13px;font-weight:600;margin-top:5px}
.row{display:grid;gap:12px;grid-template-columns:1fr 1fr}
.alert{padding:14px 16px;border-radius:10px;font-weight:600;margin-bottom:18px}
.alert-error{background:#FDECEC;border:1px solid #F5C2C2;color:#8A2222}
.alert-ok{background:#EAF9EF;border:1px solid #BFE9CD;color:#116B33}
.hp{position:absolute!important;left:-9999px!important;width:1px!important;height:1px!important;
  overflow:hidden!important}
.footer{margin-top:40px;padding:24px 0 40px;border-top:1px solid var(--line);
  color:var(--muted);font-size:13px}
.empty{text-align:center;padding:56px 20px;color:var(--muted)}
.sticky-cta{position:sticky;bottom:0;background:var(--card);border-top:1px solid var(--line);
  padding:12px 16px;display:flex;gap:12px;align-items:center;z-index:15}
.sticky-cta .price{font-size:18px}
.sticky-cta .btn{margin-left:auto}
@media(max-width:560px){
  .row{grid-template-columns:1fr}
  .gallery{grid-template-columns:1fr}
  .gallery .main{grid-row:auto;aspect-ratio:16/10}
  .gallery .side{display:none}
  .header-cta{display:none}
}
@media(prefers-reduced-motion:reduce){*{transition:none!important}}
`;
}

/**
 * @param {object} opts
 * @param {string} opts.title      full <title>, already human-readable
 * @param {string} opts.description meta description and og:description
 * @param {string} opts.canonical  absolute URL of this page
 * @param {string|null} opts.ogImage absolute URL, or null for no image card
 * @param {boolean} opts.noindex   true for anything that should not be crawled
 */
export function page({ title, description, canonical, ogImage = null, noindex = false, agency, body, schema = null, bodyEnd = '', nonce = '' }) {
  const nonceAttr = nonce ? ` nonce="${attr(nonce)}"` : '';
  const primary = agency?.brandPrimaryColor || '#FF7A1A';
  const agencyName = agency?.name || 'Property Listings';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${attr(description)}">
${noindex ? '<meta name="robots" content="noindex,nofollow">' : '<meta name="robots" content="index,follow">'}
<link rel="canonical" href="${attr(canonical)}">

<meta property="og:type" content="website">
<meta property="og:site_name" content="${attr(agencyName)}">
<meta property="og:title" content="${attr(title)}">
<meta property="og:description" content="${attr(description)}">
<meta property="og:url" content="${attr(canonical)}">
${ogImage ? `<meta property="og:image" content="${attr(ogImage)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${attr(ogImage)}">` : '<meta name="twitter:card" content="summary">'}
<meta name="twitter:title" content="${attr(title)}">
<meta name="twitter:description" content="${attr(description)}">
<meta name="theme-color" content="${attr(primary)}">

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&display=swap" rel="stylesheet">
<style${nonceAttr}>${brandCss(primary)}</style>
${schema ? `<script type="application/ld+json"${nonceAttr}>${jsonScript(schema)}</script>` : ''}
</head>
<body>
${body}
${bodyEnd}
</body>
</html>`;
}

export function header(agency, { homeHref = '/', cta = null } = {}) {
  const initial = (agency?.name || 'P').trim().charAt(0).toUpperCase();
  const logo = agency?.logoUrl
    ? `<img class="logo" src="${attr(agency.logoUrl)}" alt="${attr(agency.name)}" width="40" height="40">`
    : `<div class="logo-fallback" aria-hidden="true">${esc(initial)}</div>`;

  return `<header class="site-header"><div class="wrap">
  <a href="${attr(homeHref)}" style="display:flex;align-items:center;gap:12px;text-decoration:none">
    ${logo}
    <span>
      <p class="agency-name">${esc(agency?.name || 'Property Listings')}</p>
      ${agency?.publicPhone ? `<p class="agency-meta">${esc(agency.publicPhone)}</p>` : ''}
    </span>
  </a>
  ${cta ? `<div class="header-cta">${cta}</div>` : ''}
</div></header>`;
}

export function footer(agency) {
  const bits = [
    agency?.publicAddress ? esc(agency.publicAddress) : null,
    agency?.publicPhone ? esc(agency.publicPhone) : null,
    agency?.publicEmail ? esc(agency.publicEmail) : null,
  ].filter(Boolean);

  return `<footer class="footer"><div class="wrap">
  <p style="margin:0 0 6px;font-weight:700;color:var(--ink)">${esc(agency?.name || '')}</p>
  ${bits.length ? `<p style="margin:0">${bits.join(' &middot; ')}</p>` : ''}
  <p style="margin:10px 0 0">Listings shown are provided by ${esc(agency?.name || 'the agency')}. Powered by RealEstateFlow.</p>
</div></footer>`;
}
