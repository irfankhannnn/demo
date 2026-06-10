import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const LOG_DIR = path.join(os.homedir(), '.openclaw', 'workspace', 'script_logs');

function getTimestamp(): string {
  const now = new Date();
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  return (
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  );
}

function ensureLogDir(): void {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

export function logApiCall(scriptName: string, request: any, response: any): void {
  try {
    ensureLogDir();
    const ts = getTimestamp();
    const filePath = path.join(LOG_DIR, `${scriptName}_${ts}.log`);
    const lines: string[] = [
      `=== ${scriptName} ===`,
      `Timestamp: ${new Date().toISOString()}`,
      '',
      '--- REQUEST ---',
      JSON.stringify(request, null, 2),
      '',
      '--- RESPONSE ---',
      JSON.stringify(response, null, 2),
      '',
    ];
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
  } catch {
    // logging failure must not crash the script
  }
}

export function logApiError(scriptName: string, request: any, error: any): void {
  try {
    ensureLogDir();
    const ts = getTimestamp();
    const filePath = path.join(LOG_DIR, `${scriptName}_${ts}.error.log`);
    const lines: string[] = [
      `=== ${scriptName} ERROR ===`,
      `Timestamp: ${new Date().toISOString()}`,
      '',
      '--- REQUEST ---',
      JSON.stringify(request, null, 2),
      '',
      '--- ERROR ---',
      JSON.stringify(error, null, 2),
      '',
    ];
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
  } catch {
    // logging failure must not crash the script
  }
}
