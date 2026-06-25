/**
 * Unit tests for server/utils/whatsapp.js
 * Tests: normalizeWhatsAppPhone, classifyWhatsAppId
 */

import { normalizeWhatsAppPhone, classifyWhatsAppId } from './whatsapp.js';

describe('normalizeWhatsAppPhone', () => {
  describe('standard phone formats', () => {
    test('should normalize phone with country code: +91 98765 43210', () => {
      const result = normalizeWhatsAppPhone('+91 98765 43210');
      expect(result).toBe('919876543210');
    });

    test('should normalize phone without country code: 98765 43210', () => {
      const result = normalizeWhatsAppPhone('98765 43210');
      expect(result).toBe('9876543210');
    });

    test('should normalize phone with no spaces: 919876543210', () => {
      const result = normalizeWhatsAppPhone('919876543210');
      expect(result).toBe('919876543210');
    });
  });

  describe('JID formats', () => {
    test('should normalize standard JID: 918291537522@s.whatsapp.net', () => {
      const result = normalizeWhatsAppPhone('918291537522@s.whatsapp.net');
      expect(result).toBe('918291537522');
    });

    test('should normalize JID with device suffix: 918291537522:94@s.whatsapp.net', () => {
      const result = normalizeWhatsAppPhone('918291537522:94@s.whatsapp.net');
      expect(result).toBe('918291537522');
    });

    test('should normalize JID with multiple device digits: 918291537522:123@s.whatsapp.net', () => {
      const result = normalizeWhatsAppPhone('918291537522:123@s.whatsapp.net');
      expect(result).toBe('918291537522');
    });
  });

  describe('LID formats', () => {
    test('should normalize LID: 10076144300114@lid', () => {
      const result = normalizeWhatsAppPhone('10076144300114@lid');
      expect(result).toBe('10076144300114');
    });

    test('should normalize LID with device suffix: 10076144300114:2@lid', () => {
      const result = normalizeWhatsAppPhone('10076144300114:2@lid');
      expect(result).toBe('10076144300114');
    });
  });

  describe('edge cases', () => {
    test('should return empty string for null', () => {
      const result = normalizeWhatsAppPhone(null);
      expect(result).toBe('');
    });

    test('should return empty string for undefined', () => {
      const result = normalizeWhatsAppPhone(undefined);
      expect(result).toBe('');
    });

    test('should return empty string for empty string', () => {
      const result = normalizeWhatsAppPhone('');
      expect(result).toBe('');
    });

    test('should handle whitespace only', () => {
      const result = normalizeWhatsAppPhone('   ');
      expect(result).toBe('');
    });

    test('should strip leading + and spaces: +91 98765 43210', () => {
      const result = normalizeWhatsAppPhone('+91 98765 43210');
      expect(result).toBe('919876543210');
    });

    test('should handle mixed formatting: +91-98765-43210', () => {
      // normalizeWhatsAppPhone strips whitespace, @domain, :device, leading +, and all non-digits
      const result = normalizeWhatsAppPhone('+91-98765-43210');
      expect(result).toBe('919876543210');
    });
  });

  describe('non-digit characters', () => {
    test('should strip formatting and preserve digits only: +91 (98765) 43210', () => {
      // normalizeWhatsAppPhone strips all non-digit characters for consistent comparison
      const result = normalizeWhatsAppPhone('+91 (98765) 43210');
      expect(result).toBe('919876543210');
    });

    test('should handle parentheses and dashes', () => {
      // Parentheses and dashes are stripped by normalizeWhatsAppPhone
      const result = normalizeWhatsAppPhone('+91-(98765)-43210');
      expect(result).toBe('919876543210');
    });
  });
});

