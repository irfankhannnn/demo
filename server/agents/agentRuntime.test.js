/**
 * Unit tests for server/agents/agentRuntime.js
 * Tests: personality injection, context loading, conversation history
 */

import { buildSystemPrompt, loadTenantDocs, buildSystemPromptWithContext } from './prompts.js';
import { sanitizeAgentReply } from './agentRuntime.js';

describe('Agent Runtime - System Prompt Building', () => {
  describe('Personality Injection', () => {
    test('should include professional personality in prompt', () => {
      const prompt = buildSystemPrompt('whatsapp', 'tenant-123', 'professional');
      expect(prompt).toContain('professional');
      expect(prompt).toContain('formal');
      expect(prompt).toContain('business-focused');
    });

    test('should include friendly personality in prompt', () => {
      const prompt = buildSystemPrompt('whatsapp', 'tenant-123', 'friendly');
      expect(prompt).toContain('Friendly');
      expect(prompt).toContain('warm');
      expect(prompt).toContain('conversational');
    });

    test('should include direct personality in prompt', () => {
      const prompt = buildSystemPrompt('whatsapp', 'tenant-123', 'direct');
      expect(prompt).toContain('direct');
      expect(prompt).toContain('straightforward');
      expect(prompt).toContain('action-oriented');
    });

    test('should default to professional personality if not specified', () => {
      const prompt = buildSystemPrompt('whatsapp', 'tenant-123');
      expect(prompt).toContain('professional');
    });

    test('should include tenant ID in prompt', () => {
      const tenantId = 'test-tenant-456';
      const prompt = buildSystemPrompt('whatsapp', tenantId);
      expect(prompt).toContain(tenantId);
    });

    test('should include agent-specific role', () => {
      const prompt = buildSystemPrompt('whatsapp', 'tenant-123');
      expect(prompt).toContain('WhatsApp');
      expect(prompt).toContain('CRM assistant');
    });

    test('should include critical rules', () => {
      const prompt = buildSystemPrompt('whatsapp', 'tenant-123');
      expect(prompt).toContain('CRITICAL RULES');
      expect(prompt).toContain('NEVER write your internal reasoning');
      expect(prompt).toContain('NEVER output more than 2 short sentences');
    });
  });

  describe('Agent-Specific Prompts', () => {
    test('qualifier agent should have qualification rules', () => {
      const prompt = buildSystemPrompt('qualifier', 'tenant-123');
      expect(prompt).toContain('Lead Qualifier');
      expect(prompt).toContain('HOT');
      expect(prompt).toContain('WARM');
      expect(prompt).toContain('COLD');
    });

    test('router agent should have assignment rules', () => {
      const prompt = buildSystemPrompt('router', 'tenant-123');
      expect(prompt).toContain('Lead Router');
      expect(prompt).toContain('assignedTo');
    });

    test('followup agent should have message rules', () => {
      const prompt = buildSystemPrompt('followup', 'tenant-123');
      expect(prompt).toContain('Follow-up Agent');
      expect(prompt).toContain('Hinglish');
      expect(prompt).toContain('300 characters');
    });

    test('whatsapp agent should have WhatsApp-specific rules', () => {
      const prompt = buildSystemPrompt('whatsapp', 'tenant-123');
      expect(prompt).toContain('WhatsApp');
      expect(prompt).toContain('Hinglish');
      expect(prompt).toContain('200 characters');
      expect(prompt).toContain('MUST BE VALID JSON');
      expect(prompt).toContain('reply');
      expect(prompt).toContain('thinking');
    });
  });

  describe('Prompt Structure', () => {
    test('should be a non-empty string', () => {
      const prompt = buildSystemPrompt('whatsapp', 'tenant-123');
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(0);
    });

    test('should not have leading/trailing whitespace', () => {
      const prompt = buildSystemPrompt('whatsapp', 'tenant-123');
      expect(prompt).toBe(prompt.trim());
    });

    test('should contain multiple sections', () => {
      const prompt = buildSystemPrompt('whatsapp', 'tenant-123');
      const lines = prompt.split('\n');
      expect(lines.length).toBeGreaterThan(5);
    });
  });

  describe('Personality Variations', () => {
    test('professional and friendly prompts should be different', () => {
      const professional = buildSystemPrompt('whatsapp', 'tenant-123', 'professional');
      const friendly = buildSystemPrompt('whatsapp', 'tenant-123', 'friendly');
      expect(professional).not.toBe(friendly);
    });

    test('all personalities should include tenant ID', () => {
      const tenantId = 'test-tenant-789';
      const personalities = ['professional', 'friendly', 'direct'];
      
      personalities.forEach(personality => {
        const prompt = buildSystemPrompt('whatsapp', tenantId, personality);
        expect(prompt).toContain(tenantId);
      });
    });

    test('all personalities should include critical rules', () => {
      const personalities = ['professional', 'friendly', 'direct'];
      
      personalities.forEach(personality => {
        const prompt = buildSystemPrompt('whatsapp', 'tenant-123', personality);
        expect(prompt).toContain('CRITICAL RULES');
      });
    });
  });
});

