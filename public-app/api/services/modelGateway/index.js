/**
 * Picks the model adapter by MODEL_PROVIDER and exposes one interface:
 *
 *   parseIntent({ query, city, cities[] }) → intent
 *   explain({ query, intent, listings[], relaxed }) → { why: {propertyId: text}, followUps[], assistantMessage }
 *
 * Adapters are loaded lazily so that a stack configured for Gemini never
 * instantiates a Bedrock client (and vice versa), and so tests can import
 * this module without either SDK doing anything at load time. Both adapters
 * throw on failure; the fallback policy lives in aiSearch.js, in one place.
 */

import { config } from '../../config/env.js';

let adapterPromise = null;

export function getGateway() {
  if (!adapterPromise) {
    adapterPromise = config.model.provider === 'bedrock'
      ? import('./bedrock.js')
      : import('./gemini.js');
  }
  return adapterPromise;
}

export async function parseIntent(args) {
  return (await getGateway()).parseIntent(args);
}

export async function explain(args) {
  return (await getGateway()).explain(args);
}

export function providerName() {
  return config.model.provider === 'bedrock' ? 'bedrock' : 'gemini';
}
