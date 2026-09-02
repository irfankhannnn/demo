// Internal API Routes for AI Calling Service
// These endpoints are called by the AI Calling Lambda (ai-calling-service/) to
// fetch CRM data and report call outcomes. Authenticated via a shared internal
// API key (x-api-key) + explicit tenant header (x-tenant-id) — never a user JWT,
// since these calls originate from another service, not a logged-in user.
//
// History: this router was fully built and working, then intentionally
// disabled before launch to reduce surface area (see ../DISABLED_FEATURES.md).
// It is re-enabled here as part of the Lead Temperature migration, which
// reuses this calling infrastructure for Hot/Warm/Cold qualification calls
// instead of building a new integration.

import express from 'express';
import {
  getLead,
  updateLead,
  getBuyer,
  getProperties,
  getProperty,
  getPropertiesByStatus,
  matchProperties,
  createMeeting,
  getOwner,
  getOwners,
} from '../crmDynamodbService.js';
import { notifyHotLead } from '../leadNotifications.js';
import { chargeForAiCall } from '../aiCallBilling.js';
import { logger } from '../logger.js';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { buildRubricContext } from '../utils/leadRubric.js';

const router = express.Router();
const eventBridge = new EventBridgeClient({ region: process.env.AWS_REGION || 'ap-south-1' });

// Internal API key validation middleware
const validateInternalApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const expectedKey = process.env.AI_CALLING_INTERNAL_API_KEY;

  if (!expectedKey) {
    logger.error('aiCallingInternal.not_configured', {});
    return res.status(500).json({ error: 'Internal API not configured' });
  }

  if (apiKey !== expectedKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
};

// Extract tenant ID
const extractTenantId = (req, res, next) => {
  const tenantId = req.headers['x-tenant-id'];
  if (!tenantId) {
    return res.status(400).json({ error: 'x-tenant-id header is required' });
  }
  req.tenantId = tenantId;
  next();
};

// Apply middleware to all routes
router.use(validateInternalApiKey);
router.use(extractTenantId);

// ============== Lead Context ==============

function buildLeadSummary(lead) {
  const parts = [];

  if (lead.name) parts.push(`Customer name is ${lead.name}`);
  const requirement = lead.buyerRequirement?.requirement;
  if (lead.leadType) parts.push(`looking to ${requirement === 'rent' ? 'rent' : requirement === 'heavy_deposit_ok' ? 'rent with a heavy deposit' : 'buy'}`);
  const budget = lead.buyerRequirement?.budget;
  if (budget) parts.push(`with budget around ${budget}`);
  const area = lead.buyerRequirement?.preferredArea;
  if (area) parts.push(`in ${area}`);
  if (lead.buyerRequirement?.propertyType) parts.push(`a ${lead.buyerRequirement.propertyType}`);
  if (lead.notes) parts.push(`Notes: ${lead.notes}`);

  return parts.join('. ');
}

// Get comprehensive lead context for AI call (qualification or otherwise)
router.get('/leads/:leadId/context', async (req, res) => {
  try {
    const lead = await getLead(req.tenantId, req.params.leadId);

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const context = {
      lead: {
        id: lead.leadId,
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        status: lead.status,
        leadType: lead.leadType,
        source: lead.source,
        requirement: lead.buyerRequirement?.requirement || null,
        budget: lead.buyerRequirement?.budget || null,
        preferredArea: lead.buyerRequirement?.preferredArea || null,
        propertyType: lead.buyerRequirement?.propertyType || null,
      },
      summary: buildLeadSummary(lead),
      preferences: {
        budget: lead.buyerRequirement?.budget || null,
        area: lead.buyerRequirement?.preferredArea || null,
        propertyType: lead.buyerRequirement?.propertyType || null,
        bhk: lead.buyerRequirement?.bhk || null,
      },
      // Pre-computed signal the Hot/Warm/Cold rubric leans on hardest, so the
      // call script and the LLM fallback don't have to re-derive it from free
      // text and risk disagreeing with each other.
      rubricContext: buildRubricContext(lead),
    };

    res.json(context);
  } catch (error) {
    logger.error('aiCallingInternal.getLeadContext.error', { error: error.message, tenantId: req.tenantId, leadId: req.params.leadId });
    res.status(500).json({ error: error.message || 'Failed to get lead context' });
  }
});

// ============== Properties ==============

/**
 * Semantic property matching for the voice agent.
 *
 * Separate from /properties/available because it costs a Bedrock round trip
 * before DynamoDB is touched, and a phone call has a latency budget. The agent
 * picks this when the caller describes what they want in prose; the exact-filter
 * endpoint stays for structured lookups.
 */
