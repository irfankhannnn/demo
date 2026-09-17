/**
 * Agency policy documents.
 *
 * What is written here is read aloud to customers by the AI voice agent on
 * recorded calls, and answers the same questions in WhatsApp and web chat. The
 * page is shaped around that: it says so plainly, it shows how each document
 * will be split for retrieval, and it never lets a failed index look like a
 * successful save.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, BookText, Check, ChevronDown, ChevronRight,
  Loader2, Plus, RefreshCw, Save, Trash2,
} from 'lucide-react';
import Toast from '../../components/Toast';
import {
  agencyPoliciesApi,
  PoliciesUnavailableError,
  type AgencyPolicy,
  type PolicyCategory,
  type PolicyMeta,
} from '../../services/agencyPoliciesApi';

const CATEGORY_LABELS: Record<PolicyCategory, string> = {
  policies: 'Policies & rules',
  faq: 'Common questions',
  pricing: 'Pricing & charges',
  agency_info: 'About the agency',
};

const CATEGORY_HINTS: Record<PolicyCategory, string> = {
  policies: 'Deposits, notice periods, pets, maintenance, house rules.',
  faq: 'Questions customers ask again and again.',
  pricing: 'Brokerage, GST, registration and other charges.',
  agency_info: 'Office hours, areas served, how you work.',
};

/** Mirrors the server's paragraph rule closely enough to preview the split. */
function previewChunkCount(content: string): number {
  const paragraphs = content
    .split(/\n\s*\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (paragraphs.length <= 1) return content.trim() ? 1 : 0;
  // Headings attach to the rule they introduce rather than standing alone.
  return paragraphs.filter((p) => !(p.length <= 100 && !/[.!?]$/.test(p))).length || 1;
}

function blankPolicy(): AgencyPolicy {
  return {
    // Left empty so the server mints the id; a client-side id would risk
    // colliding with an existing document's chunk keys.
    policyId: '',
    title: '',
    category: 'policies',
    content: '',
  };
}

export default function AgencyPolicies() {
  const navigate = useNavigate();

  const [policies, setPolicies] = useState<AgencyPolicy[]>([]);
  const [meta, setMeta] = useState<PolicyMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(0);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, metaResult] = await Promise.all([
        agencyPoliciesApi.list(),
        agencyPoliciesApi.getMeta().catch(() => null),
      ]);
      setPolicies(list);
      setMeta(metaResult);
      setExpanded(list.length ? 0 : null);
      setDirty(false);
    } catch (err) {
      if (err instanceof PoliciesUnavailableError) setUnavailable(true);
      else setError(err instanceof Error ? err.message : 'Failed to load policies');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // A half-written policy is easy to lose by hitting back out of habit.
  useEffect(() => {
    if (!dirty) return undefined;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const maxChars = meta?.maxPolicyChars ?? 20000;
  const maxPolicies = meta?.maxPolicies ?? 50;

  const totalChunks = useMemo(
    () => policies.reduce((n, p) => n + previewChunkCount(p.content), 0),
    [policies]
  );

  const update = (index: number, patch: Partial<AgencyPolicy>) => {
    setPolicies((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
    setDirty(true);
  };

  const add = () => {
    setPolicies((prev) => [...prev, blankPolicy()]);
    setExpanded(policies.length);
    setDirty(true);
  };

  const remove = (index: number) => {
    setPolicies((prev) => prev.filter((_, i) => i !== index));
    setExpanded(null);
    setDirty(true);
  };

  const validationError = useMemo(() => {
    for (const [i, p] of policies.entries()) {
      if (!p.title.trim()) return `Document ${i + 1} needs a title.`;
      if (!p.content.trim()) return `"${p.title || `Document ${i + 1}`}" has no content.`;
      if (p.content.length > maxChars) {
        return `"${p.title}" is ${p.content.length.toLocaleString()} characters; the limit is ${maxChars.toLocaleString()}. Split it into separate documents.`;
      }
    }
    return null;
  }, [policies, maxChars]);

  const save = async () => {
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError(null);
    setWarning(null);
    try {
      const result = await agencyPoliciesApi.save(policies);
      setPolicies(result.policies);
      setDirty(false);
      if (result.indexingError) {
        // Saved, but the agent cannot quote it yet. Distinct from a failure.
        setWarning(result.warning ?? result.indexingError);
      } else {
        const n = result.indexing?.totalChunks ?? 0;
        setToast(`Saved. ${n} passage${n === 1 ? '' : 's'} indexed for the AI agent.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save policies');
    } finally {
      setSaving(false);
    }
  };

  const reindex = async () => {
    setReindexing(true);
    setWarning(null);
    setError(null);
    try {
      const result = await agencyPoliciesApi.reindex();
      setToast(`Reindexed — ${result.totalChunks} passages are searchable.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reindex failed');
    } finally {
      setReindexing(false);
    }
  };

  if (unavailable) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="max-w-3xl mx-auto p-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 text-slate-700">
            <h1 className="text-xl font-bold text-slate-900 mb-2">Agency policies</h1>
            <p className="text-sm">
              This deployment&apos;s server does not have the policies API yet. It arrives with the
              next backend release.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate('/crm')}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-white"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-2">
              <BookText className="w-7 h-7 text-indigo-600" />
              Agency policies
            </h1>
            <p className="text-slate-600 text-sm mt-1">
              What your AI agent tells customers about deposits, charges and rules — on calls,
              WhatsApp and web chat.
            </p>
          </div>
          <button
            onClick={reindex}
            disabled={reindexing || saving}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-white disabled:opacity-50"
            title="Rebuild the search index from the saved documents"
            aria-label="Reindex"
          >
            {reindexing ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
          </button>
        </div>

        <div className="mb-4 px-4 py-3 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-sm">
          The AI agent answers policy questions <strong>only</strong> from what is written here. If a
          question is not covered, it says it does not know and offers to connect the customer to
          your team — it will not guess.
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span className="flex-1">{error}</span>
          </div>
        )}

        {warning && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span className="flex-1">
              {warning}{' '}
              <button onClick={reindex} className="font-semibold underline hover:text-amber-950">
                Retry indexing
              </button>
            </span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : (
          <>
            {policies.length === 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center mb-4">
                <BookText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-900 font-medium">No policies yet</p>
                <p className="text-slate-600 text-sm mt-1 max-w-md mx-auto">
                  Add your deposit rules, brokerage and common questions. Write one rule per
                  paragraph — each becomes a separately searchable answer.
                </p>
              </div>
            )}

            <div className="space-y-3">
              {policies.map((policy, index) => {
                const isOpen = expanded === index;
                const chunks = previewChunkCount(policy.content);
                const overLimit = policy.content.length > maxChars;

                return (
                  <div
                    key={policy.policyId || `new-${index}`}
                    className="bg-white rounded-xl border border-slate-200 overflow-hidden"
                  >
                    <div className="flex items-center gap-2 px-4 py-3">
                      <button
                        onClick={() => setExpanded(isOpen ? null : index)}
                        className="flex-1 flex items-center gap-2 text-left min-w-0"
                      >
                        {isOpen ? (
                          <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        )}
                        <span className="font-medium text-slate-900 truncate">
                          {policy.title || <span className="text-slate-400">Untitled document</span>}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 flex-shrink-0">
                          {CATEGORY_LABELS[policy.category]}
                        </span>
                        {chunks > 0 && (
                          <span className="text-xs text-slate-400 flex-shrink-0 hidden sm:inline">
                            {chunks} passage{chunks === 1 ? '' : 's'}
                          </span>
                        )}
                      </button>
                      <button
                        onClick={() => remove(index)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                        aria-label={`Delete ${policy.title || 'document'}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {isOpen && (
                      <div className="px-4 pb-4 space-y-3 border-t border-slate-100 pt-3">
                        <div className="grid sm:grid-cols-2 gap-3">
                          <label className="block">
                            <span className="text-xs font-medium text-slate-600">Title</span>
                            <input
                              value={policy.title}
                              onChange={(e) => update(index, { title: e.target.value })}
                              placeholder="e.g. Security deposit policy"
                              className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                            />
                          </label>
                          <label className="block">
                            <span className="text-xs font-medium text-slate-600">Category</span>
                            <select
                              value={policy.category}
                              onChange={(e) =>
                                update(index, { category: e.target.value as PolicyCategory })
                              }
                              className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                            >
                              {(meta?.categories ?? (Object.keys(CATEGORY_LABELS) as PolicyCategory[])).map(
                                (c) => (
                                  <option key={c} value={c}>
                                    {CATEGORY_LABELS[c]}
                                  </option>
                                )
                              )}
                            </select>
                            <span className="text-xs text-slate-400 mt-1 block">
                              {CATEGORY_HINTS[policy.category]}
                            </span>
                          </label>
                        </div>

                        <label className="block">
                          <span className="text-xs font-medium text-slate-600">
                            Content — one rule per paragraph
                          </span>
                          <textarea
                            value={policy.content}
                            onChange={(e) => update(index, { content: e.target.value })}
                            rows={10}
                            placeholder={
                              'Tenants pay a security deposit of two months rent before moving in.\n\nThe deposit is refunded within 30 days of vacating, less any damages.\n\nBrokerage is one month rent plus GST, payable at agreement signing.'
                            }
                            className={`mt-1 w-full px-3 py-2 rounded-lg border text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 ${
                              overLimit
                                ? 'border-red-300 focus:ring-red-500/30'
                                : 'border-slate-200 focus:ring-indigo-500/30'
                            }`}
                          />
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-xs text-slate-500">
                              Blank line between rules. Each paragraph is searched separately, so the
                              agent can answer one question without reciting the rest.
                            </span>
                            <span
                              className={`text-xs tabular-nums flex-shrink-0 ml-3 ${
                                overLimit ? 'text-red-600 font-medium' : 'text-slate-400'
                              }`}
                            >
                              {policy.content.length.toLocaleString()} / {maxChars.toLocaleString()}
                            </span>
                          </div>
                        </label>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mt-4">
              <button
                onClick={add}
                disabled={policies.length >= maxPolicies}
                className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add document
              </button>

              <span className="text-xs text-slate-500 sm:ml-auto">
                {policies.length} document{policies.length === 1 ? '' : 's'} · ~{totalChunks} searchable
                passage{totalChunks === 1 ? '' : 's'}
              </span>

              <button
                onClick={save}
                disabled={saving || !dirty || !!validationError}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
                title={validationError ?? undefined}
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : dirty ? (
                  <Save className="w-4 h-4" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                {saving ? 'Saving…' : dirty ? 'Save & index' : 'Saved'}
              </button>
            </div>

            {validationError && dirty && (
              <p className="text-xs text-red-600 mt-2 text-right">{validationError}</p>
            )}
          </>
        )}
      </div>

      {toast && <Toast message={toast} type="success" onClose={() => setToast(null)} />}
    </div>
  );
}
