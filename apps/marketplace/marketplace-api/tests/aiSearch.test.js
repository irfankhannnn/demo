/**
 * The heuristic intent parser and the search flow's fallbacks.
 *
 * The parser is what every buyer gets during a model outage, so it is tested
 * as a first-class feature: Hinglish vocabulary, lakh/crore/k conversion,
 * rent vs sale detection, city resolution. The flow test proves that when
 * the model throws, the CRM search still runs and results come back with
 * `why: null` rather than an error.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.CRM_INTERNAL_API_DOMAIN_NAME = 'http://localhost:9999';
process.env.CRM_INTERNAL_API_BASE_PATH = '';
process.env.MARKETPLACE_INTERNAL_API_KEY = 'k';
process.env.MARKETPLACE_TABLE_NAME = 'test-table';

const { heuristicIntent, resolveCity, createAiSearch } = await import('../services/aiSearch.js');
const { normaliseIntent, extractJson } = await import('../services/modelGateway/shared.js');

const CITIES = [
  { name: 'Mumbai', cityKey: 'mumbai', sale: 10, rent: 5, total: 15 },
  { name: 'Navi Mumbai', cityKey: 'navi-mumbai', sale: 2, rent: 1, total: 3 },
  { name: 'Pune', cityKey: 'pune', sale: 4, rent: 4, total: 8 },
  { name: 'Bengaluru', cityKey: 'bengaluru', sale: 6, rent: 6, total: 12 },
];

describe('heuristicIntent — money', () => {
  test('"under 80 lakh" is a ceiling in rupees', () => {
    const i = heuristicIntent({ query: '2 bhk andheri under 80 lakh', city: 'Mumbai', cities: CITIES });
    assert.equal(i.maxPrice, 8000000);
    assert.equal(i.minPrice, null);
    assert.equal(i.bhk, 2);
    assert.equal(i.mode, 'sale');
  });

  test('"1.2 cr" converts to crore', () => {
    const i = heuristicIntent({ query: '3bhk flat upto 1.2 cr in Powai', city: 'Mumbai', cities: CITIES });
    assert.equal(i.maxPrice, 12000000);
    assert.equal(i.bhk, 3);
    assert.equal(i.propertyType, 'apartment');
  });

  test('"50k" is thousands and implies rent when no mode word appears', () => {
    const i = heuristicIntent({ query: 'flat 50k wakad', city: 'Pune', cities: CITIES });
    assert.equal(i.maxPrice, 50000);
    assert.equal(i.mode, 'rent');
  });

  test('a lone budget without a qualifier is still a ceiling', () => {
    const i = heuristicIntent({ query: '2 bhk 60 lakh', city: 'Mumbai', cities: CITIES });
    assert.equal(i.maxPrice, 6000000);
  });

  test('ranges set both bounds', () => {
    const a = heuristicIntent({ query: 'villa between 1 cr and 2 cr', city: 'Bengaluru', cities: CITIES });
    assert.equal(a.minPrice, 10000000);
    assert.equal(a.maxPrice, 20000000);
    const b = heuristicIntent({ query: '2bhk 40-60 lakh', city: 'Pune', cities: CITIES });
    assert.equal(b.minPrice, 4000000);
    assert.equal(b.maxPrice, 6000000);
  });

  test('"above" sets a floor', () => {
    const i = heuristicIntent({ query: 'penthouse above 3 cr', city: 'Mumbai', cities: CITIES });
    assert.equal(i.minPrice, 30000000);
    assert.equal(i.maxPrice, null);
  });
});

describe('heuristicIntent — Hinglish', () => {
  test('kiraye = rent, ghar is not a property type', () => {
    const i = heuristicIntent({ query: 'ghar chahiye kiraye pe 25k andheri', city: 'Mumbai', cities: CITIES });
    assert.equal(i.mode, 'rent');
    assert.equal(i.propertyType, null);
    assert.equal(i.maxPrice, 25000);
    assert.equal(i.locality, 'Andheri');
  });

  test('kharidna = sale even with a small number', () => {
    const i = heuristicIntent({ query: 'flat kharidna hai 45 lakh tak', city: 'Pune', cities: CITIES });
    assert.equal(i.mode, 'sale');
    assert.equal(i.maxPrice, 4500000);
  });

  test('do bhk = 2 bhk', () => {
    const i = heuristicIntent({ query: 'do bhk furnished flat', city: 'Pune', cities: CITIES });
    assert.equal(i.bhk, 2);
    assert.equal(i.furnishing, 'furnished');
  });

  test('semi furnished and villa', () => {
    const i = heuristicIntent({ query: 'semi furnished villa with parking and gym', city: 'Bengaluru', cities: CITIES });
    assert.equal(i.furnishing, 'semi-furnished');
    assert.equal(i.propertyType, 'villa');
    assert.deepEqual(i.mustHaves, ['parking', 'gym']);
  });
});

describe('heuristicIntent — city', () => {
  test('a city named in the query wins over the default', () => {
    const i = heuristicIntent({ query: '2 bhk in pune under 70 lakh', city: 'Mumbai', cities: CITIES });
    assert.equal(i.city, 'Pune');
    assert.equal(i.cityKey, 'pune');
  });

  test('longest city name wins ("navi mumbai" is not "mumbai")', () => {
    const i = heuristicIntent({ query: 'flat in navi mumbai', city: null, cities: CITIES });
    assert.equal(i.cityKey, 'navi-mumbai');
  });

  test('aliases resolve (bangalore → Bengaluru)', () => {
    const i = heuristicIntent({ query: '3 bhk bangalore whitefield', city: null, cities: CITIES });
    assert.equal(i.cityKey, 'bengaluru');
    assert.equal(i.locality, 'Whitefield');
  });

  test('no city anywhere → cityKey null', () => {
    const i = heuristicIntent({ query: '2 bhk under 80 lakh', city: null, cities: CITIES });
    assert.equal(i.city, null);
    assert.equal(i.cityKey, null);
  });

  test('resolveCity matches by name, key and alias', () => {
    assert.equal(resolveCity('Bombay', CITIES)?.cityKey, 'mumbai');
    assert.equal(resolveCity('navi-mumbai', CITIES)?.name, 'Navi Mumbai');
    assert.equal(resolveCity('Nowhere', CITIES), null);
  });
});

describe('normaliseIntent (model output)', () => {
  test('a price the model left in lakh is corrected to rupees', () => {
    const i = normaliseIntent({ maxPrice: 80, bhk: '2', mode: 'SALE', furnishing: 'Semi Furnished', mustHaves: ['Parking'] });
    assert.equal(i.maxPrice, 8000000);
    assert.equal(i.bhk, 2);
    assert.equal(i.mode, 'sale');
    assert.equal(i.furnishing, 'semi-furnished');
    assert.deepEqual(i.mustHaves, ['parking']);
  });

  test('swapped bounds are fixed and junk becomes null', () => {
    const i = normaliseIntent({ minPrice: 9000000, maxPrice: 5000000, mode: 'lease', propertyType: '<b>' });
    assert.equal(i.minPrice, 5000000);
    assert.equal(i.maxPrice, 9000000);
    assert.equal(i.mode, null);
    assert.equal(i.propertyType, null);
  });

  test('extractJson survives code fences and a preamble', () => {
    assert.deepEqual(extractJson('```json\n{"a":1}\n```'), { a: 1 });
    assert.deepEqual(extractJson('Sure! {"a":1}'), { a: 1 });
    assert.throws(() => extractJson('no json here'));
  });
});

describe('aiSearch flow with a failing model', () => {
  const LISTINGS = [
    { propertyId: 'p1', title: '2 BHK Andheri West', pricing: { mode: 'sale', amount: 7500000 }, matchScore: 0.9 },
    { propertyId: 'p2', title: '2 BHK Andheri East', pricing: { mode: 'sale', amount: 7900000 }, matchScore: 0.8 },
  ];
  const calls = [];
  const crm = {
    listCities: async () => CITIES,
    search: async (args) => { calls.push({ kind: 'search', args }); return { items: LISTINGS, cityKey: 'mumbai' }; },
    listListings: async (args) => { calls.push({ kind: 'list', args }); return { items: LISTINGS, cityKey: 'mumbai' }; },
  };
  const brokenGateway = {
    parseIntent: async () => { throw new Error('model down'); },
    explain: async () => { throw new Error('model down'); },
  };

  test('falls back to the heuristic, still searches the CRM, returns why: null', async () => {
    calls.length = 0;
    const ai = createAiSearch({ crm, gateway: brokenGateway });
    const out = await ai.run({ query: '2 bhk andheri under 80 lakh', city: 'Mumbai', filters: {} });

    assert.equal(out.needsCity, false);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].kind, 'search');
    assert.equal(calls[0].args.city, 'Mumbai');
    assert.equal(calls[0].args.maxPrice, 8000000);
    assert.equal(calls[0].args.bhk, 2);
    assert.equal(out.results.length, 2);
    assert.equal(out.results[0].why, null);
    assert.equal(out.results[0].matchScore, 0.9);
    assert.equal(out.followUps.length, 2);
    assert.ok(out.assistantMessage.includes('Mumbai'));
    assert.equal(out.intent.cityKey, 'mumbai');
  });

  test('asks for a city when none can be determined', async () => {
    const ai = createAiSearch({ crm, gateway: brokenGateway });
    const out = await ai.run({ query: '2 bhk under 80 lakh', city: null, filters: {} });
    assert.equal(out.needsCity, true);
    assert.deepEqual(out.results, []);
    assert.equal(out.intent.cityKey, null);
    assert.ok(out.assistantMessage.length > 0);
  });

  test('explicit filters override the parsed intent', async () => {
    calls.length = 0;
    const ai = createAiSearch({ crm, gateway: brokenGateway });
    await ai.run({ query: '2 bhk andheri', city: 'Mumbai', filters: { mode: 'rent', bhk: 3, maxPrice: 40000 } });
    assert.equal(calls[0].args.mode, 'rent');
    assert.equal(calls[0].args.bhk, 3);
    assert.equal(calls[0].args.maxPrice, 40000);
  });

  test('uses the model explanation when it works', async () => {
    const gateway = {
      parseIntent: async () => ({ cityKey: 'mumbai', city: 'Mumbai', mode: 'sale', bhk: 2, minPrice: null, maxPrice: 8000000, propertyType: null, locality: 'Andheri', furnishing: null, mustHaves: [], canonicalQuery: '2 BHK in Andheri under 80 lakh' }),
      explain: async ({ listings }) => ({ why: { [listings[0].propertyId]: 'Fits your budget' }, followUps: ['A?', 'B?'], assistantMessage: 'Found 2.' }),
    };
    const ai = createAiSearch({ crm, gateway });
    const out = await ai.run({ query: '2 bhk andheri under 80 lakh', city: null, filters: {} });
    assert.equal(out.results[0].why, 'Fits your budget');
    assert.equal(out.results[1].why, null);
    assert.deepEqual(out.followUps, ['A?', 'B?']);
    assert.equal(out.assistantMessage, 'Found 2.');
  });
});
