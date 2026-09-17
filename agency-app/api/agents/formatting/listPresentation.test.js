/**
 * List presentation resolver + field catalog.
 */

import {
  resolveListPresentation,
  parseResponseFields,
  LIST_TEMPLATE_PRESETS,
} from './listPresentation.js';

describe('listPresentation', () => {
  test('defaults to lead_card', () => {
    const p = resolveListPresentation('lead', { priority: 'high' });
    expect(p.templateId).toBe('lead_card');
    expect(p.bodyFields).toEqual(LIST_TEMPLATE_PRESETS.lead_card);
  });

  test('listTemplate contact', () => {
    const p = resolveListPresentation('lead', { listTemplate: 'contact' });
    expect(p.templateId).toBe('contact');
    expect(p.bodyFields).toContain('phone');
  });

  test('responseFields custom', () => {
    const fields = parseResponseFields('phone, leadType, status');
    expect(fields).toEqual(['phone', 'leadType', 'status']);
    const p = resolveListPresentation('lead', { responseFields: fields });
    expect(p.bodyFields.length).toBeGreaterThan(0);
  });

  test('non-lead returns null', () => {
    expect(resolveListPresentation('buyer', {})).toBeNull();
  });
});
