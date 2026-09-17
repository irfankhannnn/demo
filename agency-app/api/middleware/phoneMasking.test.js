/**
 * Phone masking (CONTRACTS.md section 7).
 *
 * Runs under both `node --test` and jest (`npm test` globs every *.test.js):
 * test primitives come from node:test or from jest's globals, assertions from
 * node:assert so the file needs no runner-specific matchers.
 */

import assert from 'node:assert/strict';
import phoneMaskingMiddleware, {
  PHONE_KEYS,
  FULL_PHONE_ROLES,
  PHONE_MASKED_HEADER,
  canViewFullPhone,
  maskPhone,
  maskPhonesDeep,
  maskPhonesForUser,
  isMaskedPhoneValue,
  stripMaskedPhoneInput,
} from './phoneMasking.js';

const isJest = Boolean(process.env.JEST_WORKER_ID);
const { describe, test } = isJest
  ? { describe: globalThis.describe, test: globalThis.test }
  : await import('node:test');

describe('maskPhone', () => {
  test('keeps +91 country code and last 4 digits', () => {
    assert.equal(maskPhone('+919812345678'), '+91 ******5678');
  });

  test('treats a leading 91 on a 12-digit number as the country code', () => {
    assert.equal(maskPhone('919812345678'), '+91 ******5678');
  });

  test('masks a bare 10-digit number with no country code', () => {
    assert.equal(maskPhone('9812345678'), '******5678');
  });

  test('tolerates separators and a trunk zero', () => {
    assert.equal(maskPhone('+91 98123-45678'), '+91 ******5678');
    assert.equal(maskPhone('098123 45678'), '******5678');
    assert.equal(maskPhone('0091 9812345678'), '+91 ******5678');
  });

  test('masks a 7-digit landline with only three stars', () => {
    assert.equal(maskPhone('2345678'), '***5678');
  });

  test('leaves short, empty and non-numeric strings untouched', () => {
    assert.equal(maskPhone(''), '');
    assert.equal(maskPhone('1234'), '1234');
    assert.equal(maskPhone('N/A'), 'N/A');
    assert.equal(maskPhone('not provided'), 'not provided');
    assert.equal(maskPhone('rahul@example.com'), 'rahul@example.com');
  });

  test('masks integer numbers as their decimal string', () => {
    assert.equal(maskPhone(9812345678), '******5678');
    assert.equal(maskPhone(919812345678), '+91 ******5678');
    assert.equal(maskPhone(1234), 1234);
    assert.equal(maskPhone(98.5), 98.5);
    assert.ok(Number.isNaN(maskPhone(NaN)));
  });

  test('leaves other non-string values untouched', () => {
    assert.equal(maskPhone(null), null);
    assert.equal(maskPhone(undefined), undefined);
    assert.equal(maskPhone(true), true);
    const obj = { phone: '9812345678' };
    assert.equal(maskPhone(obj), obj);
  });
});

