import { useState, type ReactNode } from 'react';
import { Pencil, Plus, Trash2, Zap } from 'lucide-react';
import { deleteRule, getRules, saveRule } from '../api/insta';
import { ApiError } from '../api/client';
import { RULE_MATCH_TYPES, type Rule, type RuleInput, type RuleMatchType } from '../api/types';
import { useApi } from '../lib/useApi';
import { cn, formatDate, humanise } from '../lib/format';
import { Badge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { PageHeader } from '../components/PageHeader';
import { SkeletonRows, Spinner } from '../components/Spinner';

/**
 * F1 — comment keyword to auto-DM rules.
 *
 * The contract exposes GET, POST and DELETE on /rules but no PATCH, so editing
 * and the enable/disable switch both POST the whole rule back with its existing
 * `ruleId`, i.e. the backend must treat POST /rules as an upsert. That is the
 * one place this app assumes behaviour the contract does not spell out; if the
 * backend chooses insert-only, change this to delete-then-create.
 */

const EMPTY_DRAFT: RuleInput = {
  keyword: '',
  matchType: 'contains',
  publicReply: '',
  dmMessage: '',
  mediaScope: 'all',
  enabled: true,
};

export default function Rules() {
  const { data, loading, error, reload } = useApi((signal) => getRules(signal), ['rules']);
  const [draft, setDraft] = useState<RuleInput | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const rules = data?.rules ?? [];

  function describeError(err: unknown, fallback: string): string {
    if (err instanceof ApiError) {
      return err.details ? `${err.message} — ${err.details}` : err.message;
    }
    return fallback;
  }

  async function submit(input: RuleInput) {
    if (!input.keyword.trim()) {
      setSaveError('A keyword is required — that is what people type in the comments.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await saveRule({ ...input, keyword: input.keyword.trim() });
      setDraft(null);
      reload();
    } catch (err) {
      setSaveError(describeError(err, 'Could not save that rule.'));
    } finally {
      setSaving(false);
    }
  }

  async function toggle(rule: Rule) {
    setBusyId(rule.ruleId);
    setSaveError(null);
    try {
      await saveRule({
        ruleId: rule.ruleId,
        keyword: rule.keyword,
        matchType: rule.matchType,
        publicReply: rule.publicReply,
        dmMessage: rule.dmMessage,
        mediaScope: rule.mediaScope,
        enabled: !(rule.enabled ?? true),
      });
      reload();
    } catch (err) {
      setSaveError(describeError(err, 'Could not change that rule.'));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(rule: Rule) {
    const label = rule.keyword || 'this rule';
    if (!window.confirm(`Delete the "${label}" rule? Comments matching it stop getting a DM.`)) {
      return;
    }
    setBusyId(rule.ruleId);
    setSaveError(null);
    try {
      await deleteRule(rule.ruleId);
      reload();
    } catch (err) {
      setSaveError(describeError(err, 'Could not delete that rule.'));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Keyword rules"
        description="Someone comments your keyword, they get a public reply and a real DM within minutes. This is the ManyChat replacement."
        onRefresh={reload}
        refreshing={loading}
        actions={
          <button
            type="button"
            onClick={() => {
              setSaveError(null);
              setDraft({ ...EMPTY_DRAFT });
            }}
            className="inline-flex min-h-touch items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-light focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2"
          >
            <Plus className="h-4 w-4" />
            New rule
          </button>
        }
      />

      {saveError ? (
        <p
          role="alert"
          className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {saveError}
        </p>
      ) : null}

      {draft ? (
        <RuleForm
          draft={draft}
          saving={saving}
          onChange={setDraft}
          onCancel={() => {
            setDraft(null);
            setSaveError(null);
          }}
          onSubmit={() => submit(draft)}
        />
      ) : null}

      {error ? (
        <ErrorState error={error} onRetry={reload} context="your keyword rules" />
      ) : loading && !data ? (
        <SkeletonRows rows={3} />
      ) : rules.length === 0 ? (
        !draft ? (
          <EmptyState
            title="No keyword rules yet"
            description={'Add one for the word you already ask for in captions — "PRICE", "RATE", "DETAILS" — and every commenter gets a DM instead of the four you reply to by hand.'}
            icon={<Zap className="h-5 w-5" />}
            action={
              <button
                type="button"
                onClick={() => setDraft({ ...EMPTY_DRAFT })}
                className="inline-flex min-h-touch items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-light"
              >
                <Plus className="h-4 w-4" />
                Create your first rule
              </button>
            }
          />
        ) : null
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {rules.map((rule) => {
            const enabled = rule.enabled ?? true;
            const busy = busyId === rule.ruleId;
            return (
              <div
                key={rule.ruleId}
                className={cn(
                  'rounded-xl border bg-white p-4 shadow-sm transition',
                  enabled ? 'border-slate-200' : 'border-slate-200 opacity-70',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-sm font-semibold text-ink">
                        {rule.keyword}
                      </span>
                      <Badge tone="neutral">{humanise(rule.matchType ?? 'contains')}</Badge>
                      <Badge tone={enabled ? 'success' : 'neutral'}>
                        {enabled ? 'live' : 'paused'}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      {rule.mediaScope && rule.mediaScope !== 'all'
                        ? `Only on ${rule.mediaScope}`
                        : 'On every post'}
                      {rule.createdAt ? ` · added ${formatDate(rule.createdAt)}` : ''}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    {busy ? <Spinner className="h-4 w-4" /> : null}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setSaveError(null);
                        setDraft({
                          ruleId: rule.ruleId,
                          keyword: rule.keyword,
                          matchType: rule.matchType ?? 'contains',
                          publicReply: rule.publicReply ?? '',
                          dmMessage: rule.dmMessage ?? '',
                          mediaScope: rule.mediaScope ?? 'all',
                          enabled,
                        });
                      }}
                      aria-label={`Edit the ${rule.keyword} rule`}
                      className="inline-flex h-touch w-touch items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-brand disabled:opacity-50"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => remove(rule)}
                      aria-label={`Delete the ${rule.keyword} rule`}
                      className="inline-flex h-touch w-touch items-center justify-center rounded-lg text-slate-500 transition hover:bg-red-50 hover:text-danger disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <dl className="mt-3 space-y-2 text-sm">
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      Public reply
                    </dt>
                    <dd className="text-slate-700">
                      {rule.publicReply || (
                        <span className="text-slate-400">none — comment is not replied to</span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      DM sent
                    </dt>
                    <dd className="text-slate-700">
                      {rule.dmMessage || <span className="text-slate-400">none</span>}
                    </dd>
                  </div>
                </dl>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => toggle(rule)}
                  className="mt-3 min-h-touch w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-brand hover:text-brand disabled:opacity-50"
                >
                  {enabled ? 'Pause this rule' : 'Turn this rule on'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

interface RuleFormProps {
  draft: RuleInput;
  saving: boolean;
  onChange: (next: RuleInput) => void;
  onCancel: () => void;
  onSubmit: () => void;
}

function RuleForm({ draft, saving, onChange, onCancel, onSubmit }: RuleFormProps) {
  const set = <K extends keyof RuleInput>(key: K, value: RuleInput[K]) =>
    onChange({ ...draft, [key]: value });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      className="mb-4 rounded-xl border border-brand/30 bg-blue-50/40 p-4"
    >
      <h2 className="text-sm font-semibold text-ink">
        {draft.ruleId ? 'Edit rule' : 'New keyword rule'}
      </h2>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Keyword" hint="What people type in the comments.">
          <input
            value={draft.keyword}
            onChange={(event) => set('keyword', event.target.value)}
            placeholder="PRICE"
            required
            className="min-h-touch w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </Field>

        <Field label="Match type">
          <select
            value={draft.matchType ?? 'contains'}
            onChange={(event) => set('matchType', event.target.value as RuleMatchType)}
            className="min-h-touch w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm capitalize focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand"
          >
            {RULE_MATCH_TYPES.map((value) => (
              <option key={value} value={value}>
                {humanise(value)}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Public reply"
          hint="Posted under their comment, so everyone scrolling sees you answered."
        >
          <input
            value={draft.publicReply ?? ''}
            onChange={(event) => set('publicReply', event.target.value)}
            placeholder="DM kiya hai! 📩"
            className="min-h-touch w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </Field>

        <Field label="Applies to" hint="A media ID, or leave as `all` for every post.">
          <input
            value={draft.mediaScope ?? 'all'}
            onChange={(event) => set('mediaScope', event.target.value)}
            placeholder="all"
            className="min-h-touch w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </Field>

        <div className="sm:col-span-2">
          <Field
            label="DM message"
            hint="The private reply that opens the conversation. Hinglish works best."
          >
            <textarea
              value={draft.dmMessage ?? ''}
              onChange={(event) => set('dmMessage', event.target.value)}
              rows={3}
              placeholder="Hi! Ye 2BHK Andheri West me hai, ₹1.4 Cr. Aapka budget kitna hai?"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </Field>
        </div>
      </div>

      <label className="mt-3 flex min-h-touch items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={draft.enabled ?? true}
          onChange={(event) => set('enabled', event.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
        />
        Live as soon as it is saved
      </label>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex min-h-touch items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-light disabled:opacity-60"
        >
          {saving ? <Spinner className="h-4 w-4" /> : null}
          {draft.ruleId ? 'Save changes' : 'Create rule'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-touch rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-slate-400">{hint}</span> : null}
    </label>
  );
}
