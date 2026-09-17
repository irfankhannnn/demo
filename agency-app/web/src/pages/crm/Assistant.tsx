/**
 * The full-page AI assistant — the CRM's second surface onto the same agent
 * that answers WhatsApp.
 *
 * WHAT THIS IS NOT
 *
 * It is not a second agent. Every turn goes to `POST /api/crm/agent-chat`,
 * which runs `validateToken` → `extractTenantId` → `requireCrmMemberOrAbove`
 * and then the same classify → plan → execute → compose pipeline over the same
 * 73-tool registry. Tenant scoping and per-tool RBAC (derived from the JWT
 * role by `categoryForCrmRole`) are enforced on the server, on every tool call.
 *
 * That matters for how this file is written: **nothing here decides what the
 * user may do.** The quick actions and the "+" menu are discovery aids. A
 * viewer who taps "Create a lead" gets the same refusal they would get by
 * typing it, because the decision is made where the data is. Client-side
 * gating here would only hide capability from people who have it and would
 * grant nothing to people who don't.
 *
 * The floating launcher (`AiAssistantLauncher`) still exists and still opens
 * the compact side sheet from any screen. This page is the same conversation
 * with room to work: threads, quick actions, and the CRM's flows behind "+".
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles, Home, ArrowUp, Square, AlertCircle, PanelLeft, Plus, MessageSquare,
  Trash2, User, X, UploadCloud, CheckCircle2, Loader2,
} from 'lucide-react';

import { api } from '../../services/api';
import { sendChatTurn, labelForTool, type ChatHistoryTurn } from '../../services/agentChatApi';
import { getUserProfile } from '../../utils/authStorage';
import {
  ACCEPTED_AUDIO_EXTENSIONS, rejectAudioFile, resolveAudioContentType,
} from '../../utils/audioUpload';

import MarkdownLite from '../../components/ai/MarkdownLite';
import EntityCards from '../../components/ai/EntityCards';
import WorkspaceSwitch from '../../components/ai/WorkspaceSwitch';
import AssistantPlusMenu from '../../components/ai/AssistantPlusMenu';
import QuickActions from '../../components/ai/QuickActions';
import {
  loadThreads, saveThreads, titleFromMessage, newThreadId,
  type StoredTurn, type Thread,
} from '../../components/ai/assistantThreads';

/** Mirrors MAX_WEB_MESSAGE_CHARS in agency-app/api/agents/channels/webChannel.js. */
const MAX_MESSAGE_CHARS = 4000;

/** Show the counter only once the limit is close enough to matter. */
const COUNTER_VISIBLE_FROM = MAX_MESSAGE_CHARS - 300;

let turnSeq = 0;
const nextTurnId = () => `tn_${Date.now().toString(36)}_${(turnSeq += 1)}`;

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function firstName(displayName?: string): string {
  if (!displayName) return '';
  return displayName.trim().split(/\s+/)[0] || '';
}

interface UploadState {
  filename: string;
  percent: number;
  status: 'uploading' | 'processing' | 'done' | 'error';
  error?: string;
}

/* ────────────────────────────────────────────────────────────────────────────
   Composer
   Defined at module scope on purpose. A component declared inside the page
   function is a NEW type on every render, so React unmounts and remounts it —
   the textarea would lose focus and its caret on every keystroke.
   ──────────────────────────────────────────────────────────────────────────── */

interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  busy: boolean;
  plusOpen: boolean;
  onPlusOpenChange: (open: boolean) => void;
  onUploadRecording: () => void;
  onNavigate: (path: string) => void;
  inputRef: React.RefObject<HTMLTextAreaElement>;
  placeholder: string;
  autoFocus?: boolean;
}

