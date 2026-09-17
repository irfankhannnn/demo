import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseHHMM, zonedParts, zonedTimeToUtc, nextSlotWithinWindow, dueBucketsToScan, addMinutes, safeTimeZone,
} from './time.js';

const IST = { businessHoursStart: '10:00', businessHoursEnd: '19:00', timezone: 'Asia/Kolkata' };

test('parseHHMM', () => {
  assert.equal(parseHHMM('10:00'), 600);
  assert.equal(parseHHMM('23:59'), 1439);
  assert.equal(parseHHMM('24:00'), null);
  assert.equal(parseHHMM(''), null);
});

test('zonedParts and zonedTimeToUtc round-trip in IST', () => {
  const instant = new Date('2026-09-14T04:30:00Z'); // 10:00 IST
  const parts = zonedParts(instant, 'Asia/Kolkata');
  assert.deepEqual([parts.year, parts.month, parts.day, parts.hour, parts.minute], [2026, 9, 14, 10, 0]);
  assert.equal(zonedTimeToUtc(parts, 'Asia/Kolkata').toISOString(), instant.toISOString());
});

test('nextSlotWithinWindow keeps a time already inside the window', () => {
  const from = new Date('2026-09-14T06:00:00Z'); // 11:30 IST
  assert.equal(nextSlotWithinWindow(from, IST).getTime(), from.getTime());
});

test('nextSlotWithinWindow moves an early-morning time to window start', () => {
  const from = new Date('2026-09-14T03:00:00Z'); // 08:30 IST
  assert.equal(nextSlotWithinWindow(from, IST).toISOString(), '2026-09-14T04:30:00.000Z');
});

test('nextSlotWithinWindow moves an evening time to next day window start', () => {
  const from = new Date('2026-09-14T15:00:00Z'); // 20:30 IST
  assert.equal(nextSlotWithinWindow(from, IST).toISOString(), '2026-09-15T04:30:00.000Z');
});

test('nextSlotWithinWindow rolls over month end', () => {
  const from = new Date('2026-09-30T15:00:00Z');
  assert.equal(nextSlotWithinWindow(from, IST).toISOString(), '2026-10-01T04:30:00.000Z');
});

test('nextSlotWithinWindow falls back to 10-19 when hours are malformed', () => {
  const from = new Date('2026-09-14T03:00:00Z');
  const slot = nextSlotWithinWindow(from, { businessHoursStart: 'x', businessHoursEnd: '09:00', timezone: 'Asia/Kolkata' });
  assert.equal(slot.toISOString(), '2026-09-14T04:30:00.000Z');
});

test('safeTimeZone falls back on unknown zones', () => {
  assert.equal(safeTimeZone('Not/AZone'), 'Asia/Kolkata');
  assert.equal(safeTimeZone('UTC'), 'UTC');
});

test('dueBucketsToScan covers today and two days back', () => {
  const now = new Date('2026-09-14T12:00:00Z');
  assert.deepEqual(dueBucketsToScan(now), ['2026-09-14', '2026-09-13', '2026-09-12']);
});

test('addMinutes', () => {
  assert.equal(addMinutes(new Date('2026-09-14T12:00:00Z'), 45).toISOString(), '2026-09-14T12:45:00.000Z');
});
