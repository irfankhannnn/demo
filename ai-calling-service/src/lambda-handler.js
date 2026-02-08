// AWS Lambda Handler for AI Calling Service

import serverless from 'serverless-http';
import app from './server.js';

export const handler = serverless(app, {
  binary: ['image/*', 'audio/*', 'video/*'],
});
