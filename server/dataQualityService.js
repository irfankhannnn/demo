import {
  getLeads,
  getOwners,
  getCustomers,
  getProperties,
} from './crmDynamodbService.js';
import { logger } from './logger.js';

function isLeadIncomplete(lead) {
  if (!lead.phone) return true;
  const type = lead.leadType;
  if (type === 'buyer' && !lead.buyerRequirement) return true;
  if (type === 'tenant' && !lead.tenantRequirement) return true;
  if ((type === 'seller' || type === 'owner') && !lead.sellerProperty && !lead.ownerProperty) return true;
  return false;
}

function isOwnerIncomplete(owner) {
  return !owner.panNumber || !owner.aadharNumber;
}

function isTenantIncomplete(tenant) {
  return !tenant.aadharNumber || !tenant.aadharDocS3Key || !tenant.photoS3Key;
}

function isPropertyIncomplete(property) {
  if (!property.ownerId) return true;
  if (property.status === 'rental' && !property.rentalInfo) return true;
  if (property.status === 'sale' && !property.saleInfo) return true;
  if (property.verificationStatus && property.verificationStatus !== 'done') return true;
  return false;
}

export async function findIncomplete(tenantId) {
  const [leadsResult, ownersResult, tenantsResult, propertiesResult] = await Promise.all([
    getLeads(tenantId, {}),
    getOwners(tenantId, {}),
    getCustomers(tenantId, {}),
    getProperties(tenantId, {}),
  ]);

  const leads = (leadsResult?.leads || leadsResult || []).filter(isLeadIncomplete).map((l) => ({
    id: l.leadId, name: l.name, phone: l.phone, type: 'lead',
  }));

  const owners = (ownersResult?.owners || ownersResult || []).filter(isOwnerIncomplete).map((o) => ({
    id: o.ownerId, name: o.name, phone: o.phone, type: 'owner',
  }));

  const tenants = (tenantsResult?.customers || tenantsResult || []).filter(isTenantIncomplete).map((t) => ({
    id: t.customerId, name: t.name, phone: t.phone, type: 'tenant',
  }));

  const properties = (propertiesResult?.properties || propertiesResult || []).filter(isPropertyIncomplete).map((p) => ({
    id: p.propertyId, name: p.title || p.name, details: p.area || p.address,
  }));

  logger.info('dataQuality.incomplete', { tenantId, leads: leads.length, owners: owners.length });
  return { leads, owners, tenants, properties };
}

export async function findExpiringAgreements(tenantId, withinDays = 30) {
  const now = Date.now();
  const windowMs = withinDays * 24 * 60 * 60 * 1000;
  const expiring = [];

  const tenantsResult = await getCustomers(tenantId, { leaseEndingWithinDays: withinDays });
  const tenants = tenantsResult?.customers || tenantsResult || [];

  for (const tenant of tenants) {
    const endDate = tenant.currentRental?.leaseEndDate;
    if (!endDate) continue;
    const endMs = new Date(endDate).getTime();
    if (endMs - now <= windowMs && endMs >= now) {
      expiring.push({
        propertyId: tenant.currentRental?.propertyId,
        propertyName: tenant.currentRental?.propertyName || tenant.name,
        endDate,
        assignedTo: tenant.assignedTo,
        tenantId: tenant.customerId,
      });
    }
  }

  return expiring;
}
