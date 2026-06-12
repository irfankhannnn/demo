/**
 * Escalation cron — runs every 6 hours via EventBridge.
 * Scans AIEmployeeProvisioning for pending rows past SLA,
 * sets status=escalated, sends emails.
 */
import { listPendingProvisioning, updateProvisioning } from '../aiEmployeeProvisioningService.js';
import axios from 'axios';
import dotenv from 'dotenv';
import { serverTrack, shutdownPostHog } from '../lib/posthog.js';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });


async function sendBrevoEmail(templateId, to, params) {
  if (!templateId || !process.env.BREVO_API_KEY) return;
  try {
    await axios.post('https://api.brevo.com/v3/smtp/email', {
      templateId: parseInt(templateId, 10),
      to: [{ email: to }],
      params,
    }, {
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'Content-Type': 'application/json',
      },
    });
  } catch (err) {
    console.error('Brevo email failed (non-fatal):', err.message);
  }
}

async function runEscalation() {
  console.log('[escalation-cron] Starting SLA check...');
  const pendingRows = await listPendingProvisioning();
  const now = new Date();
  let escalatedCount = 0;

  for (const row of pendingRows) {
    const slaEnd = new Date(row.expectedSLAEnd);
    if (now > slaEnd) {
      console.log(`[escalation-cron] SLA breached for tenant ${row.tenantId}`);

      // Update status to escalated
      await updateProvisioning(row.tenantId, { status: 'escalated' });

      // Email founder with escalation notice (use founder-specific template)
      await sendBrevoEmail(
        process.env.BREVO_AI_EMPLOYEE_ESCALATED_FOUNDER_TEMPLATE_ID,
        process.env.FOUNDER_EMAIL || 'info@realestateflow.in',
        {
          tenantId: row.tenantId,
          agencyName: row.agencyName,
          contactPhone: row.contactPhone,
          contactEmail: row.contactEmail,
          paidAt: row.paidAt,
          expectedSLAEnd: row.expectedSLAEnd,
        }
      );

      // Customer apology email (use customer-specific template)
      if (row.contactEmail) {
        await sendBrevoEmail(
          process.env.BREVO_AI_EMPLOYEE_ESCALATED_CUSTOMER_TEMPLATE_ID,
          row.contactEmail,
          {
            agencyName: row.agencyName,
            expectedSLAEnd: row.expectedSLAEnd,
            founderWhatsApp: process.env.FOUNDER_WHATSAPP || '',
          }
        );
      }

      // PostHog event
      await serverTrack(row.tenantId, 'ai_employee_escalated', {
        tenantId: row.tenantId,
        paidAt: row.paidAt,
        expectedSLAEnd: row.expectedSLAEnd,
      });

      // NOTE: Razorpay credit note (₹500) is a manual step for M1
      console.log(`[escalation-cron] ₹500 credit note needed for tenant ${row.tenantId} (manual step)`);

      escalatedCount++;
    }
  }

  console.log(`[escalation-cron] Done. Escalated: ${escalatedCount}/${pendingRows.length} pending rows`);
}

// Lambda handler
export async function handler(event) {
  try {
    await runEscalation();
    return { statusCode: 200, body: JSON.stringify({ escalated: true }) };
  } finally {
    await shutdownPostHog();
  }

// Direct execution
if (process.argv[1] && process.argv[1].includes('escalation-cron')) {
  runEscalation()
    .then(() => process.exit(0))
    .catch(err => { console.error(err); process.exit(1); });
}
