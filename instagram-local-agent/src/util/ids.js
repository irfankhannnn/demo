import crypto from 'node:crypto';

export const uuid = () => crypto.randomUUID();

/** Stable id derived from parts - lets re-runs be idempotent without a server round trip. */
export function stableId(prefix, ...parts) {
  const h = crypto.createHash('sha256').update(parts.join('\u0000')).digest('hex').slice(0, 24);
  return prefix ? `${prefix}_${h}` : h;
}
