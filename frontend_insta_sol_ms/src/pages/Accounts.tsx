import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle, AtSign, Check, Plus, RefreshCw, X } from 'lucide-react';
import { disconnectAccount, getAccounts, startInstagramConnect, syncAccount } from '../api/insta';
import { ApiError } from '../api/client';
import type { InstagramAccount } from '../api/types';
import { useApi } from '../lib/useApi';
import { cn, formatDate, formatDateTime, formatNumber, formatRelative } from '../lib/format';
import { accountHealth } from '../lib/accountHealth';
import { Badge, ToneDot } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { PageHeader } from '../components/PageHeader';
import { SkeletonRows, Spinner } from '../components/Spinner';

/**
 * Instagram Business Login. "Connect Instagram" asks the API for Instagram's
 * consent URL and sends the browser there; Instagram sends it back to the API,
 * which stores the token and redirects here with ?connected= or ?error=.
 */

function describe(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.details ? `${err.message} — ${err.details}` : err.message;
  return err instanceof Error ? err.message : fallback;
}

export default function Accounts() {
  const location = useLocation();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useApi((signal) => getAccounts(signal), ['accounts']);

  const [outcome] = useState(() => {
    const params = new URLSearchParams(location.search);
    return { connected: params.get('connected'), error: params.get('error') };
  });
  const [connecting, setConnecting] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Drop ?connected / ?error from the address bar once read, so a refresh does
  // not repeat the banner.
  useEffect(() => {
    if (outcome.connected || outcome.error) navigate('/accounts', { replace: true });
  }, [outcome, navigate]);

  const accounts = data?.accounts ?? [];
  const configured = data?.instagramConfigured ?? true;

  async function connect() {
    setConnecting(true);
    setActionError(null);
    try {
      window.location.assign(await startInstagramConnect());
    } catch (err) {
      setActionError(describe(err, 'Could not start the Instagram connection.'));
      setConnecting(false);
    }
  }

  async function sync(account: InstagramAccount) {
    setBusy(account.igUserId);
    setActionError(null);
    setNotice(null);
    try {
      const res = await syncAccount(account.igUserId);
      const errors = res.summary.errors ?? [];
      if (errors.length) {
        setActionError(errors.map((e) => e.message).join(' '));
      } else {
        setNotice(`@${account.username ?? account.igUserId} synced. New DMs are analysed and qualified leads go to the CRM.`);
      }
      reload();
    } catch (err) {
      setActionError(describe(err, 'Sync failed.'));
    } finally {
      setBusy(null);
    }
  }

  async function disconnect(account: InstagramAccount) {
    const label = account.username ? `@${account.username}` : account.igUserId;
    if (!window.confirm(`Disconnect ${label}? Syncing stops. Conversations and enquiries already captured are kept.`)) return;
    setBusy(account.igUserId);
    setActionError(null);
    try {
      await disconnectAccount(account.igUserId);
      reload();
    } catch (err) {
      setActionError(describe(err, 'Could not disconnect the account.'));
    } finally {
      setBusy(null);
    }
  }

  const connectButton = (label = 'Connect Instagram') => (
    <button
      type="button"
      onClick={connect}
      disabled={connecting || !configured}
      className="inline-flex min-h-touch items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-light focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 disabled:opacity-60"
    >
      {connecting ? <Spinner className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
      {label}
    </button>
  );

  return (
    <div>
      <PageHeader
        title="Instagram accounts"
        description="Connect the agency's Instagram professional account. DMs are read, scored and turned into CRM leads; replies go out only when you send them, inside Instagram's 24-hour window."
        onRefresh={reload}
        refreshing={loading}
        actions={connectButton()}
      />

      {outcome.connected ? (
        <Banner tone="success" icon={<Check className="h-4 w-4" />}>
          @{outcome.connected} is connected. The first DM sync runs within a few minutes, or press “Sync now”.
        </Banner>
      ) : null}
      {outcome.error ? (
        <Banner tone="danger" icon={<AlertTriangle className="h-4 w-4" />}>
          Instagram connection failed: {outcome.error}
        </Banner>
      ) : null}
      {data?.killSwitch ? (
        <Banner tone="danger" icon={<AlertTriangle className="h-4 w-4" />}>
          Sending is paused on this environment (kill switch). DMs are still read and analysed.
        </Banner>
      ) : data?.dryRunSends ? (
        <Banner tone="warning" icon={<AlertTriangle className="h-4 w-4" />}>
          Test mode: replies and keyword-rule DMs are recorded here but not sent to Instagram.
        </Banner>
      ) : null}
      {notice ? <Banner tone="success">{notice}</Banner> : null}
      {actionError ? <Banner tone="danger">{actionError}</Banner> : null}

      {error ? (
        <ErrorState error={error} onRetry={reload} context="your Instagram accounts" />
      ) : loading && !data ? (
        <SkeletonRows rows={2} />
      ) : !configured ? (
        <EmptyState
          title="The Instagram app is not set up on this environment"
          description="An administrator needs to add the Instagram App ID, App Secret, webhook verify token and token encryption key to the backend configuration."
          icon={<AtSign className="h-5 w-5" />}
        />
      ) : accounts.length === 0 ? (
        <EmptyState
          title="No Instagram account connected"
          description="You will sign in on Instagram and approve access to messages and comments. The account must be a Business or Creator account."
          icon={<AtSign className="h-5 w-5" />}
          action={connectButton('Connect your first account')}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {accounts.map((account) => (
            <AccountCard
              key={account.igUserId}
              account={account}
              busy={busy === account.igUserId}
              connecting={connecting}
              onSync={() => sync(account)}
              onReconnect={connect}
              onDisconnect={() => disconnect(account)}
            />
          ))}
        </div>
      )}

      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
        <h2 className="text-sm font-semibold text-ink">Before Meta approves the app</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Each Instagram account must be added as an Instagram Tester in the Meta app and accept the invite (Instagram → Settings → Apps and websites → Tester invites).</li>
          <li>DMs are picked up by a sync every few minutes. Once the app is Live, webhooks deliver them in seconds — nothing changes here.</li>
          <li>Instagram only shares the 20 most recent messages of each conversation, plus everything that arrives after connecting.</li>
        </ul>
      </section>
    </div>
  );
}

function Banner({ tone, icon, children }: { tone: 'success' | 'warning' | 'danger'; icon?: React.ReactNode; children: React.ReactNode }) {
  const styles = {
    success: 'border-green-200 bg-green-50 text-green-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
    danger: 'border-red-200 bg-red-50 text-red-800',
  }[tone];
  return (
    <p role={tone === 'danger' ? 'alert' : 'status'} className={cn('mb-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-sm', styles)}>
      {icon ? <span className="mt-0.5 shrink-0">{icon}</span> : null}
      <span>{children}</span>
    </p>
  );
}

function AccountCard({
  account,
  busy,
  connecting,
  onSync,
  onReconnect,
  onDisconnect,
}: {
  account: InstagramAccount;
  busy: boolean;
  connecting: boolean;
  onSync: () => void;
  onReconnect: () => void;
  onDisconnect: () => void;
}) {
  const health = accountHealth(account);
  const connected = account.status === 'connected';

  return (
    <div className={cn('rounded-xl border bg-white p-4 shadow-sm', health.tone === 'danger' ? 'border-red-200' : 'border-slate-200')}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {account.profilePictureUrl ? (
            <img src={account.profilePictureUrl} alt="" className="h-11 w-11 shrink-0 rounded-full border border-slate-200 object-cover" />
          ) : (
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <AtSign className="h-5 w-5" />
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">@{account.username ?? account.igUserId}</p>
            <p className="truncate text-xs text-slate-500">{account.name || account.accountType || 'Instagram professional account'}</p>
          </div>
        </div>
        <Badge tone={health.tone}>
          <ToneDot tone={health.tone} />
          {health.label}
        </Badge>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
        <Stat label="Followers" value={formatNumber(account.followersCount ?? 0)} />
        <Stat label="Following" value={formatNumber(account.followsCount ?? 0)} />
        <Stat label="Posts" value={formatNumber(account.mediaCount ?? 0)} />
      </dl>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <Detail label="Last DM sync" value={formatRelative(account.lastConversationsSyncAt)} title={formatDateTime(account.lastConversationsSyncAt)} />
        <Detail
          label="DM delivery"
          value={account.lastWebhookAt ? `Live webhooks (${formatRelative(account.lastWebhookAt)})` : account.webhookSubscribed ? 'Subscribed · polling until Live' : 'Polling'}
          title={account.webhookError ?? undefined}
        />
        <Detail label="Connected" value={formatDate(account.connectedAt)} />
        <Detail label="Access valid until" value={formatDate(account.tokenExpiresAt)} />
      </dl>

      {health.detail ? (
        <p className={cn('mt-3 rounded-lg px-3 py-2 text-xs', health.tone === 'danger' ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-800')}>
          {health.detail}
        </p>
      ) : null}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        {connected ? (
          <button
            type="button"
            onClick={onSync}
            disabled={busy}
            className="inline-flex min-h-touch flex-1 items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-brand hover:text-brand disabled:opacity-60"
          >
            {busy ? <Spinner className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
            Sync now
          </button>
        ) : (
          <button
            type="button"
            onClick={onReconnect}
            disabled={connecting}
            className="inline-flex min-h-touch flex-1 items-center justify-center gap-2 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-light disabled:opacity-60"
          >
            {connecting ? <Spinner className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
            Reconnect
          </button>
        )}
        {account.status !== 'disconnected' ? (
          <button
            type="button"
            onClick={onDisconnect}
            disabled={busy}
            className="inline-flex min-h-touch items-center justify-center gap-2 rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-danger transition hover:bg-red-50 disabled:opacity-60"
          >
            <X className="h-4 w-4" />
            Disconnect
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-slate-400">{label}</dt>
      <dd className="font-medium tabular-nums text-ink">{value}</dd>
    </div>
  );
}

function Detail({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-slate-400">{label}</dt>
      <dd className="truncate text-slate-700" title={title}>
        {value}
      </dd>
    </div>
  );
}
