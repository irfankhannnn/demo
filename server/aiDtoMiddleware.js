/**
 * AI DTO Middleware — Wraps skillInvoker results with AI-friendly DTOs.
 *
 * This middleware intercepts tool results and transforms them using:
 * - Normalizers (remove internal fields, enrich data)
 * - AI View Builders (project into AI-specific DTOs)
 *
 * Feature flags control which entities use the new AI DTO pipeline.
 * When disabled, results pass through unchanged (backward compatible).
 */

import { logger } from './logger.js';

// Normalizers
import { normalizeLead, normalizeLeads } from './normalizers/leadNormalizer.js';
import { normalizeOwner, normalizeOwners } from './normalizers/ownerNormalizer.js';
import { normalizeTenant, normalizeTenants } from './normalizers/tenantNormalizer.js';
import { normalizeNote, normalizeNotes } from './normalizers/noteNormalizer.js';
import { normalizeBuyer, normalizeBuyers } from './normalizers/buyerNormalizer.js';
import { normalizeProperty, normalizeProperties } from './normalizers/propertyNormalizer.js';
import { normalizeContact, normalizeContacts } from './normalizers/contactNormalizer.js';

// Services (used for entity lookups when the raw result only contains a note)
import { getLead_Service } from './services/leadService.js';
import { getOwner_Service } from './services/ownerService.js';
import { getTenant_Service } from './services/tenantService.js';

// AI View Builders
import * as LeadAIViewBuilder from './aiViewBuilders/leadAIViewBuilder.js';
import * as OwnerAIViewBuilder from './aiViewBuilders/ownerAIViewBuilder.js';
import * as TenantAIViewBuilder from './aiViewBuilders/tenantAIViewBuilder.js';
import * as MeetingAIViewBuilder from './aiViewBuilders/meetingAIViewBuilder.js';
import * as BuyerAIViewBuilder from './aiViewBuilders/buyerAIViewBuilder.js';
import * as PropertyAIViewBuilder from './aiViewBuilders/propertyAIViewBuilder.js';
import * as ContactAIViewBuilder from './aiViewBuilders/contactAIViewBuilder.js';

// Feature flags
const USE_AI_DTO_FOR_LEADS = process.env.USE_AI_DTO_FOR_LEADS === 'true';
const USE_AI_DTO_FOR_OWNERS = process.env.USE_AI_DTO_FOR_OWNERS === 'true';
const USE_AI_DTO_FOR_TENANTS = process.env.USE_AI_DTO_FOR_TENANTS === 'true';
const USE_AI_DTO_FOR_MEETINGS = process.env.USE_AI_DTO_FOR_MEETINGS === 'true';
const USE_AI_DTO_FOR_BUYERS = process.env.USE_AI_DTO_FOR_BUYERS === 'true';
const USE_AI_DTO_FOR_PROPERTIES = process.env.USE_AI_DTO_FOR_PROPERTIES === 'true';
const USE_AI_DTO_FOR_CONTACTS = process.env.USE_AI_DTO_FOR_CONTACTS === 'true';

// ─── Tool Registry ───────────────────────────────────────────────────────────

const LEAD_TOOLS = new Set([
  'create_lead', 'get_lead', 'search_leads', 'update_lead', 'delete_lead', 'convert_lead',
  'create_lead_note', 'get_lead_notes', 'update_lead_note', 'delete_lead_note',
]);

const OWNER_TOOLS = new Set([
  'create_owner', 'get_owner', 'get_owners', 'search_owners', 'update_owner', 'delete_owner',
  'get_owner_by_phone', 'create_owner_note', 'get_owner_notes', 'update_owner_note', 'delete_owner_note',
]);

const TENANT_TOOLS = new Set([
  'create_tenant', 'get_tenant', 'search_tenants', 'update_tenant', 'delete_tenant',
  'get_tenant_by_phone', 'create_tenant_note', 'get_tenant_notes', 'update_tenant_note', 'delete_tenant_note',
  'get_tenant_rental_history', 'update_tenant_current_rental', 'archive_tenant_rental',
]);

const MEETING_TOOLS = new Set([
  'create_meeting', 'get_meeting', 'get_upcoming_meetings', 'update_meeting', 'delete_meeting',
]);