function Composer({
  value, onChange, onSubmit, onStop, busy,
  plusOpen, onPlusOpenChange, onUploadRecording, onNavigate,
  inputRef, placeholder, autoFocus = false,
}: ComposerProps) {
  const tooLong = value.length > MAX_MESSAGE_CHARS;

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus, inputRef]);

  // Grow with the content up to the max-height the class sets, then scroll.
  useEffect(() => {
    const node = inputRef.current;
    if (!node) return;
    node.style.height = 'auto';
    node.style.height = `${Math.min(node.scrollHeight, 200)}px`;
  }, [value, inputRef]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends, Shift+Enter breaks the line. Every chat UI does this, so it
    // needs no explaining — but an IME composition must not be interrupted,
    // which matters for the Devanagari keyboards a lot of brokers use.
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      onSubmit();
    }
  };

  return (
    /*
     * `relative z-20`, and deliberately NO backdrop-blur.
     *
     * A backdrop-filter creates a stacking context, which trapped the "+"
     * menu's z-50 inside this box — the quick-action chips below, later in DOM
     * order, painted straight over the open menu. It read as the menu being
     * transparent. Blur bought almost nothing over `bg-white/90`; the explicit
     * z-index is what keeps the menu above its siblings for good.
     */
    <div
      className={`relative z-20 rounded-2xl border bg-white/90 shadow-lg shadow-slate-900/5 transition-colors ${
        tooLong ? 'border-rose-300' : 'border-slate-200 focus-within:border-indigo-300'
      }`}
    >
      <textarea
        ref={inputRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        rows={1}
        placeholder={placeholder}
        aria-label="Message the assistant"
        className="max-h-[200px] w-full resize-none bg-transparent px-4 pt-3.5 text-[15px] leading-relaxed text-slate-900 outline-none placeholder:text-slate-400"
      />

      <div className="flex items-center gap-2 px-3 pb-3 pt-1">
        <AssistantPlusMenu
          open={plusOpen}
          onOpenChange={onPlusOpenChange}
          onUploadRecording={onUploadRecording}
          onNavigate={onNavigate}
          busy={busy}
        />

        <p className="min-w-0 flex-1 truncate text-[11px] text-slate-400">
          {tooLong
            ? `${value.length.toLocaleString()} / ${MAX_MESSAGE_CHARS.toLocaleString()} — too long to send`
            : value.length >= COUNTER_VISIBLE_FROM
              ? `${value.length.toLocaleString()} / ${MAX_MESSAGE_CHARS.toLocaleString()}`
              : 'Hinglish or English · same AI as your WhatsApp bot'}
        </p>

        {busy ? (
          <button
            type="button"
            onClick={onStop}
            aria-label="Stop generating"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-200 text-slate-600 transition-colors hover:bg-slate-300"
          >
            <Square className="h-3.5 w-3.5" fill="currentColor" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onSubmit}
            disabled={!value.trim() || tooLong}
            aria-label="Send message"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white transition-opacity hover:opacity-90 disabled:opacity-30"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────── */

export default function Assistant() {
  const navigate = useNavigate();
  const profile = getUserProfile();

  /*
   * Read storage exactly once. Two `useState` initialisers both calling
   * loadThreads() would parse and revive the whole store twice, and could
   * disagree if anything wrote between them.
   */
  const initialThreads = useRef<Thread[] | null>(null);
  if (initialThreads.current === null) initialThreads.current = loadThreads();

  const [threads, setThreads] = useState<Thread[]>(initialThreads.current);
  const [activeId, setActiveId] = useState<string | null>(initialThreads.current[0]?.id ?? null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [activity, setActivity] = useState<string | null>(null);
  const [plusOpen, setPlusOpen] = useState(false);
  const [upload, setUpload] = useState<UploadState | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  /*
   * Refs mirroring state, read inside `send`.
   *
   * `send` is handed to child components and to the keyboard handler; reading
   * `threads` from the closure there would replay whatever the transcript was
   * when the callback was created. These always hold the current value.
   */
  const threadsRef = useRef(threads);
  const activeIdRef = useRef(activeId);
  const busyRef = useRef(busy);
  useEffect(() => { threadsRef.current = threads; }, [threads]);
  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);
  useEffect(() => { busyRef.current = busy; }, [busy]);

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeId) ?? null,
    [threads, activeId],
  );
  const turns = activeThread?.turns ?? [];
  const isEmpty = turns.length === 0;

  useEffect(() => { saveThreads(threads); }, [threads]);

  // Abort any in-flight turn on unmount so a reply cannot land on a dead page.
  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (isEmpty) return;
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns.length, activity, isEmpty]);

  const appendTurn = useCallback((threadId: string, turn: StoredTurn) => {
    setThreads((prev) => prev.map((thread) => (
      thread.id === threadId
        ? { ...thread, turns: [...thread.turns, turn], updatedAt: Date.now() }
        : thread
    )));
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
    setActivity(null);
  }, []);

  const send = useCallback(async (raw: string) => {
    const text = raw.trim();
    if (!text || busyRef.current) return;
    if (text.length > MAX_MESSAGE_CHARS) {
      setNotice(`That message is ${text.length.toLocaleString()} characters — the limit is ${MAX_MESSAGE_CHARS.toLocaleString()}.`);
      return;
    }

    setNotice(null);
    setPlusOpen(false);

    // Resolve the thread this turn belongs to, creating one on the first
    // message so a fresh page does not need an explicit "new chat" click.
    const currentId = activeIdRef.current;
    const existing = currentId
      ? threadsRef.current.find((thread) => thread.id === currentId) ?? null
      : null;

    const history: ChatHistoryTurn[] = (existing?.turns ?? [])
      .filter((turn) => !turn.error)
      .map((turn) => ({ role: turn.role, content: turn.text }));

    const userTurn: StoredTurn = { id: nextTurnId(), role: 'user', text };
    let threadId: string;

    if (existing) {
      threadId = existing.id;
      appendTurn(threadId, userTurn);
    } else {
      threadId = newThreadId();
      activeIdRef.current = threadId;
      setActiveId(threadId);
      setThreads((prev) => [
        { id: threadId, title: titleFromMessage(text), turns: [userTurn], updatedAt: Date.now() },
        ...prev,
      ]);
    }

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
        appendTurn(threadId, {
          id: nextTurnId(),
          role: 'assistant',
          text: reply || 'I could not find anything for that.',
          toolResults,
        });
      },
      onError: (message) => {
        appendTurn(threadId, { id: nextTurnId(), role: 'assistant', text: message, error: true });
      },
    }, controller.signal);

    abortRef.current = null;
    setBusy(false);
    setActivity(null);
  }, [appendTurn]);

  const startNewChat = useCallback(() => {
    stop();
    setActiveId(null);
    activeIdRef.current = null;
    setInput('');
    setNotice(null);
    setSidebarOpen(false);
    inputRef.current?.focus();
  }, [stop]);

  const openThread = useCallback((threadId: string) => {
    stop();
    setActiveId(threadId);
    activeIdRef.current = threadId;
    setSidebarOpen(false);
  }, [stop]);

  const deleteThread = useCallback((threadId: string) => {
    setThreads((prev) => prev.filter((thread) => thread.id !== threadId));
    if (activeIdRef.current === threadId) {
      stop();
      setActiveId(null);
      activeIdRef.current = null;
    }
  }, [stop]);

  const clearAllThreads = useCallback(() => {
    stop();
    setThreads([]);
    setActiveId(null);
    activeIdRef.current = null;
  }, [stop]);

  /*
   * Prefill a half-written prompt and put the caret at the end, ready to be
   * finished ("2BHK in …").
   *
   * The obvious `requestAnimationFrame` version does not work: the frame can
   * run before React has committed the new value, so `setSelectionRange` acts
   * on the OLD text and the subsequent re-render drops the caret back to 0 —
   * and focus never lands. Bumping a counter and moving the caret in an effect
   * keyed on it guarantees the DOM already holds the new value.
   */
  const [caretBump, setCaretBump] = useState(0);

  const prefill = useCallback((text: string) => {
    setInput(text);
    setCaretBump((n) => n + 1);
  }, []);

  useEffect(() => {
    if (caretBump === 0) return;
    const node = inputRef.current;
    if (!node) return;
    node.focus();
    node.setSelectionRange(node.value.length, node.value.length);
  }, [caretBump]);

  /* ── Call-recording upload ────────────────────────────────────────────────
     Uses the same presigned-URL flow as the Call Recordings page. The server
     re-validates content type and size before issuing the URL — the checks
     here just fail fast before a 200 MB transfer starts.                    */

  const onFilePicked = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset immediately so picking the same file twice fires onChange again.
    event.target.value = '';
    if (!file) return;

    const reason = rejectAudioFile(file);
    if (reason) {
      setUpload({ filename: file.name, percent: 0, status: 'error', error: reason });
      return;
    }

    setUpload({ filename: file.name, percent: 0, status: 'uploading' });

    try {
      const contentType = resolveAudioContentType(file);
      const created = await api.createCallRecordingUploadUrl({
        filename: file.name,
        contentType,
        sizeBytes: file.size,
      });

      // The declared content type must match the one the URL was signed for,
      // or S3 rejects the PUT.
      await api.uploadCallRecordingToS3(
        created.uploadUrl,
        file,
        (percent) => setUpload((prev) => (prev ? { ...prev, percent } : prev)),
        contentType,
      );

      setUpload((prev) => (prev ? { ...prev, percent: 100, status: 'processing' } : prev));
      await api.confirmCallRecordingUpload(created.recordingId);
      setUpload((prev) => (prev ? { ...prev, status: 'done' } : prev));
    } catch (err) {
      setUpload((prev) => (prev ? {
        ...prev,
        status: 'error',
        error: err instanceof Error ? err.message : 'Upload failed',
      } : prev));
    }
  }, []);

  const name = firstName(profile?.displayName);

  const threadList = (
    <div className="flex h-full flex-col gap-1">
      <button
        type="button"
        onClick={startNewChat}
        className="mb-1 flex items-center gap-2 rounded-xl border border-slate-200/70 bg-white/70 px-3 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-indigo-200 hover:bg-white hover:text-indigo-600"
      >
        <Plus className="h-4 w-4" />
        New chat
      </button>

      {threads.length === 0 ? (
        <p className="px-3 py-6 text-xs leading-relaxed text-slate-400">
          Your chats show up here. They stay on this device only — nothing is sent to a server to be stored.
        </p>
      ) : (
        <>
          <p className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Recent
          </p>
          <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto">
            {threads.map((thread) => {
              const active = thread.id === activeId;
              return (
                <li key={thread.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => openThread(thread.id)}
                    className={`flex w-full items-center gap-2 rounded-xl py-2 pl-3 pr-8 text-left transition-colors ${
                      active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:bg-white/60'
                    }`}
                  >
                    <MessageSquare className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="truncate text-[13px]">{thread.title}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteThread(thread.id)}
                    aria-label={`Delete chat: ${thread.title}`}
                    /* Always reachable by keyboard; revealed on hover for the mouse. */
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-300 opacity-0 transition-all hover:bg-rose-50 hover:text-rose-500 focus:opacity-100 group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>

          <button
            type="button"
            onClick={clearAllThreads}
            className="mt-1 rounded-xl px-3 py-2 text-left text-[11px] font-medium text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-500"
          >
            Clear all chats
          </button>
        </>
      )}
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50">
      {/* Hidden picker driven by the "+" menu. */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_AUDIO_EXTENSIONS}
        onChange={onFilePicked}
        className="hidden"
      />

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="glass-premium sticky top-0 z-30 border-b border-white/30">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-3 sm:px-4 lg:px-8">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Show chats"
              className="rounded-xl p-2 text-slate-500 transition-colors hover:bg-white/60 hover:text-indigo-600 lg:hidden"
            >
              <PanelLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => navigate('/crm')}
              title="CRM home"
              className="rounded-xl p-2 text-slate-500 transition-colors hover:bg-white/60 hover:text-indigo-600"
            >
              <Home className="h-5 w-5" />
            </button>
            <div className="hidden min-w-0 sm:block">
              <h1 className="truncate text-base font-bold tracking-tight text-slate-900 sm:text-lg">
                Assistant
              </h1>
              <p className="hidden text-xs font-medium text-slate-400 lg:block">
                Ask, search and update your CRM
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={startNewChat}
              /* The label is hidden below sm:, so without this the control is
                 an unnamed icon button on exactly the surface most people use. */
              aria-label="New chat"
              className="flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-white/60 hover:text-indigo-600"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New chat</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/profile')}
              title="Profile"
              className="rounded-xl p-2 text-slate-500 transition-colors hover:bg-white/60 hover:text-indigo-600"
            >
              <User className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/*
          The switch lives on its own centred row rather than inside the header
          line, and it does so on BOTH surfaces.

          Centring it *within* the header row worked here — this header is
          sparse — but collided badly on the CRM dashboard, whose right-hand
          cluster (date, bell, Members, Analytics, Profile, Logout) leaves no
          free centre at any width. A control that is meant to feel like one
          fixed thing the page changes behind cannot sit in two different
          places, so both pages use the row.
        */}
        <div className="flex justify-center pb-2.5">
          <WorkspaceSwitch />
        </div>
      </header>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div className="mx-auto flex w-full max-w-7xl flex-1">
        <aside className="sticky top-[73px] hidden h-[calc(100vh-73px)] w-64 shrink-0 border-r border-white/40 px-3 py-4 lg:block">
          {threadList}
        </aside>

        {/* Mobile thread drawer */}
        {sidebarOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-[1px] lg:hidden"
              onClick={() => setSidebarOpen(false)}
              aria-hidden="true"
            />
            <div
              role="dialog"
              aria-label="Chats"
              className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-slate-200 bg-slate-50 px-3 py-4 shadow-2xl lg:hidden"
            >
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-sm font-bold text-slate-900">Chats</span>
                <button
                  type="button"
                  onClick={() => setSidebarOpen(false)}
                  aria-label="Close chats"
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {threadList}
            </div>
          </>
        )}

        <main className="flex min-w-0 flex-1 flex-col px-3 sm:px-6 lg:px-8">
          {isEmpty ? (
            /* ── Empty state: greeting, composer, quick actions ─────────── */
            <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center py-10">
              <div className="mb-8 flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/30">
                  <Sparkles className="h-5 w-5 text-white" />
                </span>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                  {greeting()}{name ? `, ${name}` : ''}
                </h2>
              </div>

              <div className="w-full max-w-3xl">
                <Composer
                  value={input}
                  onChange={setInput}
                  onSubmit={() => void send(input)}
                  onStop={stop}
                  busy={busy}
                  plusOpen={plusOpen}
                  onPlusOpenChange={setPlusOpen}
                  onUploadRecording={() => fileInputRef.current?.click()}
                  onNavigate={navigate}
                  inputRef={inputRef}
                  placeholder="How can I help you today?"
                  autoFocus
                />
              </div>

              {notice && (
                <p className="mt-3 text-xs font-medium text-rose-600">{notice}</p>
              )}

              {upload && <UploadStatus upload={upload} onDismiss={() => setUpload(null)} onReview={() => navigate('/crm/call-recordings')} />}

              <div className="mt-7 w-full">
                <QuickActions onSend={(text) => void send(text)} onPrefill={prefill} disabled={busy} />
              </div>

              <p className="mt-7 max-w-md text-center text-[11px] leading-relaxed text-slate-400">
                Answers come from your own CRM data only. What the assistant can change
                depends on your role — the same permissions you have everywhere else.
              </p>
            </div>
          ) : (
            /* ── Conversation ──────────────────────────────────────────── */
            <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col">
              <div className="flex-1 space-y-6 py-6">
                {turns.map((turn) => (
                  turn.role === 'user' ? (
                    <div key={turn.id} className="flex justify-end">
                      <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-indigo-600 px-4 py-2.5 text-[15px] text-white shadow-sm">
                        {turn.text}
                      </p>
                    </div>
                  ) : (
                    <div key={turn.id} className="flex gap-3">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 shadow-sm">
                        <Sparkles className="h-3.5 w-3.5 text-white" />
                      </span>
                      <div className="min-w-0 flex-1">
                        {turn.error ? (
                          <p className="flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                            <span>{turn.text}</span>
                          </p>
                        ) : (
                          <>
                            <MarkdownLite text={turn.text} />
                            <EntityCards toolResults={turn.toolResults || []} />
                          </>
                        )}
                      </div>
                    </div>
                  )
                ))}

                {activity && (
                  <div className="flex gap-3" aria-live="polite">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 shadow-sm">
                      <Sparkles className="h-3.5 w-3.5 animate-pulse text-white" />
                    </span>
                    <p className="flex items-center gap-2 pt-1 text-[13px] text-slate-500">
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
                  </div>
                )}

                {upload && <UploadStatus upload={upload} onDismiss={() => setUpload(null)} onReview={() => navigate('/crm/call-recordings')} />}

                <div ref={bottomRef} />
              </div>

              {/* Sticky rather than fixed: it needs no viewport-height maths and
                  cannot collide with the mobile tab bar. */}
              <div className="sticky bottom-0 -mx-3 bg-gradient-to-t from-indigo-50 via-indigo-50/95 to-transparent px-3 pb-4 pt-6 sm:mx-0 sm:px-0">
                <Composer
                  value={input}
                  onChange={setInput}
                  onSubmit={() => void send(input)}
                  onStop={stop}
                  busy={busy}
                  plusOpen={plusOpen}
                  onPlusOpenChange={setPlusOpen}
                  onUploadRecording={() => fileInputRef.current?.click()}
                  onNavigate={navigate}
                  inputRef={inputRef}
                  placeholder="Reply, or ask something else…"
                />
                {notice && <p className="mt-2 text-xs font-medium text-rose-600">{notice}</p>}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

/** Upload progress for the call-recording flow, shown wherever the chat is. */
function UploadStatus({
  upload,
  onDismiss,
  onReview,
}: {
  upload: UploadState;
  onDismiss: () => void;
  onReview: () => void;
}) {
  const failed = upload.status === 'error';
  const done = upload.status === 'done';

  return (
    <div
      className={`mt-4 w-full rounded-2xl border px-4 py-3 ${
        failed ? 'border-rose-200 bg-rose-50' : 'border-slate-200 bg-white/80'
      }`}
    >
      <div className="flex items-center gap-3">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
          failed ? 'bg-rose-100 text-rose-600' : done ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-50 text-indigo-600'
        }`}
        >
          {failed ? <AlertCircle className="h-4 w-4" />
            : done ? <CheckCircle2 className="h-4 w-4" />
              : upload.status === 'processing' ? <Loader2 className="h-4 w-4 animate-spin" />
                : <UploadCloud className="h-4 w-4" />}
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-slate-800">{upload.filename}</p>
          <p className="truncate text-[11px] text-slate-500">
            {failed ? upload.error
              : done ? 'Queued — we will transcribe it and suggest CRM updates for your approval.'
                : upload.status === 'processing' ? 'Finishing up…'
                  : `Uploading… ${upload.percent}%`}
          </p>
        </div>

        {done && (
          <button
            type="button"
            onClick={onReview}
            className="shrink-0 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-[11px] font-semibold text-white transition-opacity hover:opacity-90"
          >
            Review
          </button>
        )}
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss upload status"
          className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {upload.status === 'uploading' && (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-indigo-500 transition-all duration-200"
            style={{ width: `${upload.percent}%` }}
          />
        </div>
      )}
    </div>
  );
}
