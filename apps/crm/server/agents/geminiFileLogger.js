/**
 * Writes LLM request/response payloads to apps/crm/server/logs/ as paired JSON files.
 * Enable with GEMINI_FILE_LOG=true
 *
 * Per call:
 *   llm_input_{kind}_{tenant}_{sessionId}.json
 *   llm_output_{kind}_{tenant}_{sessionId}.json
 */
import fs from 'fs/promises';
import path from 'path';
import { randomBytes } from 'crypto';
import { fileURLToPath } from 'url';
import { logger } from '../logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const GEMINI_LOG_DIR = path.join(__dirname, '..', 'logs');

export function isGeminiFileLogEnabled() {
  const v = (process.env.GEMINI_FILE_LOG || '').toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}

function safeFilePart(value, maxLen = 48) {
  return String(value ?? 'unknown')
    .replace(/[^\w.-]+/g, '_')
    .slice(0, maxLen);
}

/**
 * @param {{ tenantId?: string, agentId?: string, kind?: string, label?: string }} meta
 */
export function createGeminiLogSession(meta = {}) {
  if (!isGeminiFileLogEnabled()) {
    return null;
  }

  const sessionId = `${Date.now()}-${randomBytes(4).toString('hex')}`;
  const kind = safeFilePart(meta.kind || 'chat', 16);
  const tenant = safeFilePart(meta.tenantId || 'unknown', 32);
  const label = meta.label ? `-${safeFilePart(meta.label, 24)}` : '';
  const inputPath = path.join(GEMINI_LOG_DIR, `llm_input_${kind}_${tenant}${label}_${sessionId}.json`);
  const outputPath = path.join(GEMINI_LOG_DIR, `llm_output_${kind}_${tenant}${label}_${sessionId}.json`);

  let dirReady = false;
  let pathsLogged = false;

  async function ensureDir() {
    if (!dirReady) {
      await fs.mkdir(GEMINI_LOG_DIR, { recursive: true });
      dirReady = true;
    }
  }

  async function writeJson(filePath, record) {
    await ensureDir();
    if (!pathsLogged) {
      pathsLogged = true;
      logger.info('gemini.file_log.started', { inputPath, outputPath, sessionId, ...meta });
    }
    const payload = {
      loggedAt: new Date().toISOString(),
      sessionId,
      ...meta,
      ...record,
    };
    await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  }

  return {
    sessionId,
    inputPath,
    outputPath,
    /** @deprecated use writeInput */
    async append(record) {
      await writeJson(inputPath, record);
    },
    async writeInput(record) {
      await writeJson(inputPath, record);
    },
    async writeOutput(record) {
      await writeJson(outputPath, record);
    },
  };
}
