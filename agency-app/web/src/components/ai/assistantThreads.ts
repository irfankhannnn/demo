/**
 * Conversation storage for the full-page assistant.
 *
 * WHY localStorage AND NOT THE SERVER
 *
 * A server-side transcript store means a new DynamoDB table, a retention
 * policy, and a fresh PII surface holding customer names and phone numbers —
 * for a feature whose value is "my chat is still here after I refresh". The
 * browser already holds the auth profile, so this adds no new class of data to
 * the device.
 *
 * The tradeoff is stated plainly in the UI: threads are per-browser, and the
 * sidebar carries a "Clear all chats" control so the user can wipe them.
 *
 * TWO RULES THAT MATTER FOR SAFETY
 *
 * 1. Every key is scoped to the signed-in `userId`. Two colleagues sharing a
 *    machine never read each other's threads, and a user who signs out and
 *    back in as somebody else lands on a different key.
 * 2. `clearAllAssistantThreads()` removes *every* namespaced key, not just the
 *    current user's, and is wired into logout. Signing out must not leave a
 *    readable transcript behind on a shared device.
 *
 * Storage is best-effort throughout. A private window, a full quota or a
 * browser configured to block site data all surface as "no persistence", never
 * as a crash — the chat still works, it just forgets.
 */

import type { ChatToolResult } from '../../services/agentChatApi';
import { getUserProfile } from '../../utils/authStorage';

export interface StoredTurn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  toolResults?: ChatToolResult[];
  error?: boolean;
}

export interface Thread {
  id: string;
  title: string;
  turns: StoredTurn[];
  updatedAt: number;
}

const KEY_PREFIX = 'assistant_threads_v1:';

/** Oldest threads beyond this are dropped. Twenty is far more than anyone scrolls back through. */
export const MAX_THREADS = 20;

/** Per-thread turn cap. The server only replays the last 20 turns as prompt context anyway. */
export const MAX_TURNS_PER_THREAD = 60;

/**
 * Serialized-size ceiling before threads start getting dropped.
 *
 * localStorage is typically 5 MB per origin and is shared with the auth
 * profile and everything else the app keeps. Staying near 400 KB means the
 * assistant can never be the reason a token write fails.
 */
const MAX_SERIALIZED_BYTES = 400_000;

/** Thread titles are derived from the first message; this keeps the sidebar single-line. */
const MAX_TITLE_CHARS = 48;

function storageKey(): string | null {
  const userId = getUserProfile()?.userId;
  return userId ? `${KEY_PREFIX}${userId}` : null;
}

function isThread(value: unknown): value is Thread {
  if (!value || typeof value !== 'object') return false;
  const t = value as Partial<Thread>;
  return typeof t.id === 'string'
    && typeof t.title === 'string'
    && typeof t.updatedAt === 'number'
    && Array.isArray(t.turns);
}

/**
 * Coerce a stored turn back into shape.
 *
 * Anything read out of localStorage is untrusted — it can be edited by hand or
 * left behind by an older build — so the role is narrowed to the two the UI
 * renders and the text is forced to a string. A malformed turn is dropped.
 */
function reviveTurn(raw: unknown): StoredTurn | null {
  if (!raw || typeof raw !== 'object') return null;
  const t = raw as Record<string, unknown>;
  if (typeof t.text !== 'string') return null;
  return {
    id: typeof t.id === 'string' ? t.id : `r${Math.random().toString(36).slice(2)}`,
    role: t.role === 'assistant' ? 'assistant' : 'user',
    text: t.text,
    toolResults: Array.isArray(t.toolResults) ? (t.toolResults as ChatToolResult[]) : undefined,
    error: t.error === true,
  };
}

export function loadThreads(): Thread[] {
  const key = storageKey();
  if (!key) return [];

  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(isThread)
      .map((thread) => ({
        ...thread,
        turns: thread.turns
          .map(reviveTurn)
          .filter((turn): turn is StoredTurn => turn !== null)
          .slice(-MAX_TURNS_PER_THREAD),
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_THREADS);
  } catch {
    // Corrupt JSON, a blocked accessor, or a private window. Start fresh
    // rather than taking the page down.
    return [];
  }
}

/**
 * Write threads back, shedding the oldest until the payload fits.
 *
 * Trimming on write rather than on read is what keeps a long-lived session
 * from silently failing every save once it crosses the quota.
 */
export function saveThreads(threads: Thread[]): void {
  const key = storageKey();
  if (!key) return;

  let candidates = [...threads]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_THREADS)
    .map((thread) => ({ ...thread, turns: thread.turns.slice(-MAX_TURNS_PER_THREAD) }));

  try {
    let payload = JSON.stringify(candidates);
    while (payload.length > MAX_SERIALIZED_BYTES && candidates.length > 1) {
      candidates = candidates.slice(0, -1);
      payload = JSON.stringify(candidates);
    }
    localStorage.setItem(key, payload);
  } catch {
    // Quota exceeded even after trimming, or storage is unavailable. Losing
    // persistence is acceptable; interrupting the conversation is not.
  }
}

/**
 * Remove every user's threads from this browser.
 *
 * Called on logout. Iterates a snapshot of the key list because removing
 * entries mutates `localStorage.length` mid-loop.
 */
export function clearAllAssistantThreads(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith(KEY_PREFIX)) keys.push(key);
    }
    keys.forEach((key) => localStorage.removeItem(key));
  } catch {
    /* storage unavailable — nothing was written in the first place */
  }
}

/** A thread's title is its opening message, trimmed to one line. */
export function titleFromMessage(message: string): string {
  const flat = message.replace(/\s+/g, ' ').trim();
  if (flat.length <= MAX_TITLE_CHARS) return flat || 'New chat';
  return `${flat.slice(0, MAX_TITLE_CHARS - 1)}…`;
}

export function newThreadId(): string {
  // crypto.randomUUID is unavailable on http:// origins in some browsers, and
  // thread ids are local keys rather than security tokens, so a timestamped
  // random suffix is the right amount of uniqueness here.
  return `th_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
