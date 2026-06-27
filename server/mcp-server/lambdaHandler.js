/**
 * MCP Lambda Handler — Adapts Express app to AWS Lambda
 * 
 * This file exports the Lambda handler that API Gateway invokes.
 * It uses @vendia/serverless-express to convert Lambda events to Express requests.
 * 
 * Deployment:
 * - Lambda function handler: mcp-server/lambdaHandler.handler
 * - Environment variables: JWT_SECRET, CRM_DYNAMODB_TABLE_NAME, etc.
 * - API Gateway: REST API with POST /mcp method
 * - Authorizer: JWT authorizer that validates tokens and extracts tenantId
 */

import serverlessExpress from '@vendia/serverless-express';
import app from './httpServer.js';

/**
 * Lambda handler
 * Converts API Gateway events to Express requests
 */
const handler = serverlessExpress({ app });

export { handler };