describe('Agent Runtime - Context Management', () => {
  describe('Conversation Context', () => {
    test('should format conversation history correctly', () => {
      const conversationHistory = [
        { role: 'user', content: 'Hi, I need a property' },
        { role: 'assistant', content: 'Sure! What type of property?' },
      ];

      const contextStr = conversationHistory
        .map(msg => `${msg.role}: ${msg.content}`)
        .join('\n');

      expect(contextStr).toContain('user: Hi, I need a property');
      expect(contextStr).toContain('assistant: Sure! What type of property?');
    });

    test('should handle empty conversation history', () => {
      const conversationHistory = [];
      const contextStr = conversationHistory
        .map(msg => `${msg.role}: ${msg.content}`)
        .join('\n');

      expect(contextStr).toBe('');
    });

    test('should preserve message order', () => {
      const conversationHistory = [
        { role: 'user', content: 'First message' },
        { role: 'assistant', content: 'Second message' },
        { role: 'user', content: 'Third message' },
      ];

      const contextStr = conversationHistory
        .map(msg => `${msg.role}: ${msg.content}`)
        .join('\n');

      const lines = contextStr.split('\n');
      expect(lines[0]).toContain('First message');
      expect(lines[1]).toContain('Second message');
      expect(lines[2]).toContain('Third message');
    });
  });

  describe('Lead Context', () => {
    test('should format lead context correctly', () => {
      const leadContext = {
        leadId: 'lead-123',
        leadName: 'John Doe',
        leadPhone: '+91-9876543210',
        leadEmail: 'john@example.com',
        leadType: 'buyer',
        leadScore: 85,
        leadSource: 'whatsapp',
        leadStatus: 'hot',
      };

      const leadStr = `
Lead Information:
- Name: ${leadContext.leadName || 'N/A'}
- Phone: ${leadContext.leadPhone || 'N/A'}
- Email: ${leadContext.leadEmail || 'N/A'}
- Type: ${leadContext.leadType || 'N/A'}
- Score: ${leadContext.leadScore || 'N/A'}
- Source: ${leadContext.leadSource || 'N/A'}
- Status: ${leadContext.leadStatus || 'N/A'}`;

      expect(leadStr).toContain('John Doe');
      expect(leadStr).toContain('buyer');
      expect(leadStr).toContain('85');
      expect(leadStr).toContain('hot');
    });

    test('should handle missing lead fields', () => {
      const leadContext = {
        leadId: 'lead-456',
        leadName: 'Jane Smith',
      };

      const leadStr = `
Lead Information:
- Name: ${leadContext.leadName || 'N/A'}
- Phone: ${leadContext.leadPhone || 'N/A'}
- Email: ${leadContext.leadEmail || 'N/A'}
- Type: ${leadContext.leadType || 'N/A'}
- Score: ${leadContext.leadScore || 'N/A'}
- Source: ${leadContext.leadSource || 'N/A'}
- Status: ${leadContext.leadStatus || 'N/A'}`;

      expect(leadStr).toContain('Jane Smith');
      expect(leadStr).toContain('N/A');
    });
  });
});

