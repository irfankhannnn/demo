import { useState } from 'react';
import { ExternalLink, Globe, Lock, MessageCircle, Send } from 'lucide-react';
import { getComments, replyToComment } from '../api/insta';
import { ApiError } from '../api/client';
import type { CommentReplyMode, InstagramComment } from '../api/types';
import { useApi } from '../lib/useApi';
import { cn, formatDateTime, formatRelative, truncate } from '../lib/format';
import { Badge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { PageHeader } from '../components/PageHeader';
import { SkeletonRows, Spinner } from '../components/Spinner';

/**
 * Comments on the connected accounts' posts, newest first. A person can answer
 * each one publicly under the post, or privately as a DM - Instagram allows one
 * private reply per comment, within 7 days of it, and this page says so rather
 * than offering a button that will fail.
 */

const MAX_CHARS = 1000;

function describe(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.details ? `${err.message} — ${err.details}` : err.message;
  return fallback;
}

const RULE_OUTCOME: Record<string, { label: string; tone: 'success' | 'info' | 'warning' | 'danger' }> = {
  replied: { label: 'Keyword rule replied', tone: 'success' },
  dry_run: { label: 'Keyword rule · test mode', tone: 'info' },
  paused: { label: 'Keyword rule paused', tone: 'warning' },
  rate_capped: { label: 'Hourly reply cap reached', tone: 'warning' },
  failed: { label: 'Keyword rule failed', tone: 'danger' },
};

export default function Comments() {
  const { data, loading, error, reload } = useApi((signal) => getComments({}, signal), ['comments']);
  const [openId, setOpenId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const comments = data?.comments ?? [];

  return (
    <div>
      <PageHeader
        title="Comments"
        description="Comments on your newest posts. Reply publicly under the post, or send the commenter a private DM."
        onRefresh={reload}
        refreshing={loading}
      />

      {notice ? (
        <p role="status" className="mb-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          {notice}
        </p>
      ) : null}

      {error && !data ? (
        <ErrorState error={error} onRetry={reload} context="comments" />
      ) : !data ? (
        <SkeletonRows rows={4} />
      ) : comments.length === 0 ? (
        <EmptyState
          title="No comments synced yet"
          description="Comments on your 10 newest posts are picked up every few minutes, or straight away with Sync now on the Instagram accounts screen."
          icon={<MessageCircle className="h-5 w-5" />}
        />
      ) : (
        <ul className="flex flex-col gap-3" aria-label="Comments">
          {comments.map((comment) => (
            <CommentCard
              key={comment.commentId}
              comment={comment}
              open={openId === comment.commentId}
              onToggle={() => setOpenId(openId === comment.commentId ? null : comment.commentId)}
              onReplied={(message) => {
                setNotice(message);
                setOpenId(null);
                reload();
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

interface CommentCardProps {
  comment: InstagramComment;
  open: boolean;
  onToggle: () => void;
  onReplied: (message: string) => void;
}

function CommentCard({ comment, open, onToggle, onReplied }: CommentCardProps) {
  const [mode, setMode] = useState<CommentReplyMode>('public');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const who = comment.fromUsername ? `@${comment.fromUsername}` : 'An Instagram user';
  const outcome = comment.status ? RULE_OUTCOME[comment.status] : undefined;
  const blocked = mode === 'private' && !comment.privateReplyAllowed;

  async function send() {
    const text = draft.trim();
    if (!text || blocked) return;
    setSending(true);
    setFailure(null);
    try {
      const res = await replyToComment(comment.commentId, text, mode);
      setDraft('');
      onReplied(
        res.status === 'dry_run'
          ? 'Test mode: the reply was recorded but not sent to Instagram.'
          : mode === 'public'
            ? `Replied publicly to ${who}.`
            : `Sent ${who} a private reply. The conversation is in the DM inbox.`,
      );
    } catch (err) {
      setFailure(describe(err, 'Could not send the reply.'));
    } finally {
      setSending(false);
    }
  }

  return (
    <li className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-ink">{who}</span>
        <span className="text-xs text-slate-500" title={formatDateTime(comment.createdAt)}>
          {formatRelative(comment.createdAt)}
        </span>
        {outcome ? <Badge tone={outcome.tone}>{outcome.label}</Badge> : null}
      </div>

      <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-800">{comment.text || <em className="text-slate-400">[no text]</em>}</p>

      {comment.media ? (
        <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
          On “{truncate(comment.media.caption || 'a post', 70)}”
          {comment.media.permalink ? (
            <a
              href={comment.media.permalink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-brand hover:underline"
            >
              Open post
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : null}
        </p>
      ) : null}

      {comment.lastReply ? (
        <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          You replied {comment.lastReply.mode === 'public' ? 'publicly' : 'privately'} {formatRelative(comment.lastReply.at)}
          {comment.lastReply.status === 'dry_run' ? ' · test mode, not sent' : ''}: “{truncate(comment.lastReply.text, 120)}”
        </p>
      ) : null}

      {!open ? (
        <button
          type="button"
          onClick={onToggle}
          className="mt-3 inline-flex min-h-touch items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:border-brand hover:text-brand"
        >
          <MessageCircle className="h-4 w-4" />
          Reply
        </button>
      ) : (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <div role="radiogroup" aria-label="Reply type" className="mb-2 flex flex-wrap gap-2">
            <ModeButton active={mode === 'public'} onClick={() => setMode('public')} icon={<Globe className="h-4 w-4" />}>
              Public reply
            </ModeButton>
            <ModeButton active={mode === 'private'} onClick={() => setMode('private')} icon={<Lock className="h-4 w-4" />}>
              Private DM
            </ModeButton>
          </div>

          {blocked ? (
            <p className="mb-2 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">
              A private reply is not possible: {comment.privateReplyReason}.
            </p>
          ) : null}
          {failure ? (
            <p role="alert" className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
              {failure}
            </p>
          ) : null}

          <label htmlFor={`reply-${comment.commentId}`} className="sr-only">
            Reply to {who}
          </label>
          <textarea
            id={`reply-${comment.commentId}`}
            value={draft}
            onChange={(event) => setDraft(event.target.value.slice(0, MAX_CHARS))}
            disabled={blocked || sending}
            rows={3}
            placeholder={mode === 'public' ? 'Write a public reply…' : 'Write a private message…'}
            className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand disabled:bg-slate-50"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onToggle}
              className="inline-flex min-h-touch items-center rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:text-ink"
            >
              Cancel
            </button>
            <span className="ml-auto text-xs tabular-nums text-slate-400">
              {draft.length}/{MAX_CHARS}
            </span>
            <button
              type="button"
              onClick={send}
              disabled={blocked || sending || !draft.trim()}
              className="inline-flex min-h-touch items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-light disabled:opacity-60"
            >
              {sending ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />}
              Send
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function ModeButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: JSX.Element;
  children: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        'inline-flex min-h-touch items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition',
        active ? 'border-brand bg-brand/10 text-brand' : 'border-slate-300 text-slate-700 hover:border-brand hover:text-brand',
      )}
    >
      {icon}
      {children}
    </button>
  );
}
