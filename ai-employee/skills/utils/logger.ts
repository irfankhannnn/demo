import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const BASE_LOG_DIR = path.join(os.homedir(), '.openclaw', 'workspace', 'script_logs');
const LOG_PII = (process.env.LOG_PII || '0') === '1';

export interface ExecutionMeta {
  skill: string;
  script: string;
  status: 'success' | 'error';
  duration_ms: number;
  userMessage?: string;
  intent?: string;
  request?: unknown;
  response?: unknown;
  error?: unknown;
}

export interface Timer {
  end: () => number;
}

export function startTimer(): Timer {
  const start = performance.now();
  return {
    end: () => Math.round(performance.now() - start),
  };
}

function todayDir(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function timeSuffix(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function logExecution(meta: ExecutionMeta): void {
  try {
    const skillDir = path.join(BASE_LOG_DIR, todayDir(), meta.skill);
    ensureDir(skillDir);

    const ext = meta.status === 'error' ? '.error.json' : '.json';
    const filePath = path.join(skillDir, `${meta.script.replace('.ts', '')}_${timeSuffix()}${ext}`);

    const entry: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      skill: meta.skill,
      script: meta.script,
      status: meta.status,
      duration_ms: meta.duration_ms,
    };

    if (meta.userMessage) entry.user_message = meta.userMessage;
    if (meta.intent) entry.intent = meta.intent;

    if (LOG_PII) {
      if (meta.request) entry.request = meta.request;
      if (meta.response) entry.response = meta.response;
    }

    if (meta.error) {
      entry.error = meta.error instanceof Error
        ? { message: meta.error.message, name: meta.error.name }
        : meta.error;
    }

    fs.writeFileSync(filePath, JSON.stringify(entry, null, 2), 'utf8');
  } catch {
    // logging failure must not crash the script
  }
}

// backward-compatible wrappers — still used during migration
export function logApiCall(
  scriptName: string,
  request: unknown,
  response: unknown,
  skill?: string
): void {
  logExecution({
    skill: skill || guessSkill(scriptName),
    script: scriptName.endsWith('.ts') ? scriptName : `${scriptName}.ts`,
    status: 'success',
    duration_ms: 0,
    request,
    response,
  });
}

export function logApiError(
  scriptName: string,
  request: unknown,
  error: unknown,
  skill?: string
): void {
  logExecution({
    skill: skill || guessSkill(scriptName),
    script: scriptName.endsWith('.ts') ? scriptName : `${scriptName}.ts`,
    status: 'error',
    duration_ms: 0,
    request,
    error,
  });
}

function guessSkill(scriptName: string): string {
  const name = scriptName.replace('.ts', '');
  if (name.includes('lead')) return 'lead-management';
  if (name.includes('buyer')) return 'buyer-management';
  if (name.includes('owner')) return 'owner-management';
  if (name.includes('propert')) return 'property-management';
  if (name.includes('tenant') || name.includes('rental')) return 'tenant-management';
  if (name.includes('contact')) return 'contact-management';
  return 'unknown';
}