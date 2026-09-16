/**
 * Entity cards for AI chat replies.
 *
 * This is what makes an in-CRM assistant different from a generic chatbot: when
 * the turn touched real records, the user gets a row they can click through to,
 * not just prose describing it. The prose still comes from the composer — these
 * sit underneath it.
 *
 * Rendering is defensive throughout. The payloads come from tool results whose
 * exact shape varies by entity (some go through the AI-DTO envelope, some do
 * not), so every field access tolerates absence and a card that cannot be
 * identified is skipped rather than rendered blank.
 */

import { Link } from 'react-router-dom';
import { Users, Building2, Contact as ContactIcon, CalendarDays, ChevronRight } from 'lucide-react';
import type { ChatToolResult } from '../../services/agentChatApi';

type EntityKind = 'lead' | 'property' | 'contact' | 'buyer' | 'tenant' | 'owner' | 'meeting';

interface EntityCard {
  kind: EntityKind;
  id: string;
  title: string;
  subtitle?: string;
  to: string;
}

const ICONS: Record<EntityKind, typeof Users> = {
  lead: Users,
  buyer: Users,
  tenant: Users,
  owner: ContactIcon,
  contact: ContactIcon,
  property: Building2,
  meeting: CalendarDays,
};

/** Detail route per entity. Kept beside the cards so a routing change is one edit. */
const ROUTES: Record<EntityKind, (id: string) => string> = {
  lead: (id) => `/crm/leads/${id}`,
  buyer: (id) => `/crm/buyers/${id}`,
  tenant: (id) => `/crm/tenants/${id}`,
  owner: (id) => `/crm/owners/${id}`,
  contact: (id) => `/crm/contacts/${id}`,
  property: (id) => `/crm/properties/${id}`,
  meeting: () => '/crm/calendar',
};

/** id field → entity kind. Mirrors ID_ARG_BY_ENTITY on the server. */
const ID_FIELDS: Array<[string, EntityKind]> = [
  ['leadId', 'lead'],
  ['propertyId', 'property'],
  ['contactId', 'contact'],
  ['buyerId', 'buyer'],
  ['tenantRecordId', 'tenant'],
  ['customerId', 'tenant'],
  ['ownerId', 'owner'],
  ['meetingId', 'meeting'],
];

function unwrap(data: any): any {
  // Some tools return the AI-DTO envelope { metadata, data }, some return the
  // payload directly.
  if (data && typeof data === 'object' && data.metadata && 'data' in data) return data.data;
  return data;
}

function toArray(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  for (const key of ['items', 'leads', 'buyers', 'owners', 'customers', 'tenants', 'properties', 'contacts', 'meetings']) {
    if (Array.isArray(payload[key])) return payload[key];
  }
  // A single detail record.
  return [payload];
}

function buildCard(item: any): EntityCard | null {
  if (!item || typeof item !== 'object') return null;

  const found = ID_FIELDS.find(([field]) => typeof item[field] === 'string' && item[field]);
  if (!found) return null;
  const [field, kind] = found;
  const id = item[field] as string;

  const title = item.name || item.fullName || item.title || item.propertyName || item.subject;
  if (!title) return null;

  const subtitleParts = [
    item.status,
    item.leadType,
    item.propertyType,
    item.locality || item.area || item.preferredArea,
    item.phone,
  ].filter((p) => typeof p === 'string' && p.trim().length > 0);

  return {
    kind,
    id,
    title: String(title),
    subtitle: subtitleParts.slice(0, 2).join(' · ') || undefined,
    to: ROUTES[kind](id),
  };
}

/** At most this many cards per reply — beyond it the list becomes the answer, which the prose already is. */
const MAX_CARDS = 6;

export default function EntityCards({
  toolResults,
  onNavigate,
}: {
  toolResults: ChatToolResult[];
  onNavigate?: () => void;
}) {
  const seen = new Set<string>();
  const cards: EntityCard[] = [];

  for (const tr of toolResults || []) {
    if (!tr?.result?.ok) continue;
    for (const item of toArray(unwrap(tr.result.data))) {
      const card = buildCard(item);
      if (!card) continue;
      const dedupeKey = `${card.kind}:${card.id}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      cards.push(card);
      if (cards.length >= MAX_CARDS) break;
    }
    if (cards.length >= MAX_CARDS) break;
  }

  if (cards.length === 0) return null;

  return (
    <div className="mt-2 space-y-1.5">
      {cards.map((card) => {
        const Icon = ICONS[card.kind];
        return (
          <Link
            key={`${card.kind}-${card.id}`}
            to={card.to}
            onClick={onNavigate}
            className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2 transition-colors hover:border-brand hover:bg-brand/5"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500">
              <Icon className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-slate-900">{card.title}</span>
              {card.subtitle && (
                <span className="block truncate text-[11px] capitalize text-slate-500">{card.subtitle}</span>
              )}
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
          </Link>
        );
      })}
    </div>
  );
}
