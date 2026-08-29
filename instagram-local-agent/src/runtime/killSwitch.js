/**
 * A13 / F61 - the kill switch, and F63 - dry-run mode.
 *
 * The switch is a flag in ~/.ig-agent/config.json, not a process variable, so it
 * survives a restart and can be flipped from the console or the CLI while a
 * sync is running. Reads are cheap and uncached on purpose: a kill switch that
 * takes effect "on the next restart" is not a kill switch.
 *
 * Semantics:
 *   killSwitch = true  -> nothing outbound leaves. Collectors still read, so the
 *                         owner keeps their inbox, but no message, reply or
 *                         upload is sent.
 *   dryRun     = true  -> outbound work runs end to end and is recorded as
 *                         `dry_run` in outbox and audit_log, but no HTTP call
 *                         to Meta is made.
 */
import { loadConfig, saveConfig } from '../util/config.js';
import { audit } from '../store/repos.js';
import { logger } from '../util/logger.js';

const log = logger('runtime/killSwitch');

export class KillSwitchError extends Error {
  constructor(action) {
    super(`Kill switch is ON - refusing "${action}". Clear it with: ig-agent status --resume`);
    this.name = 'KillSwitchError';
    this.action = action;
  }
}

export const isEngaged = () => Boolean(loadConfig().killSwitch);
export const isDryRun = () => Boolean(loadConfig().dryRun);

/** Throw if the switch is on. Call this at the top of anything that sends. */
export function assertNotEngaged(action = 'outbound action') {
  if (isEngaged()) {
    try {
      audit({ scope: 'runtime', action: 'killswitch.block', outcome: 'blocked', detail: { blocked: action } });
    } catch { /* audit must never break the caller */ }
    throw new KillSwitchError(action);
  }
}

export function engage(reason = 'manual', actor = 'human') {
  const cfg = loadConfig();
  cfg.killSwitch = true;
  saveConfig(cfg);
  log.warn('KILL SWITCH ENGAGED - all outbound activity stopped', { reason });
  audit({ scope: 'runtime', action: 'killswitch.engage', actor, outcome: 'ok', detail: { reason } });
  return true;
}

export function disengage(actor = 'human') {
  const cfg = loadConfig();
  cfg.killSwitch = false;
  saveConfig(cfg);
  log.info('kill switch cleared - outbound activity resumed');
  audit({ scope: 'runtime', action: 'killswitch.disengage', actor, outcome: 'ok' });
  return true;
}

export function setDryRun(on, actor = 'human') {
  const cfg = loadConfig();
  cfg.dryRun = Boolean(on);
  saveConfig(cfg);
  audit({ scope: 'runtime', action: on ? 'dryrun.on' : 'dryrun.off', actor, outcome: 'ok' });
  return cfg.dryRun;
}
