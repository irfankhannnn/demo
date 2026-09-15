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
  // One line per job touched, so a tester can see *why* a due job was not
  // called (outside_business_hours, followup_calls_disabled, crm_unavailable, ...).
  for (const entry of dispatched) logger.info('dispatch result', entry);
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
  const handler = pickHandler(source, detailType);

  if (!handler) {
    logger.warn('unhandled event', { source, detailType });
    return { ignored: true, source, detailType };
  }

  const result = await handler(detail);
  // Logged for every event, including the ones deliberately ignored
  // (duplicate call.ended -> `ignored: already_handled`, etc.).
  logger.info('event handled', { source, detailType, ...(result && typeof result === 'object' ? result : { result }) });
  return result;
}

function pickHandler(source, detailType) {
  if (source === EVENTS.LEAD_SOURCE && detailType === EVENTS.LEAD_CREATED) return events.onLeadCreated;
  if (source === EVENTS.MEETING_SOURCE && detailType === EVENTS.MEETING_COMPLETED) return events.onMeetingCompleted;
  if (source === EVENTS.MEETING_SOURCE && detailType === EVENTS.MEETING_CANCELLED) return events.onMeetingCancelled;
  if (source === EVENTS.CALL_SOURCE && detailType === EVENTS.CALL_ENDED) return events.onCallEnded;
  return null;
}

export default { route, tick };