describe('maskPhonesDeep', () => {
  test('masks every contract key in nested objects and arrays and flags each object', () => {
    const input = {
      leads: [
        { leadId: 'l1', name: 'Asha', phone: '+919812345678', alternatePhone: '9800000001' },
        { leadId: 'l2', name: 'Ravi', email: 'ravi@example.com' },
      ],
      property: {
        title: '2 BHK',
        ownerPhone: '9812345678',
        ownerSnapshot: { name: 'Owner', phone: '+919800000002', whatsappNumber: '9800000003' },
      },
      meeting: { attendeePhone: '9800000004', relatedEntityPhone: '9800000005', nested: { tenantPhone: '9800000006' } },
      count: 2,
    };
    const snapshot = JSON.stringify(input);

    const out = maskPhonesDeep(input);

    assert.equal(JSON.stringify(input), snapshot, 'input must not be mutated');
    assert.notEqual(out, input);

    assert.deepEqual(out.leads[0], {
      leadId: 'l1',
      name: 'Asha',
      phone: '+91 ******5678',
      alternatePhone: '******0001',
      phoneMasked: true,
    });
    // Untouched sibling keeps its identity and gets no flag.
    assert.equal(out.leads[1], input.leads[1]);
    assert.equal(out.leads[1].phoneMasked, undefined);

    assert.equal(out.property.ownerPhone, '******5678');
    assert.equal(out.property.phoneMasked, true);
    assert.equal(out.property.ownerSnapshot.phone, '+91 ******0002');
    assert.equal(out.property.ownerSnapshot.whatsappNumber, '******0003');
    assert.equal(out.property.ownerSnapshot.phoneMasked, true);

    assert.equal(out.meeting.attendeePhone, '******0004');
    assert.equal(out.meeting.relatedEntityPhone, '******0005');
    assert.equal(out.meeting.nested.tenantPhone, '******0006');
    assert.equal(out.meeting.nested.phoneMasked, true);
    assert.equal(out.count, 2);
  });

  test('returns the same reference when nothing needs masking', () => {
    const input = { items: [{ name: 'x', email: 'x@y.z' }], total: 1 };
    assert.equal(maskPhonesDeep(input), input);
  });

  test('skips null/undefined, booleans and empty strings', () => {
    const input = { phone: null, mobile: undefined, phoneNumber: true, contactNumber: '' };
    const out = maskPhonesDeep(input);
    assert.equal(out, input);
    assert.equal(out.phoneMasked, undefined);
  });

  test('masks numeric phone values under a phone key', () => {
    const input = { phoneNumber: 9812345678, count: 9812345678 };
    const out = maskPhonesDeep(input);
    assert.notEqual(out, input);
    assert.equal(out.phoneNumber, '******5678');
    assert.equal(out.count, 9812345678, 'non-phone keys keep numeric values');
    assert.equal(out.phoneMasked, true);
    assert.equal(input.phoneNumber, 9812345678, 'input must not be mutated');
  });

  test('is case-sensitive on keys and only masks the contract set', () => {
    const input = { Phone: '9812345678', PHONE: '9812345678', fax: '9812345678', phone: '9812345678' };
    const out = maskPhonesDeep(input);
    assert.equal(out.Phone, '9812345678');
    assert.equal(out.PHONE, '9812345678');
    assert.equal(out.fax, '9812345678');
    assert.equal(out.phone, '******5678');
  });

  test('handles a top-level array and primitives', () => {
    const arr = [{ phone: '9812345678' }, 'plain', 42, null];
    const out = maskPhonesDeep(arr);
    assert.equal(out[0].phone, '******5678');
    assert.equal(out[1], 'plain');
    assert.equal(out[2], 42);
    assert.equal(out[3], null);
    assert.equal(maskPhonesDeep('9812345678'), '9812345678');
    assert.equal(maskPhonesDeep(null), null);
  });

  test('accepts a custom key set', () => {
    const out = maskPhonesDeep({ fax: '9812345678', phone: '9812345678' }, new Set(['fax']));
    assert.equal(out.fax, '******5678');
    assert.equal(out.phone, '9812345678');
  });

  test('exports the full contract key list', () => {
    for (const key of [
      'phone', 'mobile', 'mobileNumber', 'alternatePhone', 'normalizedPhone', 'contactNumber',
      'ownerPhone', 'attendeePhone', 'relatedEntityPhone', 'whatsapp', 'whatsappNumber',
      'phoneNumber', 'tenantPhone', 'buyerPhone', 'sellerPhone',
    ]) {
      assert.ok(PHONE_KEYS.has(key), `missing key ${key}`);
    }
  });
});

describe('isMaskedPhoneValue', () => {
  test('recognises every shape maskPhone produces, plus the short status form', () => {
    assert.equal(isMaskedPhoneValue('+91 ******5678'), true);
    assert.equal(isMaskedPhoneValue('******5678'), true);
    assert.equal(isMaskedPhoneValue('***5678'), true);
    assert.equal(isMaskedPhoneValue('****5678'), true);
    assert.equal(isMaskedPhoneValue(maskPhone('+919812345678')), true);
  });

  test('never matches a real number or other input', () => {
    assert.equal(isMaskedPhoneValue('+919812345678'), false);
    assert.equal(isMaskedPhoneValue('9812345678'), false);
    assert.equal(isMaskedPhoneValue(''), false);
    assert.equal(isMaskedPhoneValue('N/A'), false);
    assert.equal(isMaskedPhoneValue(9812345678), false);
    assert.equal(isMaskedPhoneValue(null), false);
  });
});

