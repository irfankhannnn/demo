/**
 * MCP Metrics Service
 * 
 * Emits custom CloudWatch metrics for MCP server monitoring
 * 
 * Metrics:
 * - McpToolCalls — Count of tool calls
 * - McpToolErrors — Count of tool errors
 * - McpResourceReads — Count of resource reads
 * - McpPromptGets — Count of prompt gets
 * - McpTokenValidations — Count of token validations
 */

import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import { logger } from '../logger.js';

const REGION = process.env.AWS_REGION || 'ap-south-1';
const NAMESPACE = 'RealtyFlow/MCP';

const cloudwatch = new CloudWatchClient({ region: REGION });

/**
 * Emit a metric to CloudWatch
 * @param {string} metricName - Metric name
 * @param {number} value - Metric value
 * @param {string} unit - Unit (Count, Seconds, etc.)
 * @param {Object} dimensions - Metric dimensions
 */
async function emitMetric(metricName, value, unit = 'Count', dimensions = {}) {
  try {
    const metricData = {
      MetricName: metricName,
      Value: value,
      Unit: unit,
      Timestamp: new Date(),
      Dimensions: Object.entries(dimensions).map(([name, value]) => ({
        Name: name,
        Value: String(value),
      })),
    };

    const command = new PutMetricDataCommand({
      Namespace: NAMESPACE,
      MetricData: [metricData],
    });

    await cloudwatch.send(command);
  } catch (err) {
    logger.error('mcp.metrics.emit.error', {
      metricName,
      error: err.message,
    });
  }
}

/**
 * Record a tool call
 * @param {string} tenantId - Tenant ID
 * @param {string} toolName - Tool name
 * @param {boolean} success - Whether call succeeded
 */
export async function recordToolCall(tenantId, toolName, success = true) {
  await emitMetric('McpToolCalls', 1, 'Count', {
    TenantId: tenantId,
    ToolName: toolName,
    Status: success ? 'Success' : 'Error',
  });
}

/**
 * Record a tool error
 * @param {string} tenantId - Tenant ID
 * @param {string} toolName - Tool name
 * @param {string} errorType - Error type
 */
export async function recordToolError(tenantId, toolName, errorType = 'Unknown') {
  await emitMetric('McpToolErrors', 1, 'Count', {
    TenantId: tenantId,
    ToolName: toolName,
    ErrorType: errorType,
  });
}

/**
 * Record a resource read
 * @param {string} tenantId - Tenant ID
 * @param {string} resourceUri - Resource URI
 * @param {boolean} success - Whether read succeeded
 */
export async function recordResourceRead(tenantId, resourceUri, success = true) {
  await emitMetric('McpResourceReads', 1, 'Count', {
    TenantId: tenantId,
    Resource: resourceUri,
    Status: success ? 'Success' : 'Error',
  });
}

/**
 * Record a prompt get
 * @param {string} tenantId - Tenant ID
 * @param {string} promptName - Prompt name
 * @param {boolean} success - Whether get succeeded
 */
export async function recordPromptGet(tenantId, promptName, success = true) {
  await emitMetric('McpPromptGets', 1, 'Count', {
    TenantId: tenantId,
    Prompt: promptName,
    Status: success ? 'Success' : 'Error',
  });
}

/**
 * Record a token validation
 * @param {string} clientId - Client ID (anthropic, openai, etc.)
 * @param {boolean} valid - Whether token was valid
 */
export async function recordTokenValidation(clientId, valid = true) {
  await emitMetric('McpTokenValidations', 1, 'Count', {
    ClientId: clientId,
    Status: valid ? 'Valid' : 'Invalid',
  });
}

/**
 * Record request latency
 * @param {string} tenantId - Tenant ID
 * @param {string} method - MCP method
 * @param {number} latencyMs - Latency in milliseconds
 */
export async function recordLatency(tenantId, method, latencyMs) {
  await emitMetric('McpLatency', latencyMs, 'Milliseconds', {
    TenantId: tenantId,
    Method: method,
  });
}
