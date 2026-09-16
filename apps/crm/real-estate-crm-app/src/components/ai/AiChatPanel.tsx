/**
 * In-CRM AI assistant panel (Phase 5).
 *
 * The second channel over the same agent core the WhatsApp bot uses — same
 * tools, same planner, same tenant scoping. What differs is the surface: more
 * room for the answer (the composer gets a larger budget for `channel: 'web'`),
 * visible tool activity instead of a spinner, and clickable entity cards.
 *
 * The transcript lives in component state only. It is replayed to the server
 * as prompt context on each turn but never persisted, so closing the panel
 * ends the conversation. That is a deliberate v1 choice: persisting chat
 * history means another table, a retention policy, and a PII surface, none of
 * which are needed to make the feature useful.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Sparkles, X, ArrowUp, Square, AlertCircle } from 'lucide-react';
import { sendChatTurn, labelForTool, type ChatToolResult, type ChatHistoryTurn } from '../../services/agentChatApi';
import MarkdownLite from './MarkdownLite';
import EntityCards from './EntityCards';

interface Turn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  toolResults?: ChatToolResult[];
  error?: boolean;
}

/** Kept short and task-shaped — these double as a hint about what the assistant can actually do. */
const SUGGESTIONS = [
  'Aaj ka brief dikhao',
  'Naye leads dikhao',
  'Whitefield mein 2BHK properties',
  'Kal ke meetings',
];

let turnCounter = 0;
const nextId = () => `t${++turnCounter}`;

export default function AiChatPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [activity, setActivity] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Keep the newest turn in view as content grows.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns, activity]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Esc closes the panel; abort any in-flight turn on unmount so a reply
  // cannot land on a closed panel.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
    setActivity(null);
  }, []);

  const send = useCallback(async (message: string) => {
    const text = message.trim();
    if (!text || busy) return;

    // Snapshot history BEFORE appending this turn — the server takes the new
    // message separately, and sending it twice would have the model answer
    // its own echo.
    const history: ChatHistoryTurn[] = turns
      .filter((t) => !t.error)
      .map((t) => ({ role: t.role, content: t.text }));

    setTurns((prev) => [...prev, { id: nextId(), role: 'user', text }]);
    setInput('');
    setBusy(true);
    setActivity('Thinking');

    const controller = new AbortController();
    abortRef.current = controller;

    await sendChatTurn(text, history, {
      onStatus: () => setActivity('Thinking'),
      onTool: (toolName, stage) => {
        if (stage === 'running') setActivity(labelForTool(toolName));
      },
      onMessage: ({ text: reply, toolResults }) => {
        setTurns((prev) => [...prev, {
          id: nextId(),
          role: 'assistant',
          text: reply || 'I could not find anything for that.',
          toolResults,
        }]);
      },
      onError: (msg) => {
        setTurns((prev) => [...prev, { id: nextId(), role: 'assistant', text: msg, error: true }]);
      },
    }, controller.signal);

    abortRef.current = null;
    setBusy(false);
    setActivity(null);
  }, [busy, turns]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends, Shift+Enter breaks the line — the convention every chat UI
    // uses, so it needs no explaining.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Scrim. Full-screen on a phone, side sheet from sm: up. */}
      <div
        className="fixed inset-0 z-[70] bg-slate-900/20 backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        role="dialog"
        aria-label="AI assistant"
        className="fixed inset-0 z-[71] flex flex-col bg-white sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[420px] sm:border-l sm:border-slate-200 sm:shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand/10 text-brand">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Assistant</h2>
              <p className="text-[11px] text-slate-500">Same AI as your WhatsApp bot</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close assistant"
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
          {turns.length === 0 && (
            <div className="pt-6">
              <p className="text-sm font-medium text-slate-900">What do you need?</p>
              <p className="mt-1 text-xs text-slate-500">
                Ask in Hinglish or English. I can search, create and update records.
              </p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => void send(s)}
                    className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600 transition-colors hover:border-brand hover:text-brand"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4">
            {turns.map((turn) => (
              turn.role === 'user' ? (
                <div key={turn.id} className="flex justify-end">
                  <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-sm bg-brand px-3.5 py-2 text-sm text-white">
                    {turn.text}
                  </p>
                </div>
              ) : (
                <div key={turn.id} className="max-w-full">
                  {turn.error ? (
                    <p className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{turn.text}</span>
                    </p>
                  ) : (
                    <>
                      <MarkdownLite text={turn.text} />
                      <EntityCards toolResults={turn.toolResults || []} onNavigate={onClose} />
                    </>
                  )}
                </div>
              )
            ))}

            {activity && (
              <p className="flex items-center gap-2 text-xs text-slate-500" aria-live="polite">
                <span className="flex gap-0.5">
                  {[0, 150, 300].map((delay) => (
                    <span
                      key={delay}
                      className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-300"
                      style={{ animationDelay: `${delay}ms` }}
                    />
                  ))}
                </span>
                {activity}…
              </p>
            )}
          </div>
        </div>

        <div className="border-t border-slate-200 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="flex items-end gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 focus-within:border-brand">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              placeholder="Ask anything about your CRM…"
              className="max-h-32 flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
            {busy ? (
              <button
                onClick={stop}
                aria-label="Stop"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-200 text-slate-600 transition-colors hover:bg-slate-300"
              >
                <Square className="h-3.5 w-3.5" fill="currentColor" />
              </button>
            ) : (
              <button
                onClick={() => void send(input)}
                disabled={!input.trim()}
                aria-label="Send"
                /* No `brand-dark` token exists — the scale is DEFAULT/light/lighter — so hover dims rather than darkening. */
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand text-white transition-opacity hover:opacity-90 disabled:opacity-30"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
