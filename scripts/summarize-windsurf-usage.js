const fs = require('fs');
const path = require('path');

const TRACKER = path.join(__dirname, '..', 'windsurf-usage-tracker.md');
const OUT_DIR = path.join(__dirname, '..', 'usage-reports');

function parseTracker(md) {
  const rows = [];
  const lines = md.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|') || trimmed.startsWith('|-')) continue;
    const cells = trimmed.split('|').map(c => c.trim()).filter(Boolean);
    if (cells.length < 6) continue;
    // Skip header rows
    const date = cells[0];
    if (date === 'Date' || date.includes('--')) continue;
    rows.push({
      date,
      time: cells[1],
      mode: cells[2],
      summary: cells[3],
      input: cells[4],
      output: cells[5],
      cost: cells[6] || '',
      notes: cells[7] || ''
    });
  }
  return rows;
}

function toCSV(rows) {
  const headers = ['Date', 'Time', 'Mode', 'Request Summary', 'Input Tok', 'Output Tok', 'Cost (USD)', 'Notes'];
  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push([r.date, r.time, r.mode, `"${r.summary}"`, r.input, r.output, r.cost, `"${r.notes}"`].join(','));
  }
  return lines.join('\n');
}

function summarize(rows) {
  let totalInput = 0;
  let totalOutput = 0;
  let numericCount = 0;
  const modeMap = {};

  for (const r of rows) {
    const inp = parseInt(r.input, 10);
    const out = parseInt(r.output, 10);
    if (!isNaN(inp)) { totalInput += inp; numericCount++; }
    if (!isNaN(out)) totalOutput += out;
    modeMap[r.mode] = (modeMap[r.mode] || 0) + 1;
  }

  const lines = [];
  lines.push(`Total entries: ${rows.length}`);
  lines.push(`Entries with numeric tokens: ${numericCount}`);
  lines.push(`Total input tokens: ${totalInput.toLocaleString()}`);
  lines.push(`Total output tokens: ${totalOutput.toLocaleString()}`);
  lines.push(`Total tokens: ${(totalInput + totalOutput).toLocaleString()}`);
  lines.push('');
  lines.push('By mode:');
  for (const [mode, count] of Object.entries(modeMap)) {
    lines.push(`  ${mode}: ${count}`);
  }
  return lines.join('\n');
}

function main() {
  if (!fs.existsSync(TRACKER)) {
    console.error('Tracker not found:', TRACKER);
    process.exit(1);
  }

  const md = fs.readFileSync(TRACKER, 'utf-8');
  const rows = parseTracker(md);

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const dateStamp = new Date().toISOString().slice(0, 10);
  const csvPath = path.join(OUT_DIR, `usage-${dateStamp}.csv`);
  const summaryPath = path.join(OUT_DIR, `summary-${dateStamp}.txt`);

  fs.writeFileSync(csvPath, toCSV(rows), 'utf-8');
  fs.writeFileSync(summaryPath, summarize(rows), 'utf-8');

  console.log('Rows parsed:', rows.length);
  console.log('CSV written to:', csvPath);
  console.log('Summary written to:', summaryPath);
  console.log('\n--- Summary ---\n');
  console.log(summarize(rows));
}

main();
