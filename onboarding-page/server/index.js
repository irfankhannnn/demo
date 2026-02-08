import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

import { onboardTenant } from './onboardService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Reuse dependencies installed in the main backend (server/node_modules)
const require = createRequire(path.join(__dirname, '..', '..', 'server', 'package.json'));
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

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
      adminUsername,
      adminPassword,
      contactEmail,
      contactPhone,
    } = req.body || {};

    const result = await onboardTenant({
      agencyName,
      adminUsername,
      adminPassword,
      contactEmail,
      contactPhone,
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