router.post('/properties/match', async (req, res) => {
  try {
    const { query, propertyType, minPrice, maxPrice, minBedrooms, maxBedrooms, limit } = req.body || {};

    if (!query || String(query).trim().length < 2) {
      return res.status(400).json({ error: 'A description to match against is required' });
    }

    const properties = await matchProperties(req.tenantId, {
      query: String(query),
      propertyType,
      minPrice: minPrice != null ? Number(minPrice) : undefined,
      maxPrice: maxPrice != null ? Number(maxPrice) : undefined,
      minBedrooms: minBedrooms != null ? Number(minBedrooms) : undefined,
      maxBedrooms: maxBedrooms != null ? Number(maxBedrooms) : undefined,
      status: 'available',
      limit: limit != null ? Number(limit) : 5,
    });

    const simplified = properties.map(p => ({
      propertyId: p.propertyId,
      propertyType: p.propertyType,
      bedrooms: p.bhk,
      area: p.area,
      city: p.city,
      buildingName: p.buildingName,
      rent: p.rentAmount || p.price,
      squareFeet: p.carpetArea,
      furnishing: p.furnishing,
      amenities: Array.isArray(p.amenities) ? p.amenities.slice(0, 5) : undefined,
      matchScore: p._score,
    }));

    res.json({ properties: simplified, count: simplified.length });
  } catch (error) {
    logger.error('aiCallingInternal.matchProperties.error', {
      error: error.message,
      tenantId: req.tenantId,
    });
    res.status(500).json({ error: error.message || 'Failed to match properties' });
  }
});

router.get('/properties/available', async (req, res) => {
  try {
    const { type, location, minPrice, maxPrice, bedrooms } = req.query;

    let properties = await getPropertiesByStatus(req.tenantId, 'available');

    if (type) {
      properties = properties.filter(p =>
        p.propertyType?.toLowerCase().includes(type.toLowerCase())
      );
    }
    if (location) {
      properties = properties.filter(p =>
        p.area?.toLowerCase().includes(location.toLowerCase()) ||
        p.city?.toLowerCase().includes(location.toLowerCase()) ||
        p.address?.toLowerCase().includes(location.toLowerCase())
      );
    }
    if (minPrice) {
      const min = parseInt(minPrice, 10);
      properties = properties.filter(p => (p.rent || p.price || 0) >= min);
    }
    if (maxPrice) {
      const max = parseInt(maxPrice, 10);
      properties = properties.filter(p => (p.rent || p.price || 0) <= max);
    }
    if (bedrooms) {
      const beds = parseInt(bedrooms, 10);
      properties = properties.filter(p => p.bedrooms === beds);
    }

    const simplified = properties.map(p => ({
      propertyId: p.propertyId,
      propertyType: p.propertyType,
      bedrooms: p.bedrooms,
      bathrooms: p.bathrooms,
      area: p.area,
      city: p.city,
      address: p.address,
      rent: p.rent || p.price,
      deposit: p.deposit || p.securityDeposit,
      squareFeet: p.squareFeet || p.carpetArea,
      furnishing: p.furnishing,
      amenities: p.amenities?.slice(0, 5),
      availableFrom: p.availableFrom,
    }));

    res.json(simplified);
  } catch (error) {
    logger.error('aiCallingInternal.getAvailableProperties.error', { error: error.message, tenantId: req.tenantId });
    res.status(500).json({ error: error.message || 'Failed to get properties' });
  }
});

router.get('/properties/:propertyId/details', async (req, res) => {
  try {
    const property = await getProperty(req.tenantId, req.params.propertyId);

    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    let ownerName = null;
    if (property.ownerId) {
      const owner = await getOwner(req.tenantId, property.ownerId);
      ownerName = owner?.name;
    }

    res.json({
      propertyId: property.propertyId,
      propertyType: property.propertyType,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      area: property.area,
      city: property.city,
      address: property.address,
      rent: property.rent || property.price,
      deposit: property.deposit || property.securityDeposit,
      squareFeet: property.squareFeet || property.carpetArea,
      furnishing: property.furnishing,
      amenities: property.amenities,
      description: property.description,
      availableFrom: property.availableFrom,
      floor: property.floor,
      totalFloors: property.totalFloors,
      facing: property.facing,
      parking: property.parking,
      petsAllowed: property.petsAllowed,
      bachelorsAllowed: property.bachelorsAllowed,
      ownerName,
      status: property.status,
    });
  } catch (error) {
    logger.error('aiCallingInternal.getPropertyDetails.error', { error: error.message, tenantId: req.tenantId, propertyId: req.params.propertyId });
    res.status(500).json({ error: error.message || 'Failed to get property details' });
  }
});

