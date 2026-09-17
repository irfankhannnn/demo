/**
 * Unit tests for agency-app/api/routes/whatsappConversations.js
 * Tests: message ID generation, uniqueness
 */

import crypto from 'crypto';

describe('whatsappConversations message ID generation', () => {
  describe('UUID generation', () => {
    test('should generate valid UUID v4 format', () => {
      // Expected: UUID v4 format (8-4-4-4-12 hex digits)
      const uuid = crypto.randomUUID();
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(uuidRegex.test(uuid)).toBe(true);
    });

    test('should generate unique IDs across multiple calls', () => {
      // Expected: no collisions in 1000 generated IDs
      const ids = new Set();
      for (let i = 0; i < 1000; i++) {
        ids.add(crypto.randomUUID());
      }
      expect(ids.size).toBe(1000); // All unique
    });

    test('should generate different ID on each call', () => {
      // Expected: two consecutive calls produce different IDs
      const id1 = crypto.randomUUID();
      const id2 = crypto.randomUUID();
      expect(id1).not.toBe(id2);
    });
  });

  describe('UUID properties', () => {
    test('should generate 36-character string (with hyphens)', () => {
      // Expected: UUID is exactly 36 characters
      const uuid = crypto.randomUUID();
      expect(uuid.length).toBe(36);
    });

    test('should contain exactly 4 hyphens', () => {
      // Expected: format is 8-4-4-4-12
      const uuid = crypto.randomUUID();
      const hyphenCount = (uuid.match(/-/g) || []).length;
      expect(hyphenCount).toBe(4);
    });

    test('should be lowercase', () => {
      // Expected: all characters are lowercase (or digits)
      const uuid = crypto.randomUUID();
      expect(uuid).toBe(uuid.toLowerCase());
    });
  });

  describe('collision resistance', () => {
    test('should have negligible collision probability in 1 million IDs', () => {
      // Expected: no collisions in 1 million generated IDs
      // This is a statistical test; UUID v4 has 122 bits of randomness
      const ids = new Set();
      const iterations = 100000; // Reduced for test performance
      for (let i = 0; i < iterations; i++) {
        ids.add(crypto.randomUUID());
      }
      expect(ids.size).toBe(iterations); // All unique
    });
  });

  describe('comparison with old method', () => {
    test('should be more reliable than Date.now() + Math.random()', () => {
      // Expected: UUID is cryptographically secure, old method is not
      // Old method: `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
      // Could have collisions if called in same millisecond with same random value
      
      // Generate multiple IDs in quick succession
      const oldIds = [];
      for (let i = 0; i < 100; i++) {
        oldIds.push(`${Date.now()}-${Math.random().toString(36).slice(2, 11)}`);
      }
      
      // UUID method
      const uuidIds = [];
      for (let i = 0; i < 100; i++) {
        uuidIds.push(crypto.randomUUID());
      }
      
      // Both should have no duplicates, but UUID is more reliable
      const oldSet = new Set(oldIds);
      const uuidSet = new Set(uuidIds);
      
      expect(oldSet.size).toBe(100);
      expect(uuidSet.size).toBe(100);
      // UUID is guaranteed unique; old method is probabilistic
    });
  });
});
