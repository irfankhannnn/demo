import { describe, expect, it, jest } from '@jest/globals';
import { requireCrmMemberOrAbove, requireAdminOrManager } from '../middleware/requireRole.js';

function mockReq(role) {
  return { user: { role }, originalUrl: '/test', tenantId: 't1' };
}

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

describe('requireRole middleware', () => {
  it('allows MEMBER for requireCrmMemberOrAbove', () => {
    const next = jest.fn();
    const res = mockRes();
    requireCrmMemberOrAbove(mockReq('MEMBER'), res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('denies MEMBER for requireAdminOrManager', () => {
    const next = jest.fn();
    const res = mockRes();
    requireAdminOrManager(mockReq('MEMBER'), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('allows MANAGER for requireAdminOrManager', () => {
    const next = jest.fn();
    const res = mockRes();
    requireAdminOrManager(mockReq('MANAGER'), res, next);
    expect(next).toHaveBeenCalled();
  });
});