describe('stripMaskedPhoneInput', () => {
  test('drops masked phone keys at any depth and every phoneMasked flag, keeps real numbers', () => {
    const body = {
      name: 'Rahul',
      phone: '+91 ******5678',
      alternatePhone: '+919812340000',
      phoneMasked: true,
      ownerSnapshot: { name: 'Owner', phone: '******1234', phoneMasked: true, email: 'o@x.in' },
      attendees: [{ attendeePhone: '****4321', phoneMasked: true }, { attendeePhone: '9812344321' }],
      notes: 'call ******5678 later',
    };
    const removed = stripMaskedPhoneInput(body);
    assert.deepEqual(body, {
      name: 'Rahul',
      alternatePhone: '+919812340000',
      ownerSnapshot: { name: 'Owner', email: 'o@x.in' },
      attendees: [{}, { attendeePhone: '9812344321' }],
      notes: 'call ******5678 later',
    });
    assert.deepEqual(removed.sort(), [
      'attendees[0].attendeePhone',
      'attendees[0].phoneMasked',
      'ownerSnapshot.phone',
      'ownerSnapshot.phoneMasked',
      'phone',
      'phoneMasked',
    ]);
  });

  test('leaves a clean body alone and tolerates non-object input', () => {
    const body = { phone: '+919812345678', nested: { ownerPhone: '9812345678' } };
    assert.deepEqual(stripMaskedPhoneInput(body), []);
    assert.deepEqual(body, { phone: '+919812345678', nested: { ownerPhone: '9812345678' } });
    assert.deepEqual(stripMaskedPhoneInput(null), []);
    assert.deepEqual(stripMaskedPhoneInput('string'), []);
  });
});

describe('role gating', () => {
  test('ADMIN, FOUNDER and OWNER see full numbers (case-insensitive)', () => {
    assert.deepEqual(FULL_PHONE_ROLES, ['ADMIN', 'FOUNDER', 'OWNER']);
    assert.equal(canViewFullPhone({ role: 'ADMIN' }), true);
    assert.equal(canViewFullPhone({ role: 'FOUNDER' }), true);
    assert.equal(canViewFullPhone({ role: 'OWNER' }), true);
    assert.equal(canViewFullPhone({ role: 'admin' }), true);
  });

  test('MEMBER, MANAGER, unknown and missing roles are masked', () => {
    assert.equal(canViewFullPhone({ role: 'MEMBER' }), false);
    assert.equal(canViewFullPhone({ role: 'MANAGER' }), false);
    assert.equal(canViewFullPhone({}), false);
    assert.equal(canViewFullPhone(null), false);
    assert.equal(canViewFullPhone(undefined), false);
  });

  test('maskPhonesForUser: admin unmasked, member masked, no user no-op', () => {
    const payload = { phone: '9812345678' };
    assert.equal(maskPhonesForUser({ role: 'ADMIN' }, payload), payload);
    assert.equal(maskPhonesForUser(null, payload), payload);
    const masked = maskPhonesForUser({ role: 'MEMBER' }, payload);
    assert.equal(masked.phone, '******5678');
    assert.equal(masked.phoneMasked, true);
    assert.equal(payload.phone, '9812345678');
  });
});