const BUYER_TOOLS = new Set([
  'create_buyer', 'get_buyer', 'search_buyers', 'update_buyer', 'delete_buyer',
  'create_buyer_note', 'get_buyer_notes',
]);

const PROPERTY_TOOLS = new Set([
  'create_property', 'get_property', 'search_properties', 'update_property', 'delete_property',
]);

const CONTACT_TOOLS = new Set([
  'create_contact', 'get_contact', 'search_contacts', 'update_contact', 'delete_contact',
  'update_contact_role', 'create_contact_note', 'get_contact_notes', 'find_contact_by_phone',
]);

/**
 * Transform tool result with AI DTOs if feature flag is enabled
 * @param {string} toolName
 * @param {*} result
 * @param {Object} context { tenantId, userId, input }
 * @returns {*} Transformed result or original result
 */
export async function transformWithAiDto(toolName, result, context = {}) {
  try {
    if (USE_AI_DTO_FOR_LEADS && LEAD_TOOLS.has(toolName)) {
      return transformLeadResult(toolName, result, context.tenantId, context.input || {});
    }

    if (USE_AI_DTO_FOR_OWNERS && OWNER_TOOLS.has(toolName)) {
      return transformOwnerResult(toolName, result, context.tenantId, context.input || {});
    }

    if (USE_AI_DTO_FOR_TENANTS && TENANT_TOOLS.has(toolName)) {
      return transformTenantResult(toolName, result, context.tenantId, context.input || {});
    }

    if (USE_AI_DTO_FOR_MEETINGS && MEETING_TOOLS.has(toolName)) {
      return transformMeetingResult(toolName, result, context.input || {});
    }

    if (USE_AI_DTO_FOR_BUYERS && BUYER_TOOLS.has(toolName)) {
      return transformBuyerResult(toolName, result, context.input || {});
    }

    if (USE_AI_DTO_FOR_PROPERTIES && PROPERTY_TOOLS.has(toolName)) {
      return transformPropertyResult(toolName, result, context.input || {});
    }

    if (USE_AI_DTO_FOR_CONTACTS && CONTACT_TOOLS.has(toolName)) {
      return transformContactResult(toolName, result, context.input || {});
    }

    return result;
  } catch (err) {
    logger.error('aiDtoMiddleware.transformWithAiDto.failed', { toolName, error: err.message });
    return result;
  }
}

// ─── Lead transformations ────────────────────────────────────────────────────

async function transformLeadResult(toolName, result, tenantId, input) {
  // Note operations: result is a note or array of notes, not a lead
  if (toolName === 'create_lead_note' || toolName === 'update_lead_note') {
    const lead = tenantId ? await getLead_Service(tenantId, input.leadId || input.id) : null;
    const normalizedLead = lead ? normalizeLead(lead) : { leadId: input.leadId || input.id };
    const note = normalizeNote(result);
    return toolName === 'create_lead_note'
      ? LeadAIViewBuilder.buildNoteCreateConfirmation(normalizedLead, note)
      : LeadAIViewBuilder.buildNoteUpdateConfirmation(normalizedLead, note);
  }
  if (toolName === 'get_lead_notes') {
    return LeadAIViewBuilder.buildNotesList(normalizeNotes(result || []));
  }
  if (toolName === 'delete_lead_note') {
    return { metadata: { action: 'note_deleted' }, data: { leadId: input.leadId || input.id, noteId: input.noteId || input.id } };
  }

  if (!result) {
    if (toolName === 'get_lead') {
      return LeadAIViewBuilder.buildLeadNotFoundError(input.leadId || input.id);
    }
    return result;
  }

  // Conversion returns { entity, entityType, conversionSnapshotId, leadId, ... }
  if (toolName === 'convert_lead') {
    return LeadAIViewBuilder.buildConvertConfirmation(result, result?.entityType || input.convertTo);
  }

  const normalized = Array.isArray(result) ? normalizeLeads(result) : normalizeLead(result);

  switch (toolName) {
    case 'search_leads':
      return normalized.length === 0
        ? LeadAIViewBuilder.buildEmptySearchResults()
        : LeadAIViewBuilder.buildSearchResults(normalized, { total: normalized.length, shown: normalized.length, hasMore: false });
    case 'get_lead':
      return LeadAIViewBuilder.buildLeadDetails(normalized);
    case 'create_lead':
      return LeadAIViewBuilder.buildCreateConfirmation(normalized);
    case 'update_lead':
      return LeadAIViewBuilder.buildUpdateConfirmation(normalized, {});
    case 'delete_lead':
      return { metadata: { action: 'deleted' }, data: { leadId: input.leadId || input.id } };
    default:
      return normalized;
  }
}