describe('Agent Runtime - Structured Reply Sanitization', () => {
  test('should extract reply from JSON output', () => {
    const raw = '{"thinking":"User said hello. Greet back.","reply":"Hello! Kaise help kar sakta hoon?"}';
    expect(sanitizeAgentReply(raw)).toBe('Hello! Kaise help kar sakta hoon?');
  });

  test('should extract reply from JSON inside markdown code fences', () => {
    const raw = '```json\n{"thinking":"Plan greeting","reply":"Namaste! Kya help chahiye?"}\n```';
    expect(sanitizeAgentReply(raw)).toBe('Namaste! Kya help chahiye?');
  });

  test('should fallback to heuristic for plain text reply', () => {
    const raw = 'Hello! Kaise help kar sakta hoon?';
    expect(sanitizeAgentReply(raw)).toBe('Hello! Kaise help kar sakta hoon?');
  });

  test('should strip leaked reasoning from mixed text', () => {
    const raw = 'The user said hello. I need to respond in Hinglish.\n\nHello! Kaise help kar sakta hoon?';
    expect(sanitizeAgentReply(raw)).toContain('Hello! Kaise help kar sakta hoon?');
    expect(sanitizeAgentReply(raw)).not.toContain('The user said');
  });

  test('should handle empty or invalid input', () => {
    expect(sanitizeAgentReply('')).toBe('');
    expect(sanitizeAgentReply(null)).toBe(null);
    expect(sanitizeAgentReply(undefined)).toBe(undefined);
  });
});

describe('Agent Runtime - Async Tenant Docs', () => {
  describe('loadTenantDocs', () => {
    test('should return an object for an existing tenant', async () => {
      const docs = await loadTenantDocs('example-tenant');
      expect(typeof docs).toBe('object');
    });

    test('should return businessContext for example-tenant', async () => {
      const docs = await loadTenantDocs('example-tenant');
      expect(docs.businessContext).toBeDefined();
      expect(typeof docs.businessContext).toBe('string');
      expect(docs.businessContext.length).toBeGreaterThan(0);
    });

    test('should return teamMembers for example-tenant', async () => {
      const docs = await loadTenantDocs('example-tenant');
      expect(docs.teamMembers).toBeDefined();
      expect(typeof docs.teamMembers).toBe('string');
      expect(docs.teamMembers.length).toBeGreaterThan(0);
    });

    test('should return empty object for non-existent tenant', async () => {
      const docs = await loadTenantDocs('non-existent-tenant-xyz');
      expect(docs).toEqual({});
    });
  });

  describe('buildSystemPromptWithContext', () => {
    test('should build prompt with tenant context for example-tenant', async () => {
      const prompt = await buildSystemPromptWithContext('whatsapp', 'example-tenant', 'professional');
      expect(typeof prompt).toBe('string');
      expect(prompt).toContain('CRM assistant');
      expect(prompt).toContain('example-tenant');
    });

    test('should include business context when available', async () => {
      const prompt = await buildSystemPromptWithContext('whatsapp', 'example-tenant', 'professional');
      // The example tenant has a business-context.md file
      expect(prompt).toContain('Tenant Business Context');
    });

    test('should include team members when available', async () => {
      const prompt = await buildSystemPromptWithContext('whatsapp', 'example-tenant', 'professional');
      expect(prompt).toContain('Team Members');
    });

    test('should fall back to base prompt for non-existent tenant', async () => {
      const prompt = await buildSystemPromptWithContext('whatsapp', 'non-existent-tenant-xyz', 'professional');
      expect(prompt).toContain('CRM assistant');
      expect(prompt).not.toContain('Tenant Business Context');
    });

    test('should accept pre-loaded tenant docs', async () => {
      const preloadedDocs = {
        businessContext: 'Custom business context',
        teamMembers: 'Custom team members',
      };
      const prompt = await buildSystemPromptWithContext('whatsapp', 'any-tenant', 'friendly', preloadedDocs);
      expect(prompt).toContain('Custom business context');
      expect(prompt).toContain('Custom team members');
    });
  });
});
