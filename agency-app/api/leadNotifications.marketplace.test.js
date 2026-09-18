/**
 * notifyMarketplaceActivity: in-app always; email/WhatsApp/push only per the
 * agency's marketplaceNotifications; audience = assignee + admins + extras;
 * never puts the buyer's phone in an outbound text.
 */
import { jest } from '@jest/globals';

const mockCreateNotification = jest.fn();
jest.unstable_mockModule('./notificationDynamodbService.js', () => ({
  createNotification: mockCreateNotification,
  NotificationCategory: { LEADS: 'LEADS' },
}));

const mockSendEmail = jest.fn();
jest.unstable_mockModule('./emailService.js', () => ({ sendEmail: mockSendEmail }));

const mockSendWhatsApp = jest.fn();
jest.unstable_mockModule('./bailey.js', () => ({
  isBaileyEnabled: () => true,
  sendWhatsAppMessage: mockSendWhatsApp,
}));

const mockCreateLeadNote = jest.fn();
jest.unstable_mockModule('./crmDynamodbService.js', () => ({ createLeadNote: mockCreateLeadNote }));

jest.unstable_mockModule('./config/serviceUrls.js', () => ({ getAuthServiceBaseUrl: () => 'https://auth.test' }));

const members = [
  { userId: 'u-admin', displayName: 'Owner', email: 'owner@agency.in', phoneNumber: '+919800000001', role: 'ADMIN' },
  { userId: 'u-member', displayName: 'Sameer', email: 'sameer@agency.in', phoneNumber: '+919800000002', role: 'MEMBER' },
  { userId: 'u-other', displayName: 'Other', email: 'other@agency.in', phoneNumber: null, role: 'MEMBER' },
];
globalThis.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ users: members }) }));

const { notifyMarketplaceActivity } = await import('./leadNotifications.js');

const lead = { leadId: 'lead-1', name: 'Rahul', phone: '+919812345678', assignedTo: 'u-member' };
const allOn = { email: true, whatsapp: true, push: true, extraEmails: ['boss@agency.in'], extraPhones: ['+919700000000'] };

beforeEach(() => {
  mockCreateNotification.mockReset().mockResolvedValue({});
  mockSendEmail.mockReset().mockResolvedValue({});
  mockSendWhatsApp.mockReset().mockResolvedValue({});
  mockCreateLeadNote.mockReset().mockResolvedValue({});
});

test('enquiry: in-app to assignee + admins, email + WhatsApp to them and the extras, note on the lead', async () => {
  const result = await notifyMarketplaceActivity('t-1', {
    kind: 'enquiry', lead, propertyTitle: '2 BHK Andheri', threadId: 'th-1', preview: 'Is it available?', messageId: 'm-1', settings: allOn,
  });

  expect(result.notified.sort()).toEqual(['u-admin', 'u-member']);
  expect(result.channels).toEqual(['in_app', 'email', 'whatsapp']);

  const notif = mockCreateNotification.mock.calls[0][1];
  expect(notif.type).toBe('MARKETPLACE_ACTIVITY');
  expect(notif.deepLink).toBe('/crm/marketplace/inbox/th-1');
  expect(notif.dedupeKey).toBe('marketplace:enquiry:m-1');
  expect(notif.targetUserIds.sort()).toEqual(['u-admin', 'u-member']);
  expect(notif.message).toContain('Rahul started a chat for 2 BHK Andheri');

  const emailTo = mockSendEmail.mock.calls.map((c) => c[0].to).sort();
  expect(emailTo).toEqual(['boss@agency.in', 'owner@agency.in', 'sameer@agency.in']);
  for (const [args] of mockSendEmail.mock.calls) {
    expect(args.text).not.toContain('9812345678');
    expect(args.html).not.toContain('9812345678');
  }

  const waTo = mockSendWhatsApp.mock.calls.map((c) => c[0]).sort();
  expect(waTo).toEqual(['+919700000000', '+919800000001', '+919800000002']);

  expect(mockCreateLeadNote).toHaveBeenCalledWith('t-1', 'lead-1', expect.objectContaining({ createdBy: 'Marketplace' }));
});

test('channels off: in-app only, no push audience, no note for a plain message', async () => {
  const result = await notifyMarketplaceActivity('t-1', {
    kind: 'message', lead, threadId: 'th-1', preview: 'ok', messageId: 'm-2',
    settings: { email: false, whatsapp: false, push: false, extraEmails: [], extraPhones: [] },
  });
  expect(result.channels).toEqual(['in_app']);
  expect(mockSendEmail).not.toHaveBeenCalled();
  expect(mockSendWhatsApp).not.toHaveBeenCalled();
  expect(mockCreateNotification.mock.calls[0][1].targetUserIds).toBeUndefined();
  expect(mockCreateLeadNote).not.toHaveBeenCalled();
});

test('unassigned lead: admins only', async () => {
  const result = await notifyMarketplaceActivity('t-1', {
    kind: 'ping', lead: { ...lead, assignedTo: null }, threadId: 'th-1', messageId: 'm-3',
    settings: { email: true, whatsapp: false, push: true, extraEmails: [], extraPhones: [] },
  });
  expect(result.notified).toEqual(['u-admin']);
  expect(mockSendEmail.mock.calls.map((c) => c[0].to)).toEqual(['owner@agency.in']);
});
