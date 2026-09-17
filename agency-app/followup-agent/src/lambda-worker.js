// AWS Lambda handler for the worker (EventBridge schedule + event rules).
//
// Async invocation: a thrown error triggers Lambda's built-in retry (2x) and
// then the SQS dead-letter destination configured in the template. Handlers
// only throw for transport failures, never for "we decided not to call".

import { hydrateConfigFromSecrets } from './config/secretsBootstrap.js';

let workerPromise = null;

function loadWorker() {
  if (!workerPromise) {
    workerPromise = hydrateConfigFromSecrets().then(() => import('./handlers/worker.js'));
  }
  return workerPromise;
}

export const handler = async (event) => {
  const worker = await loadWorker();
  return worker.route(event);
};

export default handler;