describe('classifyWhatsAppId', () => {
  describe('phone number classification', () => {
    test('should classify standard phone JID as phone', () => {
      const result = classifyWhatsAppId('918291537522@s.whatsapp.net');
      expect(result.type).toBe('phone');
      expect(result.digits).toBe('918291537522');
    });

    test('should classify phone with device suffix as phone', () => {
      const result = classifyWhatsAppId('918291537522:94@s.whatsapp.net');
      expect(result.type).toBe('phone');
      expect(result.digits).toBe('918291537522');
    });

    test('should classify 10+ digit number as phone', () => {
      const result = classifyWhatsAppId('919876543210');
      expect(result.type).toBe('phone');
      expect(result.digits).toBe('919876543210');
    });

    test('should classify 15-digit number as phone', () => {
      const result = classifyWhatsAppId('919876543210123');
      expect(result.type).toBe('phone');
      expect(result.digits).toBe('919876543210123');
    });
  });

  describe('LID classification', () => {
    test('should classify LID format as lid', () => {
      const result = classifyWhatsAppId('10076144300114@lid');
      expect(result.type).toBe('lid');
      expect(result.digits).toBe('10076144300114');
    });

    test('should classify LID with device suffix as lid', () => {
      const result = classifyWhatsAppId('10076144300114:2@lid');
      expect(result.type).toBe('lid');
      expect(result.digits).toBe('10076144300114');
    });

    test('should classify 14-digit number starting with 100 as lid', () => {
      const result = classifyWhatsAppId('10076144300114');
      expect(result.type).toBe('lid');
      expect(result.digits).toBe('10076144300114');
    });
  });

  describe('group classification', () => {
    test('should classify @g.us format as group', () => {
      const result = classifyWhatsAppId('120363000000000000@g.us');
      expect(result.type).toBe('group');
      expect(result.digits).toBe('120363000000000000');
    });

    test('should classify 18+ digit number starting with 120 as group', () => {
      const result = classifyWhatsAppId('120363000000000000');
      expect(result.type).toBe('group');
      expect(result.digits).toBe('120363000000000000');
    });

    test('should classify group with device suffix as group', () => {
      const result = classifyWhatsAppId('120363000000000000:1@g.us');
      expect(result.type).toBe('group');
      expect(result.digits).toBe('120363000000000000');
    });
  });

  describe('unknown classification', () => {
    test('should classify null as unknown', () => {
      const result = classifyWhatsAppId(null);
      expect(result.type).toBe('unknown');
      expect(result.digits).toBe('');
    });

    test('should classify undefined as unknown', () => {
      const result = classifyWhatsAppId(undefined);
      expect(result.type).toBe('unknown');
      expect(result.digits).toBe('');
    });

    test('should classify empty string as unknown', () => {
      const result = classifyWhatsAppId('');
      expect(result.type).toBe('unknown');
      expect(result.digits).toBe('');
    });

    test('should classify non-digit string as unknown', () => {
      const result = classifyWhatsAppId('abc@xyz.com');
      expect(result.type).toBe('unknown');
      expect(result.digits).toBe('');
    });

    test('should classify too-short number as unknown', () => {
      const result = classifyWhatsAppId('123456789');
      expect(result.type).toBe('unknown');
      expect(result.digits).toBe('123456789');
    });

    test('should classify 13-digit number starting with 100 as phone', () => {
      // Implementation classifies any >= 10 digits as phone (LID requires exactly 14 digits)
      const result = classifyWhatsAppId('1003614430011');
      expect(result.type).toBe('phone');
      expect(result.digits).toBe('1003614430011');
    });

    test('should classify 17-digit number starting with 120 as phone', () => {
      // Implementation classifies any >= 10 digits as phone (group requires >= 18 digits)
      const result = classifyWhatsAppId('12036300000000000');
      expect(result.type).toBe('phone');
      expect(result.digits).toBe('12036300000000000');
    });
  });

  describe('edge cases', () => {
    test('should handle JID with multiple colons', () => {
      // The :device regex only strips the LAST :digits suffix, so :94 remains
      // and gets merged into digits by the \D strip. This is a known limitation.
      const result = classifyWhatsAppId('918291537522:94:1@s.whatsapp.net');
      expect(result.type).toBe('phone');
      expect(result.digits).toBe('91829153752294');
    });

    test('should extract digits from mixed format', () => {
      const result = classifyWhatsAppId('+91-98765-43210');
      expect(result.type).toBe('phone');
      expect(result.digits).toBe('919876543210');
    });

    test('should handle whitespace in ID', () => {
      const result = classifyWhatsAppId('918291537522 @s.whatsapp.net');
      expect(result.type).toBe('phone');
      expect(result.digits).toBe('918291537522');
    });
  });
});
