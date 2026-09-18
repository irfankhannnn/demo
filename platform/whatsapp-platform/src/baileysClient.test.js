import { isSkippableJid, shouldIngestUpsert } from './baileysClient.js';

describe('current-message-only ingestion', () => {
  test('accepts a current direct notification', () => {
    expect(shouldIngestUpsert(
      { type: 'notify' },
      { key: { remoteJid: '919999999999@s.whatsapp.net' }, message: { conversation: 'hello' } }
    )).toBe(true);
  });

  test('drops offline/history append messages', () => {
    expect(shouldIngestUpsert(
      { type: 'append' },
      { key: { remoteJid: '919999999999@s.whatsapp.net' }, message: { conversation: 'old message' } }
    )).toBe(false);
  });

  test('drops status and broadcast traffic before forwarding', () => {
    expect(isSkippableJid('status@broadcast')).toBe(true);
    expect(isSkippableJid('12345@newsletter')).toBe(true);
    expect(shouldIngestUpsert(
      { type: 'notify' },
      { key: { remoteJid: 'status@broadcast' }, message: { conversation: 'status' } }
    )).toBe(false);
  });
});