describe('phoneMaskingMiddleware (res.json wrapper)', () => {
  function fakeRes() {
    const res = {
      headers: {},
      headersSent: false,
      sent: undefined,
      setHeader(name, value) { this.headers[name] = value; },
      json(payload) { this.sent = payload; return this; },
    };
    return res;
  }

  function run({ url = '/api/crm/leads', user, payload }) {
    const req = { originalUrl: url, url };
    const res = fakeRes();
    let nextCalled = false;
    phoneMaskingMiddleware()(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, true, 'middleware must always call next');
    // Simulate the route's own validateToken running later in the chain.
    if (user !== undefined) req.user = user;
    res.json(payload);
    return res;
  }

  test('masks for a MEMBER whose req.user was attached after the wrapper ran', () => {
    const payload = { leadId: 'l1', phone: '+919812345678' };
    const res = run({ user: { role: 'MEMBER' }, payload });
    assert.equal(res.sent.phone, '+91 ******5678');
    assert.equal(res.sent.phoneMasked, true);
    assert.equal(res.headers[PHONE_MASKED_HEADER], 'true');
    assert.equal(payload.phone, '+919812345678', 'original payload untouched');
  });

  test('passes through unchanged for ADMIN, with no header', () => {
    const payload = { leadId: 'l1', phone: '+919812345678' };
    const res = run({ user: { role: 'ADMIN' }, payload });
    assert.equal(res.sent, payload);
    assert.equal(res.headers[PHONE_MASKED_HEADER], undefined);
  });

  test('is a no-op when there is no req.user', () => {
    const payload = { phone: '+919812345678' };
    const res = run({ payload });
    assert.equal(res.sent, payload);
    assert.equal(res.headers[PHONE_MASKED_HEADER], undefined);
  });

  test('never touches /api/internal responses', () => {
    const payload = { phone: '+919812345678' };
    const res = run({ url: '/api/internal/followups/leads/l1/snapshot', user: { role: 'MEMBER' }, payload });
    assert.equal(res.sent, payload);
  });

  test('ignores non-/api/crm paths if mounted too broadly', () => {
    const payload = { phone: '+919812345678' };
    const res = run({ url: '/api/whatsapp/conversations', user: { role: 'MEMBER' }, payload });
    assert.equal(res.sent, payload);
  });

  test('sets no header when the payload had nothing to mask', () => {
    const payload = { ok: true, items: [] };
    const res = run({ user: { role: 'MEMBER' }, payload });
    assert.equal(res.sent, payload);
    assert.equal(res.headers[PHONE_MASKED_HEADER], undefined);
  });

  test('strips masked phone values from the request body for every role', () => {
    for (const role of ['MEMBER', 'ADMIN']) {
      const req = { originalUrl: '/api/crm/leads/1', method: 'PUT', body: { name: 'R', phone: '+91 ******5678', phoneMasked: true } };
      const res = fakeRes();
      phoneMaskingMiddleware()(req, res, () => {});
      assert.deepEqual(req.body, { name: 'R' }, role);
      assert.deepEqual(req.strippedMaskedPhoneFields, ['phone', 'phoneMasked']);
    }
  });

  test('leaves /api/internal request bodies untouched', () => {
    const req = { originalUrl: '/api/internal/followups/notes', body: { phone: '+91 ******5678' } };
    phoneMaskingMiddleware()(req, fakeRes(), () => {});
    assert.deepEqual(req.body, { phone: '+91 ******5678' });
  });

  test('handles primitive and empty payloads without walking', () => {
    assert.equal(run({ user: { role: 'MEMBER' }, payload: 'ok' }).sent, 'ok');
    assert.equal(run({ user: { role: 'MEMBER' }, payload: null }).sent, null);
    assert.equal(run({ user: { role: 'MEMBER' }, payload: undefined }).sent, undefined);
  });

  test('preserves `this` so chained res.status(...).json(...) still works', () => {
    const req = { originalUrl: '/api/crm/owners/o1', url: '/api/crm/owners/o1' };
    const res = fakeRes();
    res.statusCode = 200;
    res.status = function status(code) { this.statusCode = code; return this; };
    phoneMaskingMiddleware()(req, res, () => {});
    req.user = { role: 'MEMBER' };
    const returned = res.status(201).json({ phone: '9812345678' });
    assert.equal(returned, res);
    assert.equal(res.statusCode, 201);
    assert.equal(res.sent.phone, '******5678');
  });
});