// ─── Owner transformations ───────────────────────────────────────────────────

async function transformOwnerResult(toolName, result, tenantId, input) {
  // Phone lookup can return null — view builder handles it
  if (toolName === 'get_owner_by_phone') {
    return OwnerAIViewBuilder.buildPhoneLookupResult(
      result ? normalizeOwner(result) : null,
      input.phone || result?.phone
    );
  }

  // Note operations
  if (toolName === 'create_owner_note' || toolName === 'update_owner_note') {
    const owner = tenantId ? await getOwner_Service(tenantId, input.ownerId || input.id) : null;
    const normalizedOwner = owner ? normalizeOwner(owner) : { ownerId: input.ownerId || input.id };
    const note = normalizeNote(result);
    return toolName === 'create_owner_note'
      ? OwnerAIViewBuilder.buildNoteCreateConfirmation(normalizedOwner, note)
      : OwnerAIViewBuilder.buildNoteUpdateConfirmation(normalizedOwner, note);
  }
  if (toolName === 'get_owner_notes') {
    return OwnerAIViewBuilder.buildNotesList(normalizeNotes(result || []));
  }
  if (toolName === 'delete_owner_note') {
    return { metadata: { action: 'note_deleted' }, data: { ownerId: input.ownerId || input.id, noteId: input.noteId || input.id } };
  }

  if (!result) {
    if (toolName === 'get_owner') {
      return OwnerAIViewBuilder.buildOwnerNotFoundError(input.ownerId || input.id);
    }
    return result;
  }

  const normalized = Array.isArray(result) ? normalizeOwners(result) : normalizeOwner(result);

  switch (toolName) {
    case 'search_owners':
    case 'get_owners': {
      const owners = Array.isArray(result) ? result : (result?.owners || []);
      const normalizedOwners = normalizeOwners(owners);
      const total = Array.isArray(result) ? owners.length : (result?.total || owners.length);
      return normalizedOwners.length === 0
        ? OwnerAIViewBuilder.buildEmptySearchResults()
        : OwnerAIViewBuilder.buildSearchResults(normalizedOwners, { total, shown: normalizedOwners.length, hasMore: total > normalizedOwners.length });
    }
    case 'get_owner':
      return OwnerAIViewBuilder.buildOwnerDetails(normalized);
    case 'create_owner':
      return OwnerAIViewBuilder.buildCreateConfirmation(normalized);
    case 'update_owner':
      return OwnerAIViewBuilder.buildUpdateConfirmation(normalized, {});
    case 'delete_owner':
      return { metadata: { action: 'deleted' }, data: { ownerId: input.ownerId || input.id } };
    default:
      return normalized;
  }
}

// ─── Tenant transformations ──────────────────────────────────────────────────

