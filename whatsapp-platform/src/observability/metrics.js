/**
 * CloudWatch metrics publisher.
 * No-op when CLOUDWATCH_METRICS_ENABLED=false (local dev / cost control).
 */
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import {
  CLOUDWATCH_METRICS_ENABLED,
  CLOUDWATCH_METRICS_NAMESPACE,
  AWS_REGION,
  ECS_TASK_ID,
  MAX_SESSIONS_PER_TASK,
} from '../config.js';
import { logger } from '../logger.js';

let cwClient = null;
function getCw() {
  if (!cwClient) cwClient = new CloudWatchClient({ region: AWS_REGION });
  return cwClient;
}

/**
 * Publish session count metrics to CloudWatch.
 * @param {{ activeSessions: number, maxSessions: number }} snapshot
 */
export async function publishSessionMetrics(snapshot) {
  if (!CLOUDWATCH_METRICS_ENABLED) return;
  const utilization = MAX_SESSIONS_PER_TASK > 0
    ? Math.round((snapshot.activeSessions / MAX_SESSIONS_PER_TASK) * 100)
    : 0;
  try {
    await getCw().send(new PutMetricDataCommand({
      Namespace: CLOUDWATCH_METRICS_NAMESPACE,
      MetricData: [
        {
          MetricName: 'ActiveSessions',
          Value: snapshot.activeSessions,
          Unit: 'Count',
          Dimensions: [{ Name: 'TaskId', Value: ECS_TASK_ID }],
        },
        {
          MetricName: 'SessionUtilization',
          Value: utilization,
          Unit: 'Percent',
          Dimensions: [{ Name: 'TaskId', Value: ECS_TASK_ID }],
        },
      ],
    }));
    logger.debug({ activeSessions: snapshot.activeSessions, utilization }, 'metrics.published');
  } catch (err) {
    logger.warn({ error: err.message }, 'metrics.publish.failed');
  }
}