router.get('/properties/search', async (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Search query required' });
    }

    const { properties } = await getProperties(req.tenantId);
    const searchTerm = q.toLowerCase();

    const matches = properties.filter(p =>
      p.propertyType?.toLowerCase().includes(searchTerm) ||
      p.area?.toLowerCase().includes(searchTerm) ||
      p.city?.toLowerCase().includes(searchTerm) ||
      p.address?.toLowerCase().includes(searchTerm) ||
      p.description?.toLowerCase().includes(searchTerm)
    );

    res.json(matches.slice(0, 10));
  } catch (error) {
    logger.error('aiCallingInternal.searchProperties.error', { error: error.message, tenantId: req.tenantId });
    res.status(500).json({ error: error.message || 'Failed to search properties' });
  }
});

// ============== Site Visits ==============

router.post('/site-visits', async (req, res) => {
  try {
    const { leadId, propertyId, preferredDate, preferredTime, source } = req.body;

    if (!leadId || !propertyId) {
      return res.status(400).json({ error: 'leadId and propertyId are required' });
    }

    const [lead, property] = await Promise.all([
      getLead(req.tenantId, leadId),
      getProperty(req.tenantId, propertyId),
    ]);

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    let meetingDate = preferredDate;
    let meetingTime = preferredTime || '10:00';

    if (preferredDate?.toLowerCase() === 'today') {
      meetingDate = new Date().toISOString().split('T')[0];
    } else if (preferredDate?.toLowerCase() === 'tomorrow') {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      meetingDate = tomorrow.toISOString().split('T')[0];
    }

    const meeting = await createMeeting(req.tenantId, {
      title: `Site Visit - ${property.propertyType} in ${property.area}`,
      description: `Site visit scheduled via AI call for ${lead.name}`,
      meetingDate: meetingDate || new Date().toISOString().split('T')[0],
      meetingTime: meetingTime,
      meetingType: 'site_visit',
      entityType: 'LEAD',
      entityId: leadId,
      entityName: lead.name,
      propertyId: propertyId,
      propertyName: `${property.propertyType} in ${property.area}`,
      location: property.address || `${property.area}, ${property.city}`,
      status: 'scheduled',
      source: source || 'ai_call',
      createdBy: 'AI Calling Agent',
    });

    await updateLead(req.tenantId, leadId, {
      status: 'qualified',
      lastContactDate: new Date().toISOString(),
      notes: `${lead.notes || ''}\n[AI Call] Site visit scheduled for ${meetingDate} at ${meetingTime}`,
    });

    res.status(201).json({
      visitId: meeting.meetingId,
      date: meetingDate,
      time: meetingTime,
      propertyName: `${property.propertyType} in ${property.area}`,
      address: property.address || `${property.area}, ${property.city}`,
      status: 'scheduled',
    });
  } catch (error) {
    logger.error('aiCallingInternal.scheduleSiteVisit.error', { error: error.message, tenantId: req.tenantId });
    res.status(500).json({ error: error.message || 'Failed to schedule site visit' });
  }
});

// ============== Lead Outcome Update ==============

const VALID_TEMPERATURES = new Set(['HOT', 'WARM', 'COLD']);