async function transformTenantResult(toolName, result, tenantId, input) {
  // Phone lookup can return null — view builder handles it
  if (toolName === 'get_tenant_by_phone') {
    return TenantAIViewBuilder.buildPhoneLookupResult(
      result ? normalizeTenant(result) : null,
      input.phone || result?.phone
    );
  }

  // Note operations
  if (toolName === 'create_tenant_note' || toolName === 'update_tenant_note') {
    const customerId = input.tenantRecordId || input.customerId || input.id;
    const tenant = tenantId ? await getTenant_Service(tenantId, customerId) : null;
    const normalizedTenant = tenant ? normalizeTenant(tenant) : { customerId };
    const note = normalizeNote(result);
    return toolName === 'create_tenant_note'
      ? TenantAIViewBuilder.buildNoteCreateConfirmation(normalizedTenant, note)
      : TenantAIViewBuilder.buildNoteUpdateConfirmation(normalizedTenant, note);
  }
  if (toolName === 'get_tenant_notes') {
    return TenantAIViewBuilder.buildNotesList(normalizeNotes(result || []));
  }
  if (toolName === 'delete_tenant_note') {
    return { metadata: { action: 'note_deleted' }, data: { customerId: input.tenantRecordId || input.customerId || input.id, noteId: input.noteId || input.id } };
  }

  if (!result) {
    if (toolName === 'get_tenant') {
      return TenantAIViewBuilder.buildTenantNotFoundError(input.tenantRecordId || input.customerId || input.id);
    }
    return result;
  }

  const normalized = Array.isArray(result) ? normalizeTenants(result) : normalizeTenant(result);

  switch (toolName) {
    case 'search_tenants': {
      const tenants = Array.isArray(result) ? result : (result?.customers || []);
      const normalizedTenants = normalizeTenants(tenants);
      const total = Array.isArray(result) ? tenants.length : (result?.total || tenants.length);
      return normalizedTenants.length === 0
        ? TenantAIViewBuilder.buildEmptySearchResults()
        : TenantAIViewBuilder.buildSearchResults(normalizedTenants, { total, shown: normalizedTenants.length, hasMore: total > normalizedTenants.length });
    }
    case 'get_tenant':
      return TenantAIViewBuilder.buildTenantDetails(normalized);
    case 'create_tenant':
      return TenantAIViewBuilder.buildCreateConfirmation(normalized);
    case 'update_tenant':
      return TenantAIViewBuilder.buildUpdateConfirmation(normalized, {});
    case 'delete_tenant':
      return { metadata: { action: 'deleted' }, data: { customerId: input.tenantRecordId || input.customerId || input.id } };
    case 'get_tenant_rental_history':
      return TenantAIViewBuilder.buildRentalHistory(normalized);
    case 'update_tenant_current_rental':
      return TenantAIViewBuilder.buildCurrentRentalUpdateConfirmation(normalized, {});
    case 'archive_tenant_rental':
      return TenantAIViewBuilder.buildRentalArchiveConfirmation(normalized, result.archivedRental || null);
    default:
      return normalized;
  }
}

// ─── Meeting transformations ─────────────────────────────────────────────────

function transformMeetingResult(toolName, result, input) {
  if (!result) {
    if (toolName === 'get_meeting') {
      return MeetingAIViewBuilder.buildMeetingNotFoundError(input.meetingId || input.id);
    }
    return result;
  }

  switch (toolName) {
    case 'create_meeting':
      return MeetingAIViewBuilder.buildMeetingCreateConfirmation(result);
    case 'get_meeting':
      return MeetingAIViewBuilder.buildMeetingDetails(result);
    case 'get_upcoming_meetings': {
      const meetings = Array.isArray(result) ? result : [];
      return meetings.length === 0
        ? MeetingAIViewBuilder.buildEmptyMeetingsList()
        : MeetingAIViewBuilder.buildMeetingsList(meetings, { total: meetings.length, days: input.days || 7, hasMore: false });
    }
    case 'update_meeting':
      return MeetingAIViewBuilder.buildMeetingUpdateConfirmation(result, {});
    case 'delete_meeting':
      return {
        metadata: { action: 'deleted' },
        data: { meetingId: input.meetingId || input.id },
      };
    default:
      return result;
  }
}

// ─── Buyer transformations ───────────────────────────────────────────────────

function transformBuyerResult(toolName, result, input) {
  if (toolName === 'create_buyer_note') {
    const note = normalizeNote(result);
    return BuyerAIViewBuilder.buildNoteCreateConfirmation(
      { buyerId: input.buyerId || input.id, name: result?.buyerName || input.name },
      note,
    );
  }
  if (toolName === 'get_buyer_notes') {
    return BuyerAIViewBuilder.buildNotesList(normalizeNotes(result || []));
  }
  if (!result) {
    if (toolName === 'get_buyer') {
      return BuyerAIViewBuilder.buildBuyerNotFoundError(input.buyerId || input.id);
    }
    return result;
  }
  const list = Array.isArray(result) ? result : (result?.buyers || null);
  if (toolName === 'search_buyers' || list) {
    const buyers = normalizeBuyers(list || (Array.isArray(result) ? result : [result]));
    const total = result?.total || buyers.length;
    return buyers.length === 0
      ? BuyerAIViewBuilder.buildEmptySearchResults()
      : BuyerAIViewBuilder.buildSearchResults(buyers, { total, shown: buyers.length, hasMore: total > buyers.length });
  }
  const normalized = normalizeBuyer(result);
  switch (toolName) {
    case 'get_buyer':
      return BuyerAIViewBuilder.buildBuyerDetails(normalized);
    case 'create_buyer':
      return BuyerAIViewBuilder.buildCreateConfirmation(normalized);
    case 'update_buyer':
      return BuyerAIViewBuilder.buildUpdateConfirmation(normalized, {});
    case 'delete_buyer':
      return BuyerAIViewBuilder.buildDeleteConfirmation(normalized);
    default:
      return normalized;
  }
}

