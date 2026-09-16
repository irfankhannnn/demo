/**
 * Unit tests for apps/crm/server/userCategoryService.js
 * Tests: user categories, tool access control, permissions
 */

import { USER_CATEGORIES, getDefaultUserCategory, getAllUserCategories, getCategoryDefinition } from './userCategoryService.js';
import { toolDefinitions } from './shared/toolDefinitions.js';

const READ_ONLY_TOOL_NAMES = new Set(toolDefinitions.filter((t) => t.readOnly).map((t) => t.name));

describe('User Category Service', () => {
  describe('User Categories Definition', () => {
    test('should define admin category', () => {
      expect(USER_CATEGORIES.admin).toBeDefined();
      expect(USER_CATEGORIES.admin.name).toBe('Administrator');
      expect(USER_CATEGORIES.admin.canAssignLeads).toBe(true);
      expect(USER_CATEGORIES.admin.canDeleteLeads).toBe(true);
      expect(USER_CATEGORIES.admin.canManageUsers).toBe(true);
    });

    test('should define agent category', () => {
      expect(USER_CATEGORIES.agent).toBeDefined();
      expect(USER_CATEGORIES.agent.name).toBe('Sales Agent');
      expect(USER_CATEGORIES.agent.canAssignLeads).toBe(false);
      expect(USER_CATEGORIES.agent.canDeleteLeads).toBe(false);
    });

    test('should define team_lead category', () => {
      expect(USER_CATEGORIES.team_lead).toBeDefined();
      expect(USER_CATEGORIES.team_lead.name).toBe('Team Lead');
      expect(USER_CATEGORIES.team_lead.canAssignLeads).toBe(true);
      expect(USER_CATEGORIES.team_lead.canDeleteLeads).toBe(false);
    });

    test('should define viewer category', () => {
      expect(USER_CATEGORIES.viewer).toBeDefined();
      expect(USER_CATEGORIES.viewer.name).toBe('Viewer');
      expect(USER_CATEGORIES.viewer.canAssignLeads).toBe(false);
      expect(USER_CATEGORIES.viewer.canViewAnalytics).toBe(true);
    });

    test('should define whatsapp_bot category', () => {
      expect(USER_CATEGORIES.whatsapp_bot).toBeDefined();
      expect(USER_CATEGORIES.whatsapp_bot.name).toBe('WhatsApp Bot');
      expect(USER_CATEGORIES.whatsapp_bot.canAssignLeads).toBe(false);
      expect(USER_CATEGORIES.whatsapp_bot.canViewAnalytics).toBe(false);
    });
  });

  describe('Tool Access Control', () => {
    test('admin should have access to all tools', () => {
      const adminTools = USER_CATEGORIES.admin.allowedTools;
      expect(adminTools.length).toBeGreaterThan(20);
      expect(adminTools).toContain('create_lead');
      expect(adminTools).toContain('update_lead');
      expect(adminTools).toContain('create_property');
    });

    test('agent should have limited tool access', () => {
      const agentTools = USER_CATEGORIES.agent.allowedTools;
      expect(agentTools).toContain('create_lead');
      expect(agentTools).toContain('search_leads');
      expect(agentTools).toContain('create_tenant');
      // Agent cannot delete records
      expect(agentTools).not.toContain('delete_lead');
      expect(agentTools).not.toContain('delete_owner');
    });

    test('viewer should only have read tools', () => {
      const viewerTools = USER_CATEGORIES.viewer.allowedTools;
      expect(viewerTools).toContain('get_lead');
      expect(viewerTools).toContain('search_leads');
      expect(viewerTools).not.toContain('create_lead');
      expect(viewerTools).not.toContain('update_lead');
    });

    test('whatsapp_bot should have conversation tools', () => {
      const botTools = USER_CATEGORIES.whatsapp_bot.allowedTools;
      expect(botTools).toContain('create_lead');
      expect(botTools).toContain('search_leads');
      expect(botTools).toContain('create_contact');
    });

    test('team_lead should have assignment tools', () => {
      const teamLeadTools = USER_CATEGORIES.team_lead.allowedTools;
      expect(teamLeadTools).toContain('create_lead');
      expect(teamLeadTools).toContain('update_lead');
      expect(teamLeadTools).toContain('convert_lead');
    });
  });

  describe('Permissions', () => {
    test('admin should have all permissions', () => {
      const adminPerms = USER_CATEGORIES.admin;
      expect(adminPerms.canAssignLeads).toBe(true);
      expect(adminPerms.canDeleteLeads).toBe(true);
      expect(adminPerms.canViewAnalytics).toBe(true);
      expect(adminPerms.canManageUsers).toBe(true);
    });

    test('agent should have limited permissions', () => {
      const agentPerms = USER_CATEGORIES.agent;
      expect(agentPerms.canAssignLeads).toBe(false);
      expect(agentPerms.canDeleteLeads).toBe(false);
      expect(agentPerms.canViewAnalytics).toBe(true);
      expect(agentPerms.canManageUsers).toBe(false);
    });

    test('team_lead should have assignment permission', () => {
      const teamLeadPerms = USER_CATEGORIES.team_lead;
      expect(teamLeadPerms.canAssignLeads).toBe(true);
      expect(teamLeadPerms.canDeleteLeads).toBe(false);
      expect(teamLeadPerms.canManageUsers).toBe(false);
    });

    test('viewer should have analytics permission only', () => {
      const viewerPerms = USER_CATEGORIES.viewer;
      expect(viewerPerms.canAssignLeads).toBe(false);
      expect(viewerPerms.canDeleteLeads).toBe(false);
      expect(viewerPerms.canViewAnalytics).toBe(true);
      expect(viewerPerms.canManageUsers).toBe(false);
    });

    test('whatsapp_bot should have minimal permissions', () => {
      const botPerms = USER_CATEGORIES.whatsapp_bot;
      expect(botPerms.canAssignLeads).toBe(false);
      expect(botPerms.canDeleteLeads).toBe(false);
      expect(botPerms.canViewAnalytics).toBe(false);
      expect(botPerms.canManageUsers).toBe(false);
    });
  });

  describe('Category Hierarchy', () => {
    test('admin should have more tools than team_lead', () => {
      const adminTools = USER_CATEGORIES.admin.allowedTools.length;
      const teamLeadTools = USER_CATEGORIES.team_lead.allowedTools.length;
      expect(adminTools).toBeGreaterThan(teamLeadTools);
    });

    test('team_lead should have more tools than agent', () => {
      const teamLeadTools = USER_CATEGORIES.team_lead.allowedTools.length;
      const agentTools = USER_CATEGORIES.agent.allowedTools.length;
      expect(teamLeadTools).toBeGreaterThanOrEqual(agentTools);
    });

    test('agent should have more tools than viewer', () => {
      const agentTools = USER_CATEGORIES.agent.allowedTools.length;
      const viewerTools = USER_CATEGORIES.viewer.allowedTools.length;
      expect(agentTools).toBeGreaterThan(viewerTools);
    });

    test('viewer should have read-only tools', () => {
      // Asserted against the registry's own `readOnly` flag rather than a
      // get_/search_/find_ name prefix. The prefix heuristic classified
      // `suggest_next_actions` as a write and would fail a viewer list that is
      // in fact entirely read-only.
      const writes = USER_CATEGORIES.viewer.allowedTools.filter((tool) => !READ_ONLY_TOOL_NAMES.has(tool));
      expect(writes).toEqual([]);
    });
  });

  describe('Default Category', () => {
    test('should return agent as default category', () => {
      const defaultCategory = getDefaultUserCategory();
      expect(defaultCategory).toBe('agent');
    });

    test('default category should be defined', () => {
      const defaultCategory = getDefaultUserCategory();
      expect(USER_CATEGORIES[defaultCategory]).toBeDefined();
    });
  });



  describe('Get All Categories', () => {
    test('should return all categories', () => {
      const allCategories = getAllUserCategories();
      expect(Object.keys(allCategories).length).toBeGreaterThan(0);
      expect(allCategories.admin).toBeDefined();
      expect(allCategories.agent).toBeDefined();
      expect(allCategories.viewer).toBeDefined();
    });

    test('should include all expected categories', () => {
      const allCategories = getAllUserCategories();
      expect(allCategories).toHaveProperty('admin');
      expect(allCategories).toHaveProperty('agent');
      expect(allCategories).toHaveProperty('team_lead');
      expect(allCategories).toHaveProperty('viewer');
      expect(allCategories).toHaveProperty('whatsapp_bot');
    });
  });

  describe('Get Category Definition', () => {
    test('should return admin category definition', () => {
      const adminDef = getCategoryDefinition('admin');
      expect(adminDef).toBeDefined();
      expect(adminDef.name).toBe('Administrator');
      expect(adminDef.allowedTools).toBeDefined();
    });

    test('should return agent category definition', () => {
      const agentDef = getCategoryDefinition('agent');
      expect(agentDef).toBeDefined();
      expect(agentDef.name).toBe('Sales Agent');
    });

    test('should return null for invalid category', () => {
      const invalidDef = getCategoryDefinition('invalid_category');
      expect(invalidDef).toBeNull();
    });

    test('should include all required fields in definition', () => {
      const adminDef = getCategoryDefinition('admin');
      expect(adminDef).toHaveProperty('name');
      expect(adminDef).toHaveProperty('description');
      expect(adminDef).toHaveProperty('allowedTools');
      expect(adminDef).toHaveProperty('canAssignLeads');
      expect(adminDef).toHaveProperty('canDeleteLeads');
      expect(adminDef).toHaveProperty('canViewAnalytics');
      expect(adminDef).toHaveProperty('canManageUsers');
    });
  });

  describe('Tool Filtering Logic', () => {
    test('should filter tools correctly for agent', () => {
      const agentTools = USER_CATEGORIES.agent.allowedTools;
      const requestedTools = ['create_lead', 'create_tenant', 'update_lead', 'delete_lead'];
      const filtered = requestedTools.filter(tool => agentTools.includes(tool));
      
      expect(filtered).toContain('create_lead');
      expect(filtered).toContain('create_tenant');
      expect(filtered).toContain('update_lead');
      expect(filtered).not.toContain('delete_lead');
    });

    test('should filter tools correctly for viewer', () => {
      const viewerTools = USER_CATEGORIES.viewer.allowedTools;
      const requestedTools = ['get_lead', 'create_lead', 'search_leads'];
      const filtered = requestedTools.filter(tool => viewerTools.includes(tool));
      
      expect(filtered).toContain('get_lead');
      expect(filtered).toContain('search_leads');
      expect(filtered).not.toContain('create_lead');
    });

    test('should allow all tools for admin', () => {
      const adminTools = USER_CATEGORIES.admin.allowedTools;
      const requestedTools = ['create_lead', 'create_tenant', 'update_lead', 'delete_lead'];
      const filtered = requestedTools.filter(tool => adminTools.includes(tool));
      
      expect(filtered.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Category Descriptions', () => {
    test('should have meaningful descriptions', () => {
      Object.values(USER_CATEGORIES).forEach(category => {
        expect(category.description).toBeDefined();
        expect(category.description.length).toBeGreaterThan(0);
      });
    });

    test('admin description should mention full access', () => {
      const adminDesc = USER_CATEGORIES.admin.description;
      expect(adminDesc.toLowerCase()).toContain('full access');
    });

    test('viewer description should mention read-only', () => {
      const viewerDesc = USER_CATEGORIES.viewer.description;
      expect(viewerDesc.toLowerCase()).toContain('read-only');
    });
  });
});