// Update lead after any call — qualification or otherwise. Only qualification
// calls (callPurpose === 'lead_qualification', or any call that includes a
// `temperature`) write score/scoreValue/scoreReasons and fire lead.qualified,
// so a follow-up/reminder call doesn't silently overwrite an existing score.
router.patch('/leads/:leadId/call-outcome', async (req, res) => {
  try {
    const { callSessionId, status, duration, outcome, callPurpose, temperature, scoreValue, scoreReasons } = req.body;

    const lead = await getLead(req.tenantId, req.params.leadId);

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const notes = lead.notes || '';
    const callNote = `\n[AI Call ${new Date().toISOString()}] Purpose: ${callPurpose || 'n/a'}, Duration: ${duration}s, Status: ${status}, Outcome: ${outcome || 'N/A'}`;

    const updateData = {
      lastContactDate: new Date().toISOString(),
      lastContactMethod: 'ai_call',
      notes: notes + callNote,
    };

    if (outcome === 'site_visit_scheduled') {
      updateData.status = 'qualified';
    } else if (outcome === 'interested') {
      updateData.status = 'contacted';
    } else if (outcome === 'not_interested') {
      updateData.status = 'lost';
    }

    let willFireQualified = false;
    if (temperature && VALID_TEMPERATURES.has(String(temperature).toUpperCase())) {
      updateData.score = String(temperature).toUpperCase();
      updateData.scoreValue = typeof scoreValue === 'number' ? Math.min(100, Math.max(0, scoreValue)) : null;
      updateData.scoreReasons = scoreReasons ? String(scoreReasons).slice(0, 300) : null;
      updateData.scoredAt = new Date().toISOString();
      updateData.scoreSource = 'ai_call';
      willFireQualified = true;
    }

    const updatedLead = await updateLead(req.tenantId, req.params.leadId, updateData);

    // Bill the call once it has settled. Deliberately after the lead write and
    // deliberately non-throwing: the outcome of the call is worth more than the
    // charge for it, so a billing problem must never cost us the score. Charging
    // is deduplicated on callSessionId because Exotel's status webhook and
    // ElevenLabs' post-call webhook can both deliver a duration for one call.
    const billing = await chargeForAiCall({
      tenantId: req.tenantId,
      callSessionId,
      durationSecs: duration,
      leadId: req.params.leadId,
      callPurpose,
    });

    if (willFireQualified) {
      try {
        await eventBridge.send(new PutEventsCommand({
          Entries: [{
            Source: 'crm.leads',
            DetailType: 'lead.qualified',
            Detail: JSON.stringify({
              tenantId: req.tenantId,
              leadId: req.params.leadId,
              score: updateData.score,
              scoreValue: updateData.scoreValue,
              qualifiedAt: updateData.scoredAt,
            }),
          }],
        }));
        logger.info('aiCallingInternal.callOutcome.lead_qualified_event_published', { tenantId: req.tenantId, leadId: req.params.leadId, score: updateData.score });
      } catch (ebErr) {
        logger.warn('aiCallingInternal.callOutcome.lead_qualified_event_failed', { tenantId: req.tenantId, leadId: req.params.leadId, error: ebErr.message });
      }

      if (updateData.score === 'HOT') {
        notifyHotLead(req.tenantId, updatedLead).catch((err) =>
          logger.warn('aiCallingInternal.callOutcome.notify_hot_failed', { tenantId: req.tenantId, leadId: req.params.leadId, error: err.message })
        );
      }
    }

    res.json({
      success: true,
      score: updatedLead.score || null,
      assignedTo: updatedLead.assignedTo || null,
      billing: { charged: billing.charged, credits: billing.credits ?? 0, minutes: billing.minutes ?? 0 },
    });
  } catch (error) {
    logger.error('aiCallingInternal.callOutcome.error', { error: error.message, tenantId: req.tenantId, leadId: req.params.leadId });
    res.status(500).json({ error: error.message || 'Failed to update lead' });
  }
});

// ============== Buyers & Owners ==============

router.get('/buyers/:buyerId', async (req, res) => {
  try {
    const buyer = await getBuyer(req.tenantId, req.params.buyerId);

    if (!buyer) {
      return res.status(404).json({ error: 'Buyer not found' });
    }

    res.json({
      buyerId: buyer.buyerId,
      name: buyer.name,
      phone: buyer.phone,
      email: buyer.email,
      status: buyer.status,
      budget: buyer.budget,
      propertyType: buyer.propertyType,
      preferredLocations: buyer.preferredLocations,
      bedrooms: buyer.bedrooms,
      requirements: buyer.requirements,
    });
  } catch (error) {
    logger.error('aiCallingInternal.getBuyerDetails.error', { error: error.message, tenantId: req.tenantId, buyerId: req.params.buyerId });
    res.status(500).json({ error: error.message || 'Failed to get buyer' });
  }
});

router.get('/owners/:ownerId', async (req, res) => {
  try {
    const owner = await getOwner(req.tenantId, req.params.ownerId);

    if (!owner) {
      return res.status(404).json({ error: 'Owner not found' });
    }

    res.json({
      ownerId: owner.ownerId,
      name: owner.name,
      phone: owner.phone,
      email: owner.email,
      status: owner.status,
      notes: owner.notes,
      tags: owner.tags,
    });
  } catch (error) {
    logger.error('aiCallingInternal.getOwnerDetails.error', { error: error.message, tenantId: req.tenantId, ownerId: req.params.ownerId });
    res.status(500).json({ error: error.message || 'Failed to get owner' });
  }
});

router.get('/owners', async (req, res) => {
  try {
    const ownersResult = await getOwners(req.tenantId);
    const owners = ownersResult.owners || [];
    res.json({
      count: owners.length,
      owners: owners.map(o => ({
        ownerId: o.ownerId,
        name: o.name,
        phone: o.phone,
        email: o.email,
        status: o.status,
      })),
    });
  } catch (error) {
    logger.error('aiCallingInternal.listOwners.error', { error: error.message, tenantId: req.tenantId });
    res.status(500).json({ error: error.message || 'Failed to list owners' });
  }
});

export default router;
