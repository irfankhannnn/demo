// Time-zone aware calling-window helpers.
//
// Agencies configure business hours as local wall-clock times ("10:00" to
// "19:00" in Asia/Kolkata). Lambda runs in UTC, so every "is it a good time to
// call" decision has to be made against the tenant's zone. Node's Intl API is
// enough for this — no date library is pulled in for two conversions.

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Parse "HH:MM" into minutes since midnight; null when malformed. */
export function parseHHMM(value) {
  const m = TIME_RE.exec(String(value || '').trim());
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function partsFormatter(timeZone) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/** Wall-clock components of `date` in `timeZone`. */
export function zonedParts(date, timeZone) {
  const parts = partsFormatter(timeZone).formatToParts(date);
  const get = (type) => parseInt(parts.find((p) => p.type === type)?.value ?? '0', 10);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour') % 24,
    minute: get('minute'),
    second: get('second'),
  };
}

/**
 * The instant at which the given wall-clock time occurs in `timeZone`.
 * Uses the standard "guess in UTC, measure the offset, correct" trick.
 */
export function zonedTimeToUtc({ year, month, day, hour = 0, minute = 0, second = 0 }, timeZone) {
  const guess = Date.UTC(year, month - 1, day, hour, minute, second);
  const observed = zonedParts(new Date(guess), timeZone);
  const observedAsUtc = Date.UTC(
    observed.year, observed.month - 1, observed.day, observed.hour, observed.minute, observed.second,
  );
  const offset = observedAsUtc - guess;
  return new Date(guess - offset);
}

/** Validate a timezone name; falls back to Asia/Kolkata when unknown. */
export function safeTimeZone(tz) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz }).format(new Date());
    return tz;
  } catch {
    return 'Asia/Kolkata';
  }
}

/**
 * Earliest instant >= `from` that falls inside the tenant's calling window.
 *
 * @param {Date} from
 * @param {{businessHoursStart?: string, businessHoursEnd?: string, timezone?: string}} window
 * @returns {Date}
 */
export function nextSlotWithinWindow(from, window = {}) {
  const timeZone = safeTimeZone(window.timezone || 'Asia/Kolkata');
  let start = parseHHMM(window.businessHoursStart);
  let end = parseHHMM(window.businessHoursEnd);
  if (start == null || end == null || start >= end) {
    start = 10 * 60;
    end = 19 * 60;
  }

  const local = zonedParts(from, timeZone);
  const minutesNow = local.hour * 60 + local.minute;

  if (minutesNow >= start && minutesNow < end) return from;

  let dayShift = 0;
  if (minutesNow >= end) dayShift = 1;

  // Move to the window start on the right day. Date.UTC normalises day
  // overflow, so "day + 1" past month end is fine.
  return zonedTimeToUtc({
    year: local.year,
    month: local.month,
    day: local.day + dayShift,
    hour: Math.floor(start / 60),
    minute: start % 60,
  }, timeZone);
}

/** Add minutes to a Date. */
export function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

/** YYYY-MM-DD (UTC) bucket key used by the due-index. */
export function dueBucket(date) {
  return date.toISOString().slice(0, 10);
}

/** The UTC date buckets the dispatcher must read to catch everything due by `now`. */
export function dueBucketsToScan(now, daysBack = 2) {
  const buckets = [];
  for (let i = 0; i <= daysBack; i += 1) {
    buckets.push(dueBucket(new Date(now.getTime() - i * 24 * 60 * 60 * 1000)));
  }
  return buckets;
}

/** Epoch seconds `days` from now, for DynamoDB TTL. */
export function ttlInDays(days, from = new Date()) {
  return Math.floor(from.getTime() / 1000) + days * 24 * 60 * 60;
}
