import { useEffect, useState } from 'react';
import { Check, Copy, Laptop, Plus, X } from 'lucide-react';
import { createPairingCode, getAccounts, getDevices, revokeDevice } from '../api/insta';
import { ApiError } from '../api/client';
import type { Device, PairingCodeResponse } from '../api/types';
import { useApi } from '../lib/useApi';
import { cn, formatDateTime, formatNumber, formatRelative } from '../lib/format';
import { deviceHealth } from '../lib/deviceHealth';
import { Badge, ToneDot } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { PageHeader } from '../components/PageHeader';
import { SkeletonRows, Spinner } from '../components/Spinner';

/**
 * Pairing, per contract section 2b: the frontend asks for a code, the owner
 * types `ig-agent pair <code>` on the laptop, and the laptop trades that code
 * for a device secret it keeps in the OS keychain. The code is single-use with
 * a 15-minute TTL, so the dialog shows a live countdown.
 */

export default function Devices() {
  const devices = useApi((signal) => getDevices(signal), ['devices']);
  const accounts = useApi((signal) => getAccounts(signal), ['accounts']);

  const [pairing, setPairing] = useState<PairingCodeResponse | null>(null);
  const [pairingBusy, setPairingBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  const deviceList = devices.data?.devices ?? [];
  const accountList = accounts.data?.accounts ?? [];

  function describeError(err: unknown, fallback: string): string {
    if (err instanceof ApiError) {
      return err.details ? `${err.message} — ${err.details}` : err.message;
    }
    return fallback;
  }

  async function startPairing() {
    setPairingBusy(true);
    setActionError(null);
    try {
      setPairing(await createPairingCode());
    } catch (err) {
      setActionError(describeError(err, 'Could not create a pairing code.'));
    } finally {
      setPairingBusy(false);
    }
  }

  async function revoke(device: Device) {
    const label = device.deviceName || device.deviceId;
    if (
      !window.confirm(
        `Revoke "${label}"? That laptop stops syncing immediately and has to be paired again.`,
      )
    ) {
      return;
    }
    setRevoking(device.deviceId);
    setActionError(null);
    try {
      await revokeDevice(device.deviceId);
      devices.reload();
      accounts.reload();
    } catch (err) {
      setActionError(describeError(err, 'Could not revoke that laptop.'));
    } finally {
      setRevoking(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Paired laptops"
        description="The agent runs on your own machine. Your Instagram token never leaves it — only the counts and enquiries are synced here."
        onRefresh={() => {
          devices.reload();
          accounts.reload();
        }}
        refreshing={devices.loading || accounts.loading}
        actions={
          <button
            type="button"
            onClick={startPairing}
            disabled={pairingBusy}
            className="inline-flex min-h-touch items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-light focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 disabled:opacity-60"
          >
            {pairingBusy ? <Spinner className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            Pair a laptop
          </button>
        }
      />

      {actionError ? (
        <p
          role="alert"
          className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {actionError}
        </p>
      ) : null}

      {pairing ? (
        <PairingDialog pairing={pairing} onClose={() => setPairing(null)} />
      ) : null}

      {devices.error ? (
        <ErrorState
          error={devices.error}
          onRetry={devices.reload}
          context="your paired laptops"
        />
      ) : devices.loading && !devices.data ? (
        <SkeletonRows rows={3} />
      ) : deviceList.length === 0 ? (
        <EmptyState
          title="No laptop is paired"
          description="Install the agent on the machine you already use for Instagram, then pair it here. Nothing on this console has data until one is running."
          icon={<Laptop className="h-5 w-5" />}
          action={
            <button
              type="button"
              onClick={startPairing}
              disabled={pairingBusy}
              className="inline-flex min-h-touch items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-light disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              Pair a laptop
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {deviceList.map((device) => {
            const health = deviceHealth(device);
            const busy = revoking === device.deviceId;
            const revoked = health.level === 'revoked';
            return (
              <div
                key={device.deviceId}
                className={cn(
                  'rounded-xl border bg-white p-4 shadow-sm',
                  revoked
                    ? 'border-slate-200 opacity-70'
                    : health.level === 'offline'
                      ? 'border-red-200'
                      : 'border-slate-200',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">
                      {device.deviceName || 'Unnamed laptop'}
                    </p>
                    <p className="truncate font-mono text-xs text-slate-400">
                      {device.deviceId}
                    </p>
                  </div>
                  <Badge tone={health.tone}>
                    <ToneDot tone={health.tone} />
                    {health.label}
                  </Badge>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <dt className="text-slate-400">Instagram account</dt>
                    <dd className="truncate text-slate-700">
                      {device.igUsername ? `@${device.igUsername}` : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Platform</dt>
                    <dd className="truncate text-slate-700">{device.platform || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Last check-in</dt>
                    <dd className="text-slate-700" title={formatDateTime(device.lastSeenAt)}>
                      {formatRelative(device.lastSeenAt)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Agent version</dt>
                    <dd className="text-slate-700">{device.agentVersion || '—'}</dd>
                  </div>
                </dl>

                {health.tokenWarning ? (
                  <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    {health.tokenWarning}
                  </p>
                ) : null}

                {revoked ? (
                  <p className="mt-4 text-xs text-slate-400">
                    Revoked {formatRelative(device.revokedAt)}. Pair the laptop again to
                    restart syncing.
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => revoke(device)}
                    disabled={busy}
                    className="mt-4 inline-flex min-h-touch w-full items-center justify-center gap-2 rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-danger transition hover:bg-red-50 disabled:opacity-60"
                  >
                    {busy ? <Spinner className="h-4 w-4" /> : null}
                    Revoke this laptop
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Connected Instagram accounts
        </h2>
        {accounts.error ? (
          <ErrorState
            error={accounts.error}
            onRetry={accounts.reload}
            context="your connected accounts"
          />
        ) : accounts.loading && !accounts.data ? (
          <SkeletonRows rows={2} />
        ) : accountList.length === 0 ? (
          <EmptyState
            title="No Instagram account connected"
            description="Connect an account from inside the laptop agent. One install can run more than one handle."
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {accountList.map((account) => (
              <div
                key={account.igUserId}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <p className="truncate text-sm font-semibold text-ink">
                  {account.igUsername ? `@${account.igUsername}` : account.igUserId}
                </p>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <dt className="text-slate-400">Followers</dt>
                    <dd className="font-medium tabular-nums text-ink">
                      {formatNumber(account.followersCount ?? 0)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Following</dt>
                    <dd className="font-medium tabular-nums text-ink">
                      {formatNumber(account.followsCount ?? 0)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Posts</dt>
                    <dd className="font-medium tabular-nums text-ink">
                      {formatNumber(account.mediaCount ?? 0)}
                    </dd>
                  </div>
                </dl>
                <p className="mt-3 text-xs text-slate-400">
                  Last sync {formatRelative(account.lastSyncAt)}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function PairingDialog({
  pairing,
  onClose,
}: {
  pairing: PairingCodeResponse;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const expiresAt = new Date(pairing.expiresAt).getTime();
  const remainingMs = Number.isNaN(expiresAt) ? null : Math.max(0, expiresAt - now);
  const expired = remainingMs !== null && remainingMs === 0;

  const countdown =
    remainingMs === null
      ? null
      : `${Math.floor(remainingMs / 60000)}:${String(
          Math.floor((remainingMs % 60000) / 1000),
        ).padStart(2, '0')}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(pairing.pairingCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard is blocked on insecure origins; the code is on screen anyway.
      setCopied(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pair a laptop"
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center"
    >
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold text-ink">Pair a laptop</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-touch w-touch items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-2 text-sm text-slate-600">
          On the laptop that runs the agent, open a terminal and run:
        </p>
        <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-900 px-3 py-2 text-sm text-slate-100">
          ig-agent pair {pairing.pairingCode}
        </pre>

        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-center">
          <p className="text-xs uppercase tracking-wide text-slate-500">Pairing code</p>
          <p className="mt-1 font-mono text-2xl font-bold tracking-[0.2em] text-ink">
            {pairing.pairingCode}
          </p>
          <button
            type="button"
            onClick={copy}
            className="mt-3 inline-flex min-h-touch items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-brand hover:text-brand"
          >
            {copied ? <Check className="h-4 w-4 text-accent" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copied' : 'Copy code'}
          </button>
        </div>

        <p
          className={cn(
            'mt-3 text-center text-sm',
            expired ? 'font-medium text-danger' : 'text-slate-500',
          )}
        >
          {expired
            ? 'This code has expired. Close this and generate a new one.'
            : countdown
              ? `Single use. Expires in ${countdown}.`
              : 'Single use, valid for 15 minutes.'}
        </p>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 min-h-touch w-full rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-light"
        >
          Done
        </button>
      </div>
    </div>
  );
}
