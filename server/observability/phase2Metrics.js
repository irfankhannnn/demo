/**
 * Phase 2 Metrics and Observability
 * Tracks WhatsApp integration, conversation state, and AI agent behavior
 */
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import { logger } from '../logger.js';

const ENABLED = process.env.CLOUDWATCH_METRICS_ENABLED === 'true';
const NAMESPACE = 'RealEstateFlow/Phase2';
const cw = new CloudWatchClient({ region: process.env.AWS_REGION || 'ap-south-1' });

/**
 * Emit a metric to CloudWatch under the Phase 2 namespace.
 * @param {string} MetricName
 * @param {number} Value
 * @param {string} Unit
 * @param {Array<{Name: string, Value: string}>} Dimensions
 */
async function emit(MetricName, Value = 1, Unit = 'Count', Dimensions = []) {
  if (!ENABLED) return;
  try {
    await cw.send(new PutMetricDataCommand({
      Namespace: NAMESPACE,
      MetricData: [{ MetricName, Value, Unit, Timestamp: new Date(), Dimensions }],
    }));
  } catch (err) {
    logger.warn('phase2Metrics.emit.failed', { MetricName, error: err.message });
  }
}

/**
 * Metrics for Phase 2 features
 */
export const phase2Metrics = {
  // Conversation State Metrics
  conversationStateCreated: (tenantId, contactPhone) =>
    emit('conversation.state.created', 1, 'Count', [
      { Name: 'TenantId', Value: tenantId },
      { Name: 'Feature', Value: 'ConversationState' },
    ]),

  conversationStateResolved: (tenantId, contactPhone, resolution) =>
    emit('conversation.state.resolved', 1, 'Count', [
      { Name: 'TenantId', Value: tenantId },
      { Name: 'Resolution', Value: resolution },
      { Name: 'Feature', Value: 'ConversationState' },
    ]),

  // Personality Injection Metrics
  personalityInjected: (tenantId, agentId, personality) =>
    emit('personality.injected', 1, 'Count', [
      { Name: 'TenantId', Value: tenantId },
      { Name: 'AgentId', Value: agentId },
      { Name: 'Personality', Value: personality },
      { Name: 'Feature', Value: 'PersonalityInjection' },
    ]),

  // Context Loading Metrics
  conversationContextLoaded: (tenantId, messageCount) =>
    emit('context.conversation.loaded', messageCount, 'Count', [
      { Name: 'TenantId', Value: tenantId },
      { Name: 'Feature', Value: 'ContextLoading' },
    ]),

  leadContextEnriched: (tenantId, leadId) =>
    emit('context.lead.enriched', 1, 'Count', [
      { Name: 'TenantId', Value: tenantId },
      { Name: 'Feature', Value: 'ContextEnrichment' },
    ]),

  // Intent Detection Metrics
  intentDetected: (tenantId, intent) =>
    emit('intent.detected', 1, 'Count', [
      { Name: 'TenantId', Value: tenantId },
      { Name: 'Intent', Value: intent },
      { Name: 'Feature', Value: 'IntentDetection' },
    ]),

  // Tool Access Control Metrics
  toolAccessGranted: (tenantId, userId, toolName, category) =>
    emit('tool.access.granted', 1, 'Count', [
      { Name: 'TenantId', Value: tenantId },
      { Name: 'ToolName', Value: toolName },
      { Name: 'UserCategory', Value: category },
      { Name: 'Feature', Value: 'ToolAccessControl' },
    ]),

  toolAccessDenied: (tenantId, userId, toolName, category) =>
    emit('tool.access.denied', 1, 'Count', [
      { Name: 'TenantId', Value: tenantId },
      { Name: 'ToolName', Value: toolName },
      { Name: 'UserCategory', Value: category },
      { Name: 'Feature', Value: 'ToolAccessControl' },
    ]),

  // WhatsApp Integration Metrics
  whatsappMessageReceived: (tenantId, fromMe) =>
    emit('whatsapp.message.received', 1, 'Count', [
      { Name: 'TenantId', Value: tenantId },
      { Name: 'Direction', Value: fromMe ? 'outgoing' : 'incoming' },
      { Name: 'Feature', Value: 'WhatsAppIntegration' },
    ]),

  whatsappWebhookProcessed: (tenantId, status) =>
    emit('whatsapp.webhook.processed', 1, 'Count', [
      { Name: 'TenantId', Value: tenantId },
      { Name: 'Status', Value: status },
      { Name: 'Feature', Value: 'WhatsAppIntegration' },
    ]),

  // Agent Behavior Metrics
  agentResponseTime: (tenantId, agentId, durationMs) =>
    emit('agent.response.time', durationMs, 'Milliseconds', [
      { Name: 'TenantId', Value: tenantId },
      { Name: 'AgentId', Value: agentId },
      { Name: 'Feature', Value: 'AgentBehavior' },
    ]),

  agentToolUsage: (tenantId, agentId, toolName) =>
    emit('agent.tool.usage', 1, 'Count', [
      { Name: 'TenantId', Value: tenantId },
      { Name: 'AgentId', Value: agentId },
      { Name: 'ToolName', Value: toolName },
      { Name: 'Feature', Value: 'AgentBehavior' },
    ]),

  // Knowledge Base Metrics
  knowledgeBaseAccessed: (tenantId, docType) =>
    emit('knowledge.base.accessed', 1, 'Count', [
      { Name: 'TenantId', Value: tenantId },
      { Name: 'DocType', Value: docType },
      { Name: 'Feature', Value: 'KnowledgeBase' },
    ]),

  // Context Builder Metrics
  toolContextBuilt: (tenantId, toolName) =>
    emit('tool.context.built', 1, 'Count', [
      { Name: 'TenantId', Value: tenantId },
      { Name: 'ToolName', Value: toolName },
      { Name: 'Feature', Value: 'ToolContextBuilder' },
    ]),
};

