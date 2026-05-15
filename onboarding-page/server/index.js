import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

import { onboardTenant } from './onboardService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Reuse dependencies installed in the main backend (server/node_modules)
import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 5055);

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Static frontend
app.use('/', express.static(path.join(__dirname, '..', 'web')));

app.post('/api/onboard', async (req, res) => {
  try {
    const {
      agencyName,
      adminEmail,
      adminPhone,
    } = req.body || {};

    const result = await onboardTenant({
      agencyName,
      adminEmail,
      adminPhone,
    });

    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(400).json({ error: message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Onboarding server running on http://localhost:${port}`);
});
