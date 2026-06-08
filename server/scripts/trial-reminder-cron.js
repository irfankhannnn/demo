/**
 * trial-reminder-cron.js
 * Daily cron at 09:00 IST (03:30 UTC) — sends trial reminder emails via Brevo.
 * 
 * Queries Subscriptions where paymentStatus='trialing'.
 * Sends emails at:
 *   - Day 10 (4 days left): soft pitch
 *   - Day 12 (2 days left): urgency + tiers
 *   - Day 14 (1 day left): last chance
 *   - Day 3 post-expiry: reactivation offer (7 extra days)
 * 
 * Idempotent: Subscriptions.lastTrialEmail stores last email type sent; skip if already sent.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-south-1',
  ...(process.env.DYNAMODB_ENDPOINT && { endpoint: process.env.DYNAMODB_ENDPOINT }),
});
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.SUBSCRIPTIONS_TABLE || 'Subscriptions';

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_SENDER = { name: 'RealEstateFlow', email: process.env.BREVO_SENDER_EMAIL || 'noreply@realestateflow.in' };

const EMAIL_TEMPLATES = {
  'trial-day-10': {
    subject: '4 days left on your RealEstateFlow trial',
    templateId: null, // Use Brevo template ID when configured
  },
  'trial-day-12': {
    subject: '2 days left — pick a plan to keep going',
    templateId: null,
  },
  'trial-day-14': {
    subject: 'Your trial ends tomorrow — last chance for ₹999',
    templateId: null,
  },
  'trial-expired-day-3': {
    subject: 'We miss you — 7 extra days if you upgrade today',
    templateId: null,
  },
};

async function sendBrevoEmail(to, emailType, params) {
  if (!BREVO_API_KEY) {
    console.log(`[DRY-RUN] Would send ${emailType} to ${to}`);
    return;
  }

  const template = EMAIL_TEMPLATES[emailType];
  const body = {
    sender: BREVO_SENDER,
    to: [{ email: to }],
    subject: template.subject,
    htmlContent: `<p>Hi,</p><p>${template.subject}.</p><p><a href="https://app.realestateflow.in/billing?upgrade=true">Upgrade now →</a></p>`,
    params,
  };

  if (template.templateId) {
    body.templateId = template.templateId;
    delete body.htmlContent;
    delete body.subject;
  }

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': BREVO_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`Brevo send failed for ${to} (${emailType}):`, err);
  } else {
    console.log(`Sent ${emailType} to ${to}`);
  }
}

async function markEmailSent(tenantId, emailType) {
  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { tenantId },
    UpdateExpression: 'SET lastTrialEmail = :type, lastTrialEmailAt = :now',
    ExpressionAttributeValues: {
      ':type': emailType,
      ':now': new Date().toISOString(),
    },
  }));
}

async function processTrialReminders() {
  const now = Date.now();
  let lastKey = undefined;
  let processed = 0;

  do {
    const result = await docClient.send(new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: 'paymentStatus = :trialing OR (paymentStatus = :trialing AND isPaying = :false)',
      ExpressionAttributeValues: {
        ':trialing': 'trialing',
        ':false': false,
      },
      ...(lastKey && { ExclusiveStartKey: lastKey }),
    }));

    for (const sub of result.Items || []) {
      const trialEndsAt = new Date(sub.trialEndsAt).getTime();
      const msLeft = trialEndsAt - now;
      const daysLeft = msLeft / 86400000;
      const daysSinceExpiry = -daysLeft;

      let emailType = null;

      if (daysLeft >= 3 && daysLeft < 4) {
        emailType = 'trial-day-10';
      } else if (daysLeft >= 1 && daysLeft < 2) {
        emailType = 'trial-day-12';
      } else if (daysLeft >= 0 && daysLeft < 1) {
        emailType = 'trial-day-14';
      } else if (daysSinceExpiry >= 3 && daysSinceExpiry < 4 && !sub.isPaying) {
        emailType = 'trial-expired-day-3';
      }

      if (!emailType) continue;
      if (sub.lastTrialEmail === emailType) continue; // idempotent

      // Need tenant contact email — fetch from Users table or use a stored email
      const email = sub.contactEmail || sub.adminEmail;
      if (!email) {
        console.warn(`No contact email for tenant ${sub.tenantId}, skipping ${emailType}`);
        continue;
      }

      await sendBrevoEmail(email, emailType, {
        trialDaysLeft: Math.max(0, Math.ceil(daysLeft)),
        plan: sub.plan,
      });
      await markEmailSent(sub.tenantId, emailType);
      processed++;
    }

    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  console.log(`Trial reminder cron complete. Processed ${processed} emails.`);
}

// Lambda handler
export const handler = async () => {
  try {
    await processTrialReminders();
    return { statusCode: 200, body: 'OK' };
  } catch (err) {
    console.error('Trial reminder cron failed:', err);
    throw err;
  }
};

// CLI invocation
if (process.argv[1] && process.argv[1].includes('trial-reminder-cron')) {
  processTrialReminders().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
}
