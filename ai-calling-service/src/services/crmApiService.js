// CRM Internal API Client - Fetches data from existing CRM Lambda

import axios from 'axios';
import { logger } from '../utils/logger.js';
import { API_TIMEOUT_MS } from '../config/constants.js';
import { getCrmInternalApiBaseUrl } from '../config/serviceUrls.js';

// Built lazily. CRM_INTERNAL_API_KEY arrives from Secrets Manager during
// cold-start hydration, which happens after this module is imported — the
// previous module-scope throw meant every route that transitively imported
// this file crashed the container on import before hydration could run.
let crmClient = null;

function getClient() {
  if (crmClient) return crmClient;

  // https://<CRM_INTERNAL_API_DOMAIN_NAME>/<CRM_INTERNAL_API_BASE_PATH>; throws
  // on a missing domain or a raw execute-api host.
  const baseURL = getCrmInternalApiBaseUrl();
  const apiKey = process.env.CRM_INTERNAL_API_KEY;

  if (!apiKey) throw new Error('Missing required secret CRM_INTERNAL_API_KEY');

  crmClient = axios.create({
    baseURL,
    timeout: API_TIMEOUT_MS,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'x-source': 'ai-calling-service',
    },
  });

  crmClient.interceptors.request.use((config) => {
    logger.debug('CRM API Request', {
      method: config.method,
      url: config.url,
      tenantId: config.headers['x-tenant-id'],
    });
    return config;
  });

  crmClient.interceptors.response.use(
    (response) => {
      logger.debug('CRM API Response', {
        status: response.status,
        url: response.config.url,
      });
      return response;
    },
    (error) => {
      logger.error('CRM API Error', error, {
        url: error.config?.url,
        status: error.response?.status,
      });
      throw error;
    }
  );

  return crmClient;
}

// Exposed for tests — lets a suite reset the memoized client between cases.
export function resetClient() {
  crmClient = null;
}

/**
 * Get lead context for AI call
 */
export async function getLeadContext(tenantId, leadId) {
  try {
    const response = await getClient().get(`/api/internal/leads/${leadId}/context`, {
      headers: { 'x-tenant-id': tenantId },
    });
    return response.data;
  } catch (error) {
    logger.error('Failed to get lead context', error, { tenantId, leadId });
    return null;
  }
}

/**
 * Get available properties with filters
 */
export async function getAvailableProperties(tenantId, filters = {}) {
  try {
    const params = new URLSearchParams();
    if (filters.propertyType) params.append('type', filters.propertyType);
    if (filters.location) params.append('location', filters.location);
    if (filters.minPrice) params.append('minPrice', filters.minPrice);
    if (filters.maxPrice) params.append('maxPrice', filters.maxPrice);
    if (filters.bedrooms) params.append('bedrooms', filters.bedrooms);
    
    const response = await getClient().get(`/api/internal/properties/available?${params}`, {
      headers: { 'x-tenant-id': tenantId },
    });
    return response.data;
  } catch (error) {
    logger.error('Failed to get available properties', error, { tenantId, filters });
    return [];
  }
}

/**
 * Semantically match properties against a spoken description.
 *
 * Returns [] rather than throwing: on a live call the caller decides whether to
 * fall back to exact filters, and an exception here would end the turn in dead air.
 */
export async function matchProperties(tenantId, options = {}) {
  try {
    const response = await getClient().post('/api/internal/properties/match', options, {
      headers: { 'x-tenant-id': tenantId },
    });
    return response.data?.properties || [];
  } catch (error) {
    logger.error('Failed to match properties semantically', error, { tenantId });
    return [];
  }
}

/**
 * Get property details
 */
export async function getPropertyDetails(tenantId, propertyId) {
  try {
    const response = await getClient().get(`/api/internal/properties/${propertyId}/details`, {
      headers: { 'x-tenant-id': tenantId },
    });
    return response.data;
  } catch (error) {
    logger.error('Failed to get property details', error, { tenantId, propertyId });
    return null;
  }
}

/**
 * Schedule a site visit
 */
export async function scheduleSiteVisit(tenantId, visitData) {
  try {
    const response = await getClient().post('/api/internal/site-visits', visitData, {
      headers: { 'x-tenant-id': tenantId },
    });
    return response.data;
  } catch (error) {
    logger.error('Failed to schedule site visit', error, { tenantId, visitData });
    throw error;
  }
}

/**
 * Update lead status after call
 */
export async function updateLeadCallOutcome(tenantId, leadId, outcomeData) {
  try {
    const response = await getClient().patch(`/api/internal/leads/${leadId}/call-outcome`, outcomeData, {
      headers: { 'x-tenant-id': tenantId },
    });
    return response.data;
  } catch (error) {
    logger.error('Failed to update lead call outcome', error, { tenantId, leadId });
    // Don't throw - this is a non-critical operation
    return null;
  }
}

/**
 * Get buyer details
 */
export async function getBuyerDetails(tenantId, buyerId) {
  try {
    const response = await getClient().get(`/api/internal/buyers/${buyerId}`, {
      headers: { 'x-tenant-id': tenantId },
    });
    return response.data;
  } catch (error) {
    logger.error('Failed to get buyer details', error, { tenantId, buyerId });
    return null;
  }
}

/**
 * Get seller details
 */
export async function getSellerDetails(tenantId, sellerId) {
  try {
    const response = await getClient().get(`/api/internal/sellers/${sellerId}`, {
      headers: { 'x-tenant-id': tenantId },
    });
    return response.data;
  } catch (error) {
    logger.error('Failed to get seller details', error, { tenantId, sellerId });
    return null;
  }
}

/**
 * Search properties by criteria
 */
export async function searchProperties(tenantId, query) {
  try {
    const response = await getClient().get(`/api/internal/properties/search`, {
      headers: { 'x-tenant-id': tenantId },
      params: { q: query },
    });
    return response.data;
  } catch (error) {
    logger.error('Failed to search properties', error, { tenantId, query });
    return [];
  }
}

/**
 * Ask the CRM for policy passages answering a customer's question.
 *
 * Returns `{ answer: null }` on any failure rather than throwing. This runs
 * mid-call: a thrown error would surface to the agent as a broken tool, while
 * a null answer routes it down the path it already handles well — say you do
 * not know, offer a human.
 */
export async function answerPolicyQuestion(tenantId, question, category = null) {
  try {
    const response = await getClient().post(
      '/api/internal/policies/answer',
      { question, category },
      { headers: { 'x-tenant-id': tenantId } }
    );
    return response.data || { answer: null, sources: [], confidence: 0 };
  } catch (error) {
    logger.error('Failed to answer policy question', error, { tenantId });
    return { answer: null, sources: [], confidence: 0 };
  }
}

export default {
  getLeadContext,
  getAvailableProperties,
  matchProperties,
  getPropertyDetails,
  scheduleSiteVisit,
  updateLeadCallOutcome,
  getBuyerDetails,
  getSellerDetails,
  searchProperties,
  answerPolicyQuestion,
};
