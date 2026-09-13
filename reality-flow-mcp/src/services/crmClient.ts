/**
 * CRM Client — HTTP client for calling the CRM backend API
 *
 * The MCP microservice is a thin translation layer. It does NOT have direct
 * DynamoDB access. Instead, it calls the CRM backend's /api/crm/agent/tool
 * endpoint (which accepts service JWT auth) for all tool execution.
 *
 * This keeps the MCP service fully decoupled from the CRM backend's
 * internal data layer.
 */

import axios from 'axios';
import { logger } from '../utils/logger';
import { generateServiceToken } from './tokenService';
import { getCrmApiBaseUrl } from '../config/config';

const CRM_API_INTERNAL_KEY = process.env.CRM_API_INTERNAL_KEY;

export interface ToolInvocationResult {
  ok: boolean;
  data?: any;
  error?: string;
  [key: string]: any;
}

/**
 * Invoke a CRM tool via the CRM backend HTTP API
 *
 * @param tenantId - Tenant ID (agency ID)
 * @param toolName - Tool name (e.g., 'search_leads')
 * @param input - Tool input parameters
 * @param context - Optional context (userId, source)
 * @returns Tool invocation result
 */
export async function invokeTool(
  tenantId: string,
  toolName: string,
  input: Record<string, any> = {},
  context: { userId?: string; source?: string } = {}
): Promise<ToolInvocationResult> {
  // Default search tools to summary mode to avoid oversized responses from Claude
  if (toolName.startsWith('search_') && !input.responseMode) {
    input.responseMode = 'summary';
  }

  // Generate a short-lived service JWT for authenticating with the CRM backend
  const serviceToken = generateServiceToken(tenantId);

  // Throws if CRM_API_DOMAIN_NAME is missing or a raw API Gateway host.
  const url = `${getCrmApiBaseUrl()}/api/crm/agent/tool`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${serviceToken}`,
    'x-tenant-id': tenantId,
  };

  if (context.userId) {
    headers['x-user-id'] = context.userId;
  }
  if (context.source) {
    headers['x-source'] = context.source;
  }
  if (CRM_API_INTERNAL_KEY) {
    headers['x-api-key'] = CRM_API_INTERNAL_KEY;
  }

  try {
    logger.info('crmClient.invoke.request', { tenantId, toolName, url });

    const response = await axios.post(
      url,
      { toolName, input },
      { headers, timeout: 45000 }
    );

    logger.info('crmClient.invoke.success', {
      tenantId,
      toolName,
      ok: response.data?.ok ?? true,
    });

    return response.data as ToolInvocationResult;
  } catch (err: any) {
    const status = err.response?.status;
    const errorData = err.response?.data;

    logger.error('crmClient.invoke.error', {
      tenantId,
      toolName,
      status,
      error: err.message,
      errorData,
    });

    // Return a structured error so the MCP handler can format it
    return {
      ok: false,
      error: errorData?.error || err.message,
      status,
    };
  }
}
