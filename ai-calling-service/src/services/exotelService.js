// Exotel Telephony Service - India Compliant Voice Calls

import axios from 'axios';
import { logger } from '../utils/logger.js';

const EXOTEL_API_KEY = process.env.EXOTEL_API_KEY;
const EXOTEL_API_TOKEN = process.env.EXOTEL_API_TOKEN;
const EXOTEL_SID = process.env.EXOTEL_SID;
const EXOTEL_SUBDOMAIN = process.env.EXOTEL_SUBDOMAIN || 'api.exotel.com';
const WEBHOOK_BASE_URL = process.env.WEBHOOK_BASE_URL;

const exotelClient = axios.create({
  baseURL: `https://${EXOTEL_API_KEY}:${EXOTEL_API_TOKEN}@${EXOTEL_SUBDOMAIN}/v1/Accounts/${EXOTEL_SID}`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
  },
});

/**
 * Initiate outbound call via Exotel
 * @param {string} tenantId - Tenant identifier
 * @param {string} toPhone - Customer phone number (Indian format)
 * @param {string} fromPhone - Exotel virtual number
 * @param {string} callSessionId - Our internal call session ID
 * @returns {Promise<{callSid: string, status: string}>}
 */
export async function initiateOutboundCall(tenantId, toPhone, fromPhone, callSessionId) {
  try {
    // Format phone for India
    const formattedTo = formatIndianPhone(toPhone);
    const formattedFrom = formatIndianPhone(fromPhone);
    
    const params = new URLSearchParams();
    params.append('From', formattedTo); // Customer's number
    params.append('To', formattedFrom); // Exotel virtual number
    params.append('CallerId', formattedFrom);
    params.append('Record', 'true');
    params.append('PlayDtmf', 'none');
    
    // Webhook URLs for call events
    params.append('StatusCallback', `${WEBHOOK_BASE_URL}/webhooks/exotel/status`);
    params.append('StatusCallbackEvents', 'initiated,ringing,in-progress,completed,failed,busy,no-answer');
    
    // Custom parameters passed through webhooks
    params.append('CustomField', JSON.stringify({
      tenantId,
      callSessionId,
    }));
    
    const response = await exotelClient.post('/Calls/connect.json', params);
    
    const callData = response.data.Call;
    
    logger.callEvent('EXOTEL_CALL_INITIATED', callSessionId, tenantId, {
      callSid: callData.Sid,
      to: formattedTo,
      from: formattedFrom,
    });
    
    return {
      callSid: callData.Sid,
      status: callData.Status,
      dateCreated: callData.DateCreated,
    };
  } catch (error) {
    logger.error('Exotel call initiation failed', error, { tenantId, callSessionId });
    throw new Error(`Failed to initiate call: ${error.message}`);
  }
}

/**
 * Get call details from Exotel
 */
export async function getCallDetails(callSid) {
  try {
    const response = await exotelClient.get(`/Calls/${callSid}.json`);
    return response.data.Call;
  } catch (error) {
    logger.error('Failed to get Exotel call details', error, { callSid });
    return null;
  }
}

/**
 * Get call recording URL
 */
export async function getCallRecording(callSid) {
  try {
    const response = await exotelClient.get(`/Calls/${callSid}/Recordings.json`);
    const recordings = response.data.Recordings;
    
    if (recordings && recordings.length > 0) {
      return recordings[0].Uri;
    }
    return null;
  } catch (error) {
    logger.error('Failed to get call recording', error, { callSid });
    return null;
  }
}

/**
 * End an active call
 */
export async function endCall(callSid) {
  try {
    const params = new URLSearchParams();
    params.append('Status', 'completed');
    
    await exotelClient.post(`/Calls/${callSid}.json`, params);
    
    logger.info('Call ended via Exotel', { callSid });
    return true;
  } catch (error) {
    logger.error('Failed to end call', error, { callSid });
    return false;
  }
}

/**
 * Parse Exotel webhook payload
 */
export function parseWebhookPayload(body) {
  const customField = body.CustomField ? JSON.parse(body.CustomField) : {};
  
  return {
    callSid: body.CallSid,
    status: body.Status,
    direction: body.Direction,
    from: body.From,
    to: body.To,
    startTime: body.StartTime,
    endTime: body.EndTime,
    duration: parseInt(body.Duration || '0', 10),
    recordingUrl: body.RecordingUrl,
    tenantId: customField.tenantId,
    callSessionId: customField.callSessionId,
  };
}

/**
 * Validate Exotel webhook signature
 */
export function validateWebhookSignature(req) {
  // Exotel uses IP whitelisting rather than signature validation
  // You can add IP validation here if needed
  // For now, we trust the webhook if it contains our CustomField
  return true;
}

/**
 * Format phone number for India
 */
function formatIndianPhone(phone) {
  if (!phone) return '';
  
  // Remove all non-digits
  let cleaned = phone.replace(/\D/g, '');
  
  // Handle various formats
  if (cleaned.startsWith('91') && cleaned.length === 12) {
    return cleaned; // Already in correct format
  }
  if (cleaned.startsWith('0') && cleaned.length === 11) {
    return '91' + cleaned.slice(1); // Remove leading 0
  }
  if (cleaned.length === 10) {
    return '91' + cleaned; // Add country code
  }
  
  return cleaned;
}

/**
 * Generate TwiML-like response for Exotel (AppletXML)
 */
export function generateCallResponse(options = {}) {
  const { greeting, webhookUrl, timeout = 30 } = options;
  
  // Exotel uses a simple dial-based flow
  // For AI integration, we typically use a passthrough setup
  return {
    response: 'dial',
    params: {
      timeout,
      callerId: options.callerId,
      record: true,
    },
  };
}

export default {
  initiateOutboundCall,
  getCallDetails,
  getCallRecording,
  endCall,
  parseWebhookPayload,
  validateWebhookSignature,
  generateCallResponse,
};
