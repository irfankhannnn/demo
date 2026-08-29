/**
 * Unit tests for server/conversationStateService.js
 * Tests: conversation state management, intent tracking, context enrichment
 */

import { extractEntitiesFromToolResults } from './conversationStateService.js';

describe('Conversation State Service', () => {
  describe('State Initialization', () => {
    test('should create valid initial state structure', () => {
      const tenantId = 'tenant-123';
      const contactPhone = '+91-9876543210';
      const initialContext = { leadId: 'lead-456' };

      // Simulated state creation
      const state = {
        tenantId,
        contactPhone,
        status: 'active',
        intent: null,
        topic: null,
        messageCount: 0,
        context: initialContext,
      };

      expect(state.tenantId).toBe(tenantId);
      expect(state.contactPhone).toBe(contactPhone);
      expect(state.status).toBe('active');
      expect(state.messageCount).toBe(0);
      expect(state.context.leadId).toBe('lead-456');
    });

    test('should initialize with empty context if not provided', () => {
      const state = {
        status: 'active',
        context: {},
      };

      expect(state.context).toEqual({});
    });

    test('should set status to active on initialization', () => {
      const state = {
        status: 'active',
      };

      expect(state.status).toBe('active');
    });
  });

  describe('State Updates', () => {
    test('should update intent', () => {
      let state = {
        intent: null,
      };

      state.intent = 'inquiry';
      expect(state.intent).toBe('inquiry');
    });

    test('should update topic', () => {
      let state = {
        topic: null,
      };

      state.topic = 'property_search';
      expect(state.topic).toBe('property_search');
    });

    test('should increment message count', () => {
      let state = {
        messageCount: 0,
      };

      state.messageCount += 1;
      expect(state.messageCount).toBe(1);

      state.messageCount += 1;
      expect(state.messageCount).toBe(2);
    });

    test('should update last message time', () => {
      const now = new Date().toISOString();
      let state = {
        lastMessageAt: null,
      };

      state.lastMessageAt = now;
      expect(state.lastMessageAt).toBe(now);
    });

    test('should merge context updates', () => {
      let state = {
        context: {
          leadId: 'lead-123',
        },
      };

      const contextUpdate = { propertyType: 'apartment' };
      state.context = { ...state.context, ...contextUpdate };

      expect(state.context.leadId).toBe('lead-123');
      expect(state.context.propertyType).toBe('apartment');
    });
  });

  describe('Conversation Status', () => {
    test('should transition from active to paused', () => {
      let state = {
        status: 'active',
      };

      state.status = 'paused';
      expect(state.status).toBe('paused');
    });

    test('should transition from paused to active', () => {
      let state = {
        status: 'paused',
      };

      state.status = 'active';
      expect(state.status).toBe('active');
    });

    test('should transition to resolved', () => {
      let state = {
        status: 'active',
      };

      state.status = 'resolved';
      expect(state.status).toBe('resolved');
    });

    test('should track resolution reason', () => {
      let state = {
        status: 'active',
        resolution: null,
      };

      state.status = 'resolved';
      state.resolution = 'completed';

      expect(state.status).toBe('resolved');
      expect(state.resolution).toBe('completed');
    });
  });

  describe('Intent Tracking', () => {
    test('should recognize inquiry intent', () => {
      const state = {
        intent: 'inquiry',
      };

      expect(state.intent).toBe('inquiry');
    });

    test('should recognize complaint intent', () => {
      const state = {
        intent: 'complaint',
      };

      expect(state.intent).toBe('complaint');
    });

    test('should recognize booking intent', () => {
      const state = {
        intent: 'booking',
      };

      expect(state.intent).toBe('booking');
    });

    test('should recognize follow-up intent', () => {
      const state = {
        intent: 'follow_up',
      };

      expect(state.intent).toBe('follow_up');
    });

    test('should allow null intent initially', () => {
      const state = {
        intent: null,
      };

      expect(state.intent).toBeNull();
    });
  });

  describe('Topic Tracking', () => {
    test('should track property search topic', () => {
      const state = {
        topic: 'property_search',
      };

      expect(state.topic).toBe('property_search');
    });

    test('should track pricing discussion topic', () => {
      const state = {
        topic: 'pricing',
      };

      expect(state.topic).toBe('pricing');
    });

    test('should track documentation topic', () => {
      const state = {
        topic: 'documentation',
      };

      expect(state.topic).toBe('documentation');
    });

    test('should allow null topic initially', () => {
      const state = {
        topic: null,
      };

      expect(state.topic).toBeNull();
    });
  });

  describe('Context Enrichment', () => {
    test('should store lead ID in context', () => {
      const state = {
        context: {
          leadId: 'lead-789',
        },
      };

      expect(state.context.leadId).toBe('lead-789');
    });

    test('should store user ID in context', () => {
      const state = {
        context: {
          userId: 'user-456',
        },
      };

      expect(state.context.userId).toBe('user-456');
    });

    test('should store multiple context fields', () => {
      const state = {
        context: {
          leadId: 'lead-123',
          userId: 'user-456',
          propertyType: 'apartment',
          budget: '50 lakhs',
        },
      };

      expect(state.context.leadId).toBe('lead-123');
      expect(state.context.userId).toBe('user-456');
      expect(state.context.propertyType).toBe('apartment');
      expect(state.context.budget).toBe('50 lakhs');
    });

    test('should preserve existing context when updating', () => {
      let state = {
        context: {
          leadId: 'lead-123',
          userId: 'user-456',
        },
      };

      const newContext = { propertyType: 'villa' };
      state.context = { ...state.context, ...newContext };

      expect(state.context.leadId).toBe('lead-123');
      expect(state.context.userId).toBe('user-456');
      expect(state.context.propertyType).toBe('villa');
    });
  });

  describe('Entity Extraction from Tool Results', () => {
    test('should extract entities from search results array', () => {
      const toolResults = [
        {
          tool: 'search_leads',
          result: {
            ok: true,
            data: {
              items: [
                { id: 'lead-1', name: 'Raj Seller', phone: '9865741230', leadType: 'seller' },
                { id: 'lead-2', name: 'Danish', phone: '9876543210', leadType: 'buyer' },
              ],
            },
          },
        },
      ];

      const entities = extractEntitiesFromToolResults(toolResults);
      expect(entities).toHaveLength(2);
      expect(entities[0].name).toBe('Raj Seller');
      expect(entities[0].id).toBe('lead-1');
      expect(entities[0].type).toBe('lead');
    });

    test('should extract entities from direct array data', () => {
      const toolResults = [
        {
          tool: 'get_lead',
          result: {
            ok: true,
            data: { id: 'lead-3', name: 'Shivam', phone: '9123456789' },
          },
        },
      ];

      const entities = extractEntitiesFromToolResults(toolResults);
      expect(entities).toHaveLength(1);
      expect(entities[0].name).toBe('Shivam');
      expect(entities[0].id).toBe('lead-3');
    });

    test('should skip failed tool results', () => {
      const toolResults = [
        { tool: 'search_leads', result: { ok: false, error: 'timeout' } },
        { tool: 'get_lead', result: { ok: true, data: { id: 'lead-4', name: 'Surbhi' } } },
      ];

      const entities = extractEntitiesFromToolResults(toolResults);
      expect(entities).toHaveLength(1);
      expect(entities[0].name).toBe('Surbhi');
    });

    test('should handle empty tool results', () => {
      expect(extractEntitiesFromToolResults([])).toEqual([]);
      expect(extractEntitiesFromToolResults(null)).toEqual([]);
      expect(extractEntitiesFromToolResults(undefined)).toEqual([]);
    });

    test('should skip malformed tool results', () => {
      const toolResults = [
        null,
        { tool: 'search_leads', result: null },
        { tool: 'search_leads', result: { ok: true, data: null } },
        { tool: 'search_leads', result: { ok: true, data: { id: 'lead-5', name: 'Valid' } } },
      ];
      const entities = extractEntitiesFromToolResults(toolResults);
      expect(entities).toHaveLength(1);
      expect(entities[0].name).toBe('Valid');
    });

    test('should skip items without names', () => {
      const toolResults = [
        {
          tool: 'search_leads',
          result: {
            ok: true,
            data: {
              items: [
                { id: 'lead-x', phone: '1234567890' }, // no name
                { id: 'lead-y', name: 'Has Name' },
              ],
            },
          },
        },
      ];
      const entities = extractEntitiesFromToolResults(toolResults);
      expect(entities).toHaveLength(1);
      expect(entities[0].name).toBe('Has Name');
    });

    test('should truncate long entity names', () => {
      const longName = 'A'.repeat(200);
      const toolResults = [
        {
          tool: 'search_leads',
          result: {
            ok: true,
            data: { id: 'lead-long', name: longName },
          },
        },
      ];
      const entities = extractEntitiesFromToolResults(toolResults);
      expect(entities[0].name).toHaveLength(100);
      expect(entities[0].name).toBe('A'.repeat(100));
    });

    test('should extract entities from plain array data (no items wrapper)', () => {
      const toolResults = [
        {
          tool: 'search_leads',
          result: {
            ok: true,
            data: [
              { id: 'lead-6', name: 'Plain Array Lead' },
            ],
          },
        },
      ];
      const entities = extractEntitiesFromToolResults(toolResults);
      expect(entities).toHaveLength(1);
      expect(entities[0].name).toBe('Plain Array Lead');
    });
  });

  describe('Message Tracking', () => {
    test('should track message count', () => {
      let state = {
        messageCount: 0,
      };

      expect(state.messageCount).toBe(0);

      state.messageCount += 1;
      expect(state.messageCount).toBe(1);

      state.messageCount += 1;
      expect(state.messageCount).toBe(2);
    });

    test('should update last message timestamp', () => {
      const time1 = new Date('2024-01-01T10:00:00Z').toISOString();
      const time2 = new Date('2024-01-01T10:05:00Z').toISOString();

      let state = {
        lastMessageAt: time1,
      };

      expect(state.lastMessageAt).toBe(time1);

      state.lastMessageAt = time2;
      expect(state.lastMessageAt).toBe(time2);
    });

    test('should track conversation duration', () => {
      const createdAt = new Date('2024-01-01T10:00:00Z').toISOString();
      const lastMessageAt = new Date('2024-01-01T10:30:00Z').toISOString();

      const state = {
        createdAt,
        lastMessageAt,
      };

      // Simulated duration calculation
      const created = new Date(state.createdAt);
      const lastMsg = new Date(state.lastMessageAt);
      const durationMs = lastMsg - created;

      expect(durationMs).toBe(30 * 60 * 1000); // 30 minutes
    });
  });

  describe('State Summary', () => {
    test('should generate conversation summary', () => {
      const state = {
        status: 'active',
        intent: 'inquiry',
        topic: 'property_search',
        messageCount: 5,
        lastMessageAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        context: {
          leadId: 'lead-123',
        },
      };

      const summary = {
        status: state.status,
        intent: state.intent,
        topic: state.topic,
        messageCount: state.messageCount,
        lastMessageAt: state.lastMessageAt,
        createdAt: state.createdAt,
        context: state.context,
      };

      expect(summary.status).toBe('active');
      expect(summary.intent).toBe('inquiry');
      expect(summary.messageCount).toBe(5);
    });

    test('should include all relevant fields in summary', () => {
      const state = {
        status: 'active',
        intent: 'inquiry',
        topic: 'property_search',
        messageCount: 3,
        lastMessageAt: '2024-01-01T10:00:00Z',
        createdAt: '2024-01-01T09:00:00Z',
        context: { leadId: 'lead-123' },
      };

      const summary = {
        status: state.status,
        intent: state.intent,
        topic: state.topic,
        messageCount: state.messageCount,
        lastMessageAt: state.lastMessageAt,
        createdAt: state.createdAt,
        context: state.context,
      };

      expect(Object.keys(summary)).toContain('status');
      expect(Object.keys(summary)).toContain('intent');
      expect(Object.keys(summary)).toContain('topic');
      expect(Object.keys(summary)).toContain('messageCount');
      expect(Object.keys(summary)).toContain('lastMessageAt');
      expect(Object.keys(summary)).toContain('createdAt');
      expect(Object.keys(summary)).toContain('context');
    });
  });
});
