import serverlessExpress from '@vendia/serverless-express';
import { createApp } from './app';
import { loadConfig } from './config/config';

// Load config at cold start
loadConfig();

const app = createApp();
const serverlessExpressInstance = serverlessExpress({ app });

export const handler = (event: any, context: any) => {
  console.log('Lambda invoked:', JSON.stringify({ path: event.path, httpMethod: event.httpMethod }));

  // Store the full API Gateway event so controllers can access requestContext.authorizer.claims
  (app as any).locals.apiGatewayEvent = event;

  return serverlessExpressInstance(event, context);
};
