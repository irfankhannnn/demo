import type { InstagramAccount } from '../api/types';
import type { BadgeTone } from '../components/Badge';
import { millisSince } from './format';

/**
 * Account health is derived, not stored, so the Overview panel and the
 * Accounts page can never disagree about what "healthy" means.
 */

export interface AccountHealth {
  label: string;
  tone: BadgeTone;
  /** One sentence telling the owner what, if anything, to do. */
  detail: string | null;
}

const DAY = 24 * 60 * 60 * 1000;

export function accountHealth(account: InstagramAccount): AccountHealth {
  if (account.status === 'disconnected') {
    return { label: 'Disconnected', tone: 'neutral', detail: 'Nothing is synced. Connect it again to resume.' };
  }
  if (account.status === 'reconnect_required') {
    return {
      label: 'Reconnect needed',
      tone: 'danger',
      detail: account.lastError || 'Instagram access expired or was removed. Reconnect the account.',
    };
  }

  // An error newer than the last successful DM sync is a live problem.
  const errorAge = millisSince(account.lastErrorAt);
  const syncAge = millisSince(account.lastConversationsSyncAt);
  if (account.lastError && errorAge !== null && (syncAge === null || errorAge <= syncAge)) {
    return { label: 'Sync issue', tone: 'warning', detail: account.lastError };
  }

  if (account.tokenExpiringSoon) {
    const left = account.tokenExpiresAt ? Math.max(0, Math.ceil((Date.parse(account.tokenExpiresAt) - Date.now()) / DAY)) : null;
    return {
      label: 'Access expiring',
      tone: 'warning',
      detail: `Instagram access expires${left !== null ? ` in ${left} day${left === 1 ? '' : 's'}` : ' soon'}. It refreshes automatically; reconnect if this does not clear.`,
    };
  }

  return { label: 'Connected', tone: 'success', detail: null };
}
