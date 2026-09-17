/**
 * Search filter coercion + domain router regression tests.
 * Run: node --experimental-vm-modules node_modules/jest/bin/jest.js inputNormalizer.search.test.js
 * Or:  node --input-type=module agents/inputNormalizer.search.test.js  (standalone)
 */

import { describe, it, expect } from '@jest/globals';
import {
  normalizeToolInput,
  coerceSearchLeadsFilters,
  coerceSearchContactsFilters,
} from './inputNormalizer.js';
import { routeDomainsFast } from './domainRouter.js';

describe('coerceSearchLeadsFilters', () => {
  it('promotes status and leadType from natural-language query', () => {
    expect(coerceSearchLeadsFilters({ query: 'all qualified buyer leads' })).toEqual({
      status: 'qualified',
      leadType: 'buyer',
    });
  });

  it('fixes common status typos', () => {
    expect(coerceSearchLeadsFilters({ query: 'contracted leads' })).toEqual({ status: 'contacted' });
    expect(coerceSearchLeadsFilters({ query: 'qulaified leads' })).toEqual({ status: 'qualified' });
  });

  it('promotes temperature from query', () => {
    expect(coerceSearchLeadsFilters({ query: 'hot buyer leads' })).toEqual({
      temperature: 'hot',
      leadType: 'buyer',
    });
  });

  it('keeps real name/area in query', () => {
    expect(coerceSearchLeadsFilters({ query: 'Kurla qualified leads' })).toEqual({
      status: 'qualified',
      query: 'Kurla qualified leads',
    });
  });
});

describe('normalizeToolInput', () => {
  it('lowercases Title Case enums', () => {
    expect(normalizeToolInput('search_leads', { status: 'Qualified', leadType: 'Buyer' })).toEqual({
      status: 'qualified',
      leadType: 'buyer',
    });
  });

  it('maps query to search for get_owners', () => {
    expect(normalizeToolInput('get_owners', { query: 'Raj Sharma' })).toEqual({
      search: 'Raj Sharma',
    });
  });

  it('maps query to search for search_contacts', () => {
    expect(normalizeToolInput('search_contacts', { query: 'Faizan', role: 'owner' })).toEqual({
      search: 'Faizan',
      role: 'owner',
    });
  });

  it('maps query to search for search_tenants', () => {
    expect(normalizeToolInput('search_tenants', { query: '9876543210' })).toEqual({
      search: '9876543210',
    });
  });
});

describe('routeDomainsFast', () => {
  it('routes pipeline lead phrases to leads only', () => {
    expect(routeDomainsFast('all qualified buyer leads').domains).toEqual(['leads']);
    expect(routeDomainsFast('seller leads').domains).toEqual(['leads']);
  });

  it('routes tenant list without lease context to leads pipeline', () => {
    expect(routeDomainsFast('sare tenants dikhao').domains).toEqual(['leads']);
    expect(routeDomainsFast('tenant list').domains).toEqual(['leads']);
  });

  it('routes hot leads to analytics', () => {
    expect(routeDomainsFast('hot leads dikhao').domains).toContain('analytics');
  });

  it('routes converted buyer list to buyers domain', () => {
    expect(routeDomainsFast('buyers dikhao').domains).toContain('buyers');
  });
});