// ─── Property transformations ────────────────────────────────────────────────

function transformPropertyResult(toolName, result, input) {
  if (!result) {
    if (toolName === 'get_property') {
      return PropertyAIViewBuilder.buildPropertyNotFoundError(input.propertyId || input.id);
    }
    return result;
  }
  const list = Array.isArray(result) ? result : (result?.properties || null);
  if (toolName === 'search_properties' || list) {
    const properties = normalizeProperties(list || (Array.isArray(result) ? result : [result]));
    const total = result?.total || properties.length;
    return properties.length === 0
      ? PropertyAIViewBuilder.buildEmptySearchResults()
      : PropertyAIViewBuilder.buildSearchResults(properties, { total, shown: properties.length, hasMore: total > properties.length });
  }
  const normalized = normalizeProperty(result);
  switch (toolName) {
    case 'get_property':
      return PropertyAIViewBuilder.buildPropertyDetails(normalized);
    case 'create_property':
      return PropertyAIViewBuilder.buildCreateConfirmation(normalized);
    case 'update_property':
      return PropertyAIViewBuilder.buildUpdateConfirmation(normalized, {});
    case 'delete_property':
      return PropertyAIViewBuilder.buildDeleteConfirmation(normalized);
    default:
      return normalized;
  }
}

// ─── Contact transformations ─────────────────────────────────────────────────

function transformContactResult(toolName, result, input) {
  if (toolName === 'create_contact_note') {
    const note = normalizeNote(result);
    return ContactAIViewBuilder.buildNoteCreateConfirmation(
      { contactId: input.contactId || input.id, name: result?.contactName || input.name },
      note,
    );
  }
  if (toolName === 'get_contact_notes') {
    return ContactAIViewBuilder.buildNotesList(normalizeNotes(result || []));
  }
  if (toolName === 'find_contact_by_phone') {
    if (!result) return ContactAIViewBuilder.buildEmptySearchResults();
    return ContactAIViewBuilder.buildContactDetails(normalizeContact(result));
  }
  if (!result) {
    if (toolName === 'get_contact') {
      return ContactAIViewBuilder.buildContactNotFoundError(input.contactId || input.id);
    }
    return result;
  }
  const list = Array.isArray(result) ? result : (result?.contacts || null);
  if (toolName === 'search_contacts' || list) {
    const contacts = normalizeContacts(list || (Array.isArray(result) ? result : [result]));
    const total = result?.total || contacts.length;
    return contacts.length === 0
      ? ContactAIViewBuilder.buildEmptySearchResults()
      : ContactAIViewBuilder.buildSearchResults(contacts, { total, shown: contacts.length, hasMore: total > contacts.length });
  }
  const normalized = normalizeContact(result);
  switch (toolName) {
    case 'get_contact':
      return ContactAIViewBuilder.buildContactDetails(normalized);
    case 'create_contact':
      return ContactAIViewBuilder.buildCreateConfirmation(normalized);
    case 'update_contact':
    case 'update_contact_role':
      return ContactAIViewBuilder.buildUpdateConfirmation(normalized, {});
    case 'delete_contact':
      return ContactAIViewBuilder.buildDeleteConfirmation(normalized);
    default:
      return normalized;
  }
}

export default {
  transformWithAiDto,
  USE_AI_DTO_FOR_LEADS,
  USE_AI_DTO_FOR_OWNERS,
  USE_AI_DTO_FOR_TENANTS,
  USE_AI_DTO_FOR_MEETINGS,
  USE_AI_DTO_FOR_BUYERS,
  USE_AI_DTO_FOR_PROPERTIES,
  USE_AI_DTO_FOR_CONTACTS,
};