/**
 * CloudWatch Alarms for Phase 2
 */
export const phase2Alarms = {
  // Conversation State Alarms
  conversationStateFailureAlarm: {
    MetricName: 'conversation.state.created',
    Threshold: 0,
    EvaluationPeriods: 5,
    Period: 300,
    ComparisonOperator: 'LessThanThreshold',
    AlarmDescription: 'Alert when conversation state creation fails',
  },

  // Tool Access Control Alarms
  toolAccessDeniedAlarm: {
    MetricName: 'tool.access.denied',
    Threshold: 20,
    EvaluationPeriods: 5,
    Period: 300,
    ComparisonOperator: 'GreaterThanThreshold',
    AlarmDescription: 'Alert when tool access is denied frequently',
  },

  // Agent Performance Alarms
  agentResponseTimeAlarm: {
    MetricName: 'agent.response.time',
    Threshold: 5000, // 5 seconds
    EvaluationPeriods: 3,
    Period: 300,
    ComparisonOperator: 'GreaterThanThreshold',
    Statistic: 'Average',
    AlarmDescription: 'Alert when agent response time exceeds threshold',
  },

  // WhatsApp Integration Alarms
  whatsappWebhookFailureAlarm: {
    MetricName: 'whatsapp.webhook.processed',
    Threshold: 0,
    EvaluationPeriods: 3,
    Period: 300,
    ComparisonOperator: 'LessThanThreshold',
    AlarmDescription: 'Alert when WhatsApp webhook processing fails',
  },
};

/**
 * CloudWatch Dashboard for Phase 2
 */
export const phase2Dashboard = {
  DashboardName: 'RealEstateFlow-Phase2-Metrics',
  DashboardBody: {
    widgets: [
      {
        type: 'metric',
        properties: {
          metrics: [
            ['RealEstateFlow/Phase2', 'conversation.state.created', { stat: 'Sum' }],
            ['.', 'conversation.state.resolved', { stat: 'Sum' }],
            ['.', 'intent.detected', { stat: 'Sum' }],
          ],
          period: 300,
          stat: 'Sum',
          region: 'ap-south-1',
          title: 'Conversation State Metrics',
        },
      },
      {
        type: 'metric',
        properties: {
          metrics: [
            ['RealEstateFlow/Phase2', 'tool.access.granted', { stat: 'Sum' }],
            ['.', 'tool.access.denied', { stat: 'Sum' }],
          ],
          period: 300,
          stat: 'Sum',
          region: 'ap-south-1',
          title: 'Tool Access Control Metrics',
        },
      },
      {
        type: 'metric',
        properties: {
          metrics: [
            ['RealEstateFlow/Phase2', 'agent.response.time', { stat: 'Average' }],
            ['.', 'agent.tool.usage', { stat: 'Sum' }],
          ],
          period: 300,
          stat: 'Average',
          region: 'ap-south-1',
          title: 'Agent Performance Metrics',
        },
      },
      {
        type: 'metric',
        properties: {
          metrics: [
            ['RealEstateFlow/Phase2', 'whatsapp.message.received', { stat: 'Sum' }],
            ['.', 'whatsapp.webhook.processed', { stat: 'Sum' }],
          ],
          period: 300,
          stat: 'Sum',
          region: 'ap-south-1',
          title: 'WhatsApp Integration Metrics',
        },
      },
      {
        type: 'metric',
        properties: {
          metrics: [
            ['RealEstateFlow/Phase2', 'personality.injected', { stat: 'Sum' }],
            ['.', 'context.conversation.loaded', { stat: 'Sum' }],
            ['.', 'context.lead.enriched', { stat: 'Sum' }],
          ],
          period: 300,
          stat: 'Sum',
          region: 'ap-south-1',
          title: 'Context and Personality Metrics',
        },
      },
    ],
  },
};

export default phase2Metrics;
