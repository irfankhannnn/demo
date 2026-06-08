// Internal API Routes for AI Calling Service
// These endpoints are called by the AI Calling Lambda to fetch CRM data

import express from 'express';
import {
  getLeads,
  getLead,
  updateLead,
  getBuyers,
  getBuyer,
  getProperties,
  getProperty,
  getPropertiesByStatus,
  createMeeting,
  getCustomer,
  getOwner,
  getOwners,
} from '../crmDynamodbService.js';

const router = express.Router();

/*
// ============== COMMENTED OUT: AI Calling Internal API disabled ==============
// All routes below are commented out as part of removing AI calling functionality

// Internal API key validation middleware
const validateInternalApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const expectedKey = process.env.AI_CALLING_INTERNAL_API_KEY;
  
  if (!expectedKey) {
    console.warn('AI_CALLING_INTERNAL_API_KEY not configured');
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

// Get comprehensive lead context for AI call
router.get('/leads/:leadId/context', async (req, res) => {
  try {
    const lead = await getLead(req.tenantId, req.params.leadId);
    
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    
    // Build context summary
    const context = {
      lead: {
        id: lead.leadId,
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        status: lead.status,
        priority: lead.priority,
        leadType: lead.leadType,
        source: lead.source,
        requirements: lead.requirements,
        budget: lead.budget,
        preferredLocations: lead.preferredLocations,
        propertyType: lead.propertyType,
      },
      summary: buildLeadSummary(lead),
      preferences: {
        budget: lead.budget,
        locations: lead.preferredLocations,
        propertyType: lead.propertyType,
        bedrooms: lead.bedrooms,
      },
    };
    
    res.json(context);
  } catch (error) {
    console.error('Get lead context error:', error);
    res.status(500).json({ error: error.message || 'Failed to get lead context' });
  }
});

function buildLeadSummary(lead) {
  const parts = [];
  
  if (lead.name) parts.push(`Customer name is ${lead.name}`);
  if (lead.leadType) parts.push(`looking to ${lead.leadType === 'buyer' ? 'buy' : 'rent'}`);
  if (lead.budget) parts.push(`with budget around ${lead.budget}`);
  if (lead.preferredLocations?.length) parts.push(`in ${lead.preferredLocations.join(' or ')}`);
  if (lead.propertyType) parts.push(`a ${lead.propertyType}`);
  if (lead.requirements) parts.push(`Requirements: ${lead.requirements}`);
  
  return parts.join('. ');
}

// ============== Properties ==============

// Get available properties with filters
router.get('/properties/available', async (req, res) => {
  try {
    const { type, location, minPrice, maxPrice, bedrooms } = req.query;
    
    let properties = await getPropertiesByStatus(req.tenantId, 'available');
    
    // Apply filters
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
    
    // Return simplified property data for AI
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
    console.error('Get available properties error:', error);
    res.status(500).json({ error: error.message || 'Failed to get properties' });
  }
});

// Get property details
router.get('/properties/:propertyId/details', async (req, res) => {
  try {
    const property = await getProperty(req.tenantId, req.params.propertyId);
    
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }
    
    // Get owner info (without sensitive data)
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
    console.error('Get property details error:', error);
    res.status(500).json({ error: error.message || 'Failed to get property details' });
  }
});

// Search properties by text
router.get('/properties/search', async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: 'Search query required' });
    }
    
    const properties = await getProperties(req.tenantId);
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
    console.error('Search properties error:', error);
    res.status(500).json({ error: error.message || 'Failed to search properties' });
  }
});

// ============== Site Visits ==============

// Schedule a site visit
router.post('/site-visits', async (req, res) => {
  try {
    const { leadId, propertyId, preferredDate, preferredTime, source } = req.body;
    
    if (!leadId || !propertyId) {
      return res.status(400).json({ error: 'leadId and propertyId are required' });
    }
    
    // Get lead and property info
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
    
    // Parse date/time
    let meetingDate = preferredDate;
    let meetingTime = preferredTime || '10:00';
    
    // Handle relative dates
    if (preferredDate?.toLowerCase() === 'today') {
      meetingDate = new Date().toISOString().split('T')[0];
    } else if (preferredDate?.toLowerCase() === 'tomorrow') {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      meetingDate = tomorrow.toISOString().split('T')[0];
    }
    
    // Create meeting
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
    
    // Update lead status
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
    console.error('Schedule site visit error:', error);
    res.status(500).json({ error: error.message || 'Failed to schedule site visit' });
  }
});

// ============== Lead Outcome Update ==============

// Update lead after call
router.patch('/leads/:leadId/call-outcome', async (req, res) => {
  try {
    const { callSessionId, status, duration, outcome, transcriptSummary } = req.body;
    
    const lead = await getLead(req.tenantId, req.params.leadId);
    
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    
    const notes = lead.notes || '';
    const callNote = `\n[AI Call ${new Date().toISOString()}] Duration: ${duration}s, Status: ${status}, Outcome: ${outcome || 'N/A'}`;
    
    const updateData = {
      lastContactDate: new Date().toISOString(),
      lastContactMethod: 'ai_call',
      notes: notes + callNote,
    };
    
    // Update status based on outcome
    if (outcome === 'site_visit_scheduled') {
      updateData.status = 'qualified';
    } else if (outcome === 'interested') {
      updateData.status = 'contacted';
    } else if (outcome === 'not_interested') {
      updateData.status = 'lost';
    }
    
    await updateLead(req.tenantId, req.params.leadId, updateData);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Update lead call outcome error:', error);
    res.status(500).json({ error: error.message || 'Failed to update lead' });
  }
});

// ============== Buyers & Owners ==============

// Get buyer details
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
    console.error('Get buyer details error:', error);
    res.status(500).json({ error: error.message || 'Failed to get buyer' });
  }
});

// Get owner details (replaces deprecated seller)
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
    console.error('Get owner details error:', error);
    res.status(500).json({ error: error.message || 'Failed to get owner' });
  }
});

// List owners (replaces deprecated sellers list)
router.get('/owners', async (req, res) => {
  try {
    const owners = await getOwners(req.tenantId);
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
*/
    console.error('List owners error:', error);
    res.status(500).json({ error: error.message || 'Failed to list owners' });
  }
});

export default router;
