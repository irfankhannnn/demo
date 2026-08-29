#!/usr/bin/env node
/**
 * Lead conversion data repair — dry-run by default.
 *
 * Inventories and optionally repairs:
 *  - buyer-role CONTACTs that match active (unconverted) leads by phone
 *  - stale convertingLockAt / ghost converted markers on active leads
 *  - partial-conversion orphans (BUYER/OWNER/CUSTOMER with source lead:X but lead still active)
 *
 * Usage:
 *   node server/scripts/repair-lead-conversion-data.js [--apply] [--tenant TENANT_ID]
 *
 * Without --apply, only writes a JSON report to server/scripts/reports/.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const APPLY = process.argv.includes('--apply');
const tenantIdx = process.argv.indexOf('--tenant');
const ONLY_TENANT = tenantIdx >= 0 ? process.argv[tenantIdx + 1] : null;

const TABLE = process.env.CRM_DYNAMODB_TABLE_NAME;
if (!TABLE) {
  console.error('CRM_DYNAMODB_TABLE_NAME is required');
  process.exit(1);
}

const doc = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' }),
);

function normalizePhone(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/[^0-9]/g, '');
  const withoutPrefix = digits.startsWith('91') && digits.length === 12
    ? digits.slice(2)
    : digits;
  return /^[6-9]\d{9}$/.test(withoutPrefix) ? withoutPrefix : digits.slice(-10);
}

function hasConversionTarget(lead) {
  const c = lead?.convertedTo;
  return !!(c && (c.entityId || c.contactId));
}

async function scanAll(filterExpression, values, names) {
  const items = [];
  let ExclusiveStartKey;
  do {
    const result = await doc.send(new ScanCommand({
      TableName: TABLE,
      FilterExpression: filterExpression,
      ExpressionAttributeValues: values,
      ExpressionAttributeNames: names,
      ExclusiveStartKey,
    }));
    items.push(...(result.Items || []));
    ExclusiveStartKey = result.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

async function main() {
  const report = {
    dryRun: !APPLY,
    generatedAt: new Date().toISOString(),
    leadDerivedBuyerContacts: [],
    staleLocks: [],
    ghostConverted: [],
    orphanEntities: [],
    ambiguous: [],
    applied: [],
  };

  let leads = await scanAll('EntityType = :t', { ':t': 'LEAD' });
  let contacts = await scanAll(
    'EntityType = :t AND #roles.#buyer = :b',
    { ':t': 'CONTACT', ':b': true },
    { '#roles': 'roles', '#buyer': 'buyer' },
  );
  let buyers = await scanAll('EntityType = :t', { ':t': 'BUYER' });
  let owners = await scanAll('EntityType = :t', { ':t': 'OWNER' });
  let customers = await scanAll('EntityType = :t', { ':t': 'CUSTOMER' });

  if (ONLY_TENANT) {
    const match = (i) => i.tenantId === ONLY_TENANT;
    leads = leads.filter(match);
    contacts = contacts.filter(match);
    buyers = buyers.filter(match);
    owners = owners.filter(match);
    customers = customers.filter(match);
  }

  const activeLeads = leads.filter((l) => !hasConversionTarget(l));
  const leadsByPhone = new Map();
  for (const lead of activeLeads) {
    const phone = normalizePhone(lead.phone);
    if (!phone) continue;
    const key = `${lead.tenantId}:${phone}`;
    if (!leadsByPhone.has(key)) leadsByPhone.set(key, []);
    leadsByPhone.get(key).push(lead);
  }

  for (const contact of contacts) {
    const phone = normalizePhone(contact.phone);
    if (!phone) continue;
    const key = `${contact.tenantId}:${phone}`;
    const matchingLeads = leadsByPhone.get(key) || [];
    if (matchingLeads.length === 1 && matchingLeads[0].leadType === 'buyer') {
      report.leadDerivedBuyerContacts.push({
        tenantId: contact.tenantId,
        contactId: contact.contactId,
        phone: contact.phone,
        leadId: matchingLeads[0].leadId,
        action: 'clear_buyer_role',
      });
    } else if (matchingLeads.length > 1) {
      report.ambiguous.push({
        type: 'contact_multiple_leads',
        tenantId: contact.tenantId,
        contactId: contact.contactId,
        leadIds: matchingLeads.map((l) => l.leadId),
      });
    }
  }

  for (const lead of activeLeads) {
    if (lead.convertingLockAt) {
      report.staleLocks.push({
        tenantId: lead.tenantId,
        leadId: lead.leadId,
        convertingLockAt: lead.convertingLockAt,
        action: 'remove_convertingLockAt',
      });
    }
    if (
      (lead.convertedAt || String(lead.status || '').toLowerCase() === 'converted')
      && !hasConversionTarget(lead)
    ) {
      report.ghostConverted.push({
        tenantId: lead.tenantId,
        leadId: lead.leadId,
        status: lead.status,
        convertedAt: lead.convertedAt,
        action: 'clear_ghost_converted_fields',
      });
    }
  }

  const checkOrphan = (entity, idField, entityType) => {
    const source = String(entity.source || entity.createdFrom || '');
    const m = source.match(/^lead:(.+)$/);
    if (!m) return;
    const leadId = m[1];
    const lead = leads.find((l) => l.tenantId === entity.tenantId && l.leadId === leadId);
    if (lead && !hasConversionTarget(lead)) {
      report.orphanEntities.push({
        tenantId: entity.tenantId,
        entityType,
        entityId: entity[idField],
        leadId,
        note: 'Entity exists while source lead is still active — review before delete',
      });
    }
  };

  buyers.forEach((b) => checkOrphan(b, 'buyerId', 'BUYER'));
  owners.forEach((o) => checkOrphan(o, 'ownerId', 'OWNER'));
  customers.forEach((c) => checkOrphan(c, 'customerId', 'CUSTOMER'));

  if (APPLY) {
    for (const row of report.leadDerivedBuyerContacts) {
      await doc.send(new UpdateCommand({
        TableName: TABLE,
        Key: {
          PK: `TENANT#${row.tenantId}#CONTACT#${row.contactId}`,
          SK: 'PROFILE',
        },
        UpdateExpression: 'SET #roles.#buyer = :false, updatedAt = :ua',
        ExpressionAttributeNames: { '#roles': 'roles', '#buyer': 'buyer' },
        ExpressionAttributeValues: {
          ':false': false,
          ':ua': new Date().toISOString(),
        },
      }));
      report.applied.push({ action: 'clear_buyer_role', ...row });
    }

    for (const row of report.staleLocks) {
      await doc.send(new UpdateCommand({
        TableName: TABLE,
        Key: {
          PK: `TENANT#${row.tenantId}#LEAD#${row.leadId}`,
          SK: 'PROFILE',
        },
        UpdateExpression: 'REMOVE convertingLockAt SET updatedAt = :ua',
        ExpressionAttributeValues: { ':ua': new Date().toISOString() },
      }));
      report.applied.push({ action: 'remove_lock', ...row });
    }

    for (const row of report.ghostConverted) {
      await doc.send(new UpdateCommand({
        TableName: TABLE,
        Key: {
          PK: `TENANT#${row.tenantId}#LEAD#${row.leadId}`,
          SK: 'PROFILE',
        },
        UpdateExpression: 'REMOVE convertedAt, convertedTo, convertingLockAt SET #status = :status, updatedAt = :ua',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':status': 'new',
          ':ua': new Date().toISOString(),
        },
      }));
      report.applied.push({ action: 'clear_ghost', ...row });
    }
  }

  const outDir = path.join(__dirname, 'reports');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(
    outDir,
    `lead-conversion-repair-${APPLY ? 'applied' : 'dryrun'}-${Date.now()}.json`,
  );
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2));

  console.log(JSON.stringify({
    dryRun: !APPLY,
    reportFile: outFile,
    counts: {
      leadDerivedBuyerContacts: report.leadDerivedBuyerContacts.length,
      staleLocks: report.staleLocks.length,
      ghostConverted: report.ghostConverted.length,
      orphanEntities: report.orphanEntities.length,
      ambiguous: report.ambiguous.length,
      applied: report.applied.length,
    },
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
