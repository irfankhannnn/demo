// Worker entry: routes one Lambda invocation to the right handler.
//
// One function serves both the EventBridge schedule (dispatcher tick +
// watchdog) and the three event-pattern rules. Splitting them into separate
// Lambdas would only duplicate the cold-start and the IAM role for no gain.

import * as engine from '../domain/jobEngine.js';
import * as events from './eventHandlers.js';
import { EVENTS } from '../config/constants.js';
import { logger } from '../utils/logger.js';

function parseDetail(event) {
  const detail = event?.detail;
  if (typeof detail === 'string') {
    try { return JSON.parse(detail); } catch { return {}; }
  }
  return detail || {};
}

/** Dispatcher tick: place due calls, then sweep stuck ones. */
export async function tick(now = new Date()) {
  const dispatched = await engine.dispatchDueJobs(now);
  const watchdog = await engine.runWatchdog(now);
  logger.info('tick complete', {
    dispatched: dispatched.length,
    called: dispatched.filter((r) => r.result === 'called').length,
    watchdog: watchdog.length,
  });
  return { dispatched, watchdog };
}

export async function route(event = {}) {
  const source = event.source;
  const detailType = event['detail-type'];

  // Manual invocation: { action: 'tick' }
  if (event.action === 'tick' || source === EVENTS.SCHEDULE_SOURCE) {
    return tick();
  }

  const detail = parseDetail(event);

  if (source === EVENTS.LEAD_SOURCE && detailType === EVENTS.LEAD_CREATED) {
    return events.onLeadCreated(detail);
  }
  if (source === EVENTS.MEETING_SOURCE && detailType === EVENTS.MEETING_COMPLETED) {
    return events.onMeetingCompleted(detail);
  }
  if (source === EVENTS.MEETING_SOURCE && detailType === EVENTS.MEETING_CANCELLED) {
    return events.onMeetingCancelled(detail);
  }
  if (source === EVENTS.CALL_SOURCE && detailType === EVENTS.CALL_ENDED) {
    return events.onCallEnded(detail);
  }

  logger.warn('unhandled event', { source, detailType });
  return { ignored: true, source, detailType };
}

export default { route, tick };
