/**
 * Client for the in-CRM AI chat (Phase 5).
 *
 * WHY fetch + a manual reader RATHER THAN EventSource:
 * `EventSource` can only issue GET requests and cannot set an Authorization
 * header. This endpoint is an authenticated POST carrying a message body, so
 * the stream is read off `fetch`'s response body instead and the SSE frames
 * are parsed by hand. That is the standard approach for authenticated SSE and
 * is what every ChatGPT-style client does.
 *
 * The server may or may not flush incrementally depending on where it is
 * deployed (see routes/agentChat.js). This parser does not care: it handles
 * frames as they arrive, whether that is one at a time or all at once.
 */

import { getIdToken } from '../utils/authStorage';

const API_BASE_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;

export interface ChatToolResult {
  tool: string;
  result: { ok: boolean; data?: unknown; error?: string };
}

export interface ChatTurnEvents {
  /** A coarse stage change, e.g. the turn has started. */
  onStatus?: (stage: string) => void;
  /** A CRM tool started or finished. Drives the "Searching leads…" line. */
  onTool?: (toolName: string, stage: 'running' | 'done', ok?: boolean) => void;
  /** The composed reply plus anything the turn touched. */
  onMessage?: (payload: { text: string; toolResults: ChatToolResult[]; durationMs?: number }) => void;
  onError?: (message: string) => void;
}

export interface ChatHistoryTurn {
  role: 'user' | 'assistant';
  content: string;
}

/** Human-readable labels for the tools worth narrating. Anything else falls back to a generic line. */
const TOOL_LABELS: Record<string, string> = {
  search_leads: 'Searching leads',
  search_properties: 'Searching properties',
  search_contacts: 'Searching contacts',
  search_buyers: 'Searching buyers',
  search_tenants: 'Searching tenants',
  search_owners: 'Searching owners',
  find_person: 'Looking that person up',
  get_daily_brief: 'Building your brief',
  get_dashboard_snapshot: 'Reading your dashboard',
  get_pipeline_summary: 'Summarising the pipeline',
  create_lead: 'Creating the lead',
  update_lead: 'Updating the lead',
  create_meeting: 'Scheduling the meeting',
  create_property: 'Adding the property',
  update_property: 'Updating the property',
};

export function labelForTool(toolName: string): string {
  if (TOOL_LABELS[toolName]) return TOOL_LABELS[toolName];
  if (toolName.startsWith('search_') || toolName.startsWith('get_')) return 'Looking that up';
  if (toolName.startsWith('create_')) return 'Creating that';
  if (toolName.startsWith('update_')) return 'Saving that';
  if (toolName.startsWith('archive_')) return 'Archiving that';
  return 'Working on it';
}

/**
 * Send one turn and dispatch SSE frames as they arrive.
 *
 * @param signal pass an AbortController signal to cancel an in-flight turn.
 */
export async function sendChatTurn(
  message: string,
  history: ChatHistoryTurn[],
  events: ChatTurnEvents,
  signal?: AbortSignal,
): Promise<void> {
  const idToken = getIdToken();

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/crm/agent-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      },
      body: JSON.stringify({ message, history }),
      signal,
    });
  } catch (err) {
    // An aborted turn is a user action, not a failure to report.
    if ((err as Error).name === 'AbortError') return;
    events.onError?.('Could not reach the server. Check your connection.');
    return;
  }

  if (!response.ok) {
    // Errors raised before the stream opened come back as ordinary JSON.
    let detail = 'Something went wrong.';
    try {
      const body = await response.json();
      if (body?.error) detail = body.error;
    } catch {
      /* non-JSON error body — keep the generic message */
    }
    events.onError?.(detail);
    return;
  }

  if (!response.body) {
    events.onError?.('Streaming is not supported in this browser.');
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const dispatch = (rawFrame: string) => {
    let eventName = 'message';
    const dataLines: string[] = [];
    for (const line of rawFrame.split('\n')) {
      if (line.startsWith('event:')) eventName = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
      // ':' comment lines (SSE keep-alives) are ignored.
    }
    if (dataLines.length === 0) return;

    let payload: any;
    try {
      payload = JSON.parse(dataLines.join('\n'));
    } catch {
      return; // A partial or malformed frame is dropped, not fatal.
    }

    switch (eventName) {
      case 'status':
        events.onStatus?.(payload.stage);
        break;
      case 'tool':
        events.onTool?.(payload.toolName, payload.stage, payload.ok);
        break;
      case 'message':
        events.onMessage?.({
          text: payload.text || '',
          toolResults: payload.toolResults || [],
          durationMs: payload.durationMs,
        });
        break;
      case 'error':
        events.onError?.(payload.error || 'Something went wrong.');
        break;
      default:
        break; // 'done' needs no handling — the stream ending is the signal.
    }
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Frames are separated by a blank line. Anything after the last
      // separator is a partial frame and stays in the buffer.
      const frames = buffer.split('\n\n');
      buffer = frames.pop() ?? '';
      for (const frame of frames) {
        if (frame.trim()) dispatch(frame);
      }
    }
    if (buffer.trim()) dispatch(buffer);
  } catch (err) {
    if ((err as Error).name === 'AbortError') return;
    events.onError?.('The connection dropped mid-reply.');
  }
}
