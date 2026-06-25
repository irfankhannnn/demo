import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const outputPath = join(rootDir, 'test-output.txt');

const child = spawn('node', [
  '--experimental-vm-modules',
  join(rootDir, 'node_modules', 'jest', 'bin', 'jest.js'),
], {
  cwd: rootDir,
  stdio: ['ignore', 'pipe', 'pipe'],
});

let stdout = '';
let stderr = '';

child.stdout.on('data', (data) => {
  stdout += data.toString();
});

child.stderr.on('data', (data) => {
  stderr += data.toString();
});

child.on('close', (code) => {
  const output = stdout + (stderr ? `\n${stderr}` : '');
  writeFileSync(outputPath, output);
  if (code === 0) {
    console.log(`Tests passed. Results written to ${outputPath}`);
  } else {
    console.error(`Tests failed (exit ${code}). Results written to ${outputPath}`);
    process.exit(1);
  }
});
