import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// .env.local (point at an already-deployed dev pool/tables) wins over .env.
const envLocalPath = path.resolve(__dirname, '../.env.local');
dotenv.config(fs.existsSync(envLocalPath) ? { path: envLocalPath } : undefined);

import { createApp } from './app';
import { loadConfig } from './config/config';

const config = loadConfig();
const app = createApp();

app.listen(config.PORT, () => {
  console.log('marketplace-authentication running locally');
  console.log(`  Base URL:   http://localhost:${config.PORT}`);
  console.log(`  Health:     http://localhost:${config.PORT}/health`);
  console.log(`  Env:        ${config.ENV}`);
  console.log(`  Pool:       ${config.COGNITO_USER_POOL_ID}`);
  console.log(`  Rate limit: ${config.RATE_LIMIT_DISABLED ? 'disabled' : 'enabled'}`);
});
