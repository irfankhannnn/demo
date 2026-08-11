/**
 * Single source of truth for the Hot/Warm/Cold lead-temperature rubric.
 * Used by:
 *  - scripts/lead-qualifier-handler.js (LLM fallback, text-only qualification)
 *  - routes/aiCallingInternal.js (context served to the AI qualification call)
 * so a lead qualified by phone and one qualified by text land on the same
 * three buckets, meaning the same thing.
 */

// City-level values don't count as "named an area/building" — matches the
// city dropdown in real-estate-crm-app/src/components/BuyerRequirementFields.tsx.
const CITY_LEVEL_VALUES = new Set(['mumbai', 'pune', 'thane', 'navi mumbai']);

export function hasNamedAreaOrBuilding(lead) {
  const area = lead?.buyerRequirement?.preferredArea
    || lead?.tenantRequirement?.preferredArea
    || lead?.preferredArea;
  if (!area || !String(area).trim()) return false;
  return !CITY_LEVEL_VALUES.has(String(area).trim().toLowerCase());
}

export function buildRubricContext(lead) {
  return {
    hasNamedAreaOrBuilding: hasNamedAreaOrBuilding(lead),
    requirementType: lead?.buyerRequirement?.requirement || null,
  };
}

export const LEAD_TEMPERATURE_RUBRIC = `You are qualifying a real-estate lead into HOT, WARM, or COLD.

HOT: the customer wants a property immediately AND has already named
a specific area or building (not just "somewhere nice").
WARM: the customer wants to visit a property and decide in person,
but hasn't fixed on one area/building yet.
COLD: the customer's timeline is roughly a couple of months out —
early research, not ready to commit or visit yet.`;

export function buildQualifierPrompt(lead) {
  const rubricContext = buildRubricContext(lead);
  return `${LEAD_TEMPERATURE_RUBRIC}

Lead data: ${JSON.stringify(lead)}
Known context: ${JSON.stringify(rubricContext)}

Return JSON: {"score":"HOT|WARM|COLD","scoreValue":0-100,"reasons":["..."]}`;
}
