// Lambda entry point.
//
// assertEnv runs at module load, i.e. during the cold start, so a stack
// deployed with a missing table name fails its very first invocation with a
// readable message instead of a DynamoDB ValidationException on some later
// write.

import serverless from 'serverless-http';
import { createApp } from './server.js';
import { assertEnv } from './config/env.js';
import { logger } from './logger.js';

assertEnv();

const app = createApp();

logger.info('lambda.cold_start', {
  functionName: process.env.AWS_LAMBDA_FUNCTION_NAME,
  region: process.env.AWS_REGION,
});

export const handler = serverless(app, {
  // API Gateway hands the body through as a string; serverless-http rebuilds
  // the request stream from it, and express.json's verify hook then sees the
  // same bytes the agent signed.
  request: (request, event) => {
    request.requestContextRequestId = event?.requestContext?.requestId;
  },
});

export default handler;
