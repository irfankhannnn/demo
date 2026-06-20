import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import { logger } from '../logger.js';

const ENABLED = process.env.CLOUDWATCH_METRICS_ENABLED === 'true';
const NAMESPACE = process.env.CLOUDWATCH_NAMESPACE || 'RealEstateFlow/MVP';
const cw = new CloudWatchClient({ region: process.env.AWS_REGION || 'ap-south-1' });

async function emit(MetricName, Value = 1, Unit = 'Count', Dimensions = []) {
  if (!ENABLED) return;
  try {
    await cw.send(new PutMetricDataCommand({
      Namespace: NAMESPACE,
      MetricData: [{ MetricName, Value, Unit, Timestamp: new Date(), Dimensions }],
    }));
  } catch (err) {
    logger.warn('cloudwatch.emit.failed', { MetricName, error: err.message });
  }
}

export const metrics = {
  creditInsufficient: (tenantId) =>
    emit('creditService.deductCredits.insufficient', 1, 'Count', [{ Name: 'TenantId', Value: tenantId }]),

  emailFallbackToBrevo: () =>
    emit('emailService.fallback_to_brevo', 1, 'Count'),

  emailBothFailed: () =>
    emit('emailService.both_failed', 1, 'Count'),

  emailSentViaSes: () =>
    emit('emailService.sent_via_ses', 1, 'Count'),

  webhookReceived: (provider) =>
    emit('webhook.received', 1, 'Count', [{ Name: 'Provider', Value: provider }]),

  webhookSignatureInvalid: (provider) =>
    emit('webhook.signature_invalid', 1, 'Count', [{ Name: 'Provider', Value: provider }]),

  agentActionInvoked: (tenantId, action) =>
    emit('agent.action.invoked', 1, 'Count', [
      { Name: 'TenantId', Value: tenantId },
      { Name: 'Action', Value: action },
    ]),

  agentActionFailed: (tenantId, action) =>
    emit('agent.action.failed', 1, 'Count', [
      { Name: 'TenantId', Value: tenantId },
      { Name: 'Action', Value: action },
    ]),

  cronTenantFailed: (cronName, tenantId) =>
    emit('cron.tenant.failed', 1, 'Count', [
      { Name: 'CronName', Value: cronName },
      { Name: 'TenantId', Value: tenantId },
    ]),

  creditReset: (tenantId) =>
    emit('creditReset.completed', 1, 'Count', [{ Name: 'TenantId', Value: tenantId }]),
};
