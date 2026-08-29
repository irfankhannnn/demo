import { LeadHistoryEntry } from '../types/crm';

const UUID_REGEX = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

export function buildMemberLabelMap(
  members: Array<{ userId: string; label?: string; username?: string }>,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const member of members) {
    const label = member.label || member.username || 'Team member';
    map.set(member.userId, label);
  }
  return map;
}

export function humanizeActivityText(
  text: string,
  memberLabels: Map<string, string>,
  fallback = 'Team member',
): string {
  return text.replace(UUID_REGEX, (id) => memberLabels.get(id) || fallback);
}

export function sortHistoryDescending(entries: LeadHistoryEntry[]): LeadHistoryEntry[] {
  return [...entries].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}

export function formatHistoryEntry(
  entry: LeadHistoryEntry,
  memberLabels: Map<string, string>,
): { action: string; details: string; actor: string; timestamp: string } {
  const actorFromId = entry.updatedByUserId
    ? memberLabels.get(entry.updatedByUserId)
    : undefined;

  return {
    action: entry.action,
    details: humanizeActivityText(entry.details, memberLabels),
    actor: actorFromId || humanizeActivityText(entry.updatedBy, memberLabels),
    timestamp: entry.timestamp,
  };
}
