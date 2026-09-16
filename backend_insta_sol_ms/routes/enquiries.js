// Enquiry pipeline (JWT auth).
//
//   GET   /enquiries                          newest first, filterable
//   PATCH /enquiries/:enquiryId               { status?, notes? }
//   POST  /enquiries/:enquiryId/push-to-crm   retry the CRM hand-off now

import express from 'express';
import { normaliseStatus, TEMPERATURES, ENQUIRY_STATUSES } from '../services/normalise.js';
import { logger } from '../logger.js';
import * as defaultDb from '../services/dynamoService.js';

const log = logger.child({ module: 'routes/enquiries' });

export function createEnquiriesRouter({ db = defaultDb, service } = {}) {
  const router = express.Router();

  // GET /enquiries?status=&temperature=&limit=&cursor=
  router.get('/', async (req, res) => {
    const { status, temperature, limit, cursor } = req.query;

    // An unknown filter value is a 400 rather than an empty list, so a frontend
    // typo is visible instead of looking like "no leads today".
    if (status && !ENQUIRY_STATUSES.has(status)) {
      return res.status(400).json({ error: 'Bad Request', details: `Unknown status: ${status}` });
    }
    if (temperature && !TEMPERATURES.has(temperature)) {
      return res.status(400).json({ error: 'Bad Request', details: `Unknown temperature: ${temperature}` });
    }

    try {
      const page = await db.listEnquiries(req.tenantId, { status, temperature, limit, cursor });
      return res.json({ enquiries: page.items, cursor: page.cursor });
    } catch (err) {
      log.error('enquiries.list.failed', { error: err.message });
      return res.status(500).json({ error: 'Internal Server Error', details: 'Failed to list enquiries' });
    }
  });

  router.patch('/:enquiryId', async (req, res) => {
    const { enquiryId } = req.params;
    const { status, notes } = req.body || {};

    if (status === undefined && notes === undefined) {
      return res.status(400).json({ error: 'Bad Request', details: 'Nothing to update' });
    }

    const patch = {};
    if (status !== undefined) {
      const valid = normaliseStatus(status);
      if (!valid) {
        return res.status(400).json({ error: 'Bad Request', details: `Unknown status: ${status}` });
      }
      patch.status = valid;
    }
    if (notes !== undefined) {
      if (typeof notes !== 'string') {
        return res.status(400).json({ error: 'Bad Request', details: 'notes must be a string' });
      }
      patch.notes = notes;
    }

    try {
      const updated = await db.updateEnquiry(req.tenantId, enquiryId, patch);
      if (!updated) {
        // The conditional update fails for a missing item AND for an item in
        // another tenant's partition — both are "not found" to this caller.
        return res.status(404).json({ error: 'Not Found', details: 'Enquiry not found' });
      }

      await db.putAuditEvent(req.tenantId, {
        action: 'enquiry.updated',
        enquiryId,
        // The status transition is worth auditing; the note body is not — it is
        // free text about a named person.
        status: patch.status ?? null,
        notesChanged: patch.notes !== undefined,
      });

      return res.json({ enquiry: updated });
    } catch (err) {
      log.error('enquiries.update.failed', { error: err.message, enquiryId });
      return res.status(500).json({ error: 'Internal Server Error', details: 'Failed to update enquiry' });
    }
  });

  router.post('/:enquiryId/push-to-crm', async (req, res) => {
    const { enquiryId } = req.params;
    try {
      const enquiry = await db.getEnquiry(req.tenantId, enquiryId);
      if (!enquiry) return res.status(404).json({ error: 'Not Found', details: 'Enquiry not found' });

      const crmSync = await service.promoteEnquiry(req.tenantId, enquiry, { force: true });
      await db.putAuditEvent(req.tenantId, { action: 'enquiry.pushed_to_crm', enquiryId, outcome: crmSync.status });
      return res.json({ enquiry: { ...enquiry, crmSync }, crmSync });
    } catch (err) {
      log.error('enquiries.push.failed', { error: err.message, enquiryId });
      return res.status(500).json({ error: 'Internal Server Error', details: 'Failed to push the enquiry to the CRM' });
    }
  });

  return router;
}

export default createEnquiriesRouter;
