/**
 * Wires the runtime together: config -> store -> token provider -> governor ->
 * Graph client. Every command and collector takes one of these instead of
 * building its own dependencies, which is what keeps the token provider seam
 * (PLAN D1) honest.
 */
import { loadConfig } from '../util/config.js';
import { openStore } from '../store/repos.js';
import { createTokenProvider } from '../auth/tokenProvider.js';
import { getGovernor } from './governor.js';
import { GraphClient } from './graphClient.js';

export function createContext({ config = loadConfig(), fetchImpl = null, provider = null, governor = null } = {}) {
  const db = openStore();
  const tokenProvider = provider ?? createTokenProvider(config);
  const rateGovernor = governor ?? getGovernor(config);
  const graph = new GraphClient({ provider: tokenProvider, config, governor: rateGovernor, fetchImpl });
  return { config, db, provider: tokenProvider, governor: rateGovernor, graph };
}
