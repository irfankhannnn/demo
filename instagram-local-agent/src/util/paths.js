/**
 * Filesystem layout for the agent.
 *
 * Everything the agent owns lives under one directory, `~/.ig-agent` by default.
 * `IG_AGENT_HOME` overrides it, which is how the tests get an isolated home
 * without ever touching the real one.
 */
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

export function agentHome() {
  return process.env.IG_AGENT_HOME
    ? path.resolve(process.env.IG_AGENT_HOME)
    : path.join(os.homedir(), '.ig-agent');
}

export function ensureHome() {
  const home = agentHome();
  fs.mkdirSync(home, { recursive: true, mode: 0o700 });
  return home;
}

export const dbPath = () => path.join(agentHome(), 'agent.db');
export const configPath = () => process.env.IG_AGENT_CONFIG || path.join(agentHome(), 'config.json');
export const rulesPath = () => path.join(agentHome(), 'rules.json');
export const vaultKeyPath = () => path.join(agentHome(), 'vault.key');
export const devicePath = () => path.join(agentHome(), 'device.json');
export const logPath = () => path.join(agentHome(), 'agent.log');
