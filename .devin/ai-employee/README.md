# AI Employee Knowledge Base

This directory contains system prompts, tool guidance, and tenant-specific documentation for the AI Employee system.

## Directory Structure

### `/system-prompts/`
Base system prompts and personality-specific guidance:
- `base.md` - Base system prompt
- `personality-professional.md` - Professional tone guidelines
- `personality-friendly.md` - Friendly tone guidelines
- `personality-direct.md` - Direct tone guidelines

### `/tools/`
Tool-specific guidance and best practices:
- `lead-creation.md` - How to create leads effectively
- `lead-qualification.md` - Lead qualification guidelines
- `lead-conversion.md` - Converting leads to transactions
- `search-leads.md` - Searching and filtering leads

### `/tenant-templates/`
Tenant-specific business context and team information:
- `example-tenant/` - Example tenant configuration
  - `business-context.md` - Company overview, target market, value proposition
  - `team-members.md` - Team member details and specializations
  - `custom-rules.md` - Custom business rules and constraints

### `/examples/`
Example conversations and responses:
- `good-responses.md` - Examples of high-quality AI responses
- `bad-responses.md` - Examples of responses to avoid
- `conversation-flows.md` - Common conversation patterns

## How It Works

When an agent is invoked:
1. Base system prompt is loaded from `buildSystemPrompt()`
2. Personality is injected based on `agencyConfig.aiPersonality`
3. Tenant-specific docs are loaded from `tenant-templates/{tenantId}/`
4. All context is combined into the final system prompt

## Adding Tenant Documentation

To add documentation for a new tenant:

1. Create a directory: `.devin/ai-employee/tenant-templates/{tenantId}/`
2. Add `business-context.md` with company overview
3. Add `team-members.md` with team details
4. (Optional) Add `custom-rules.md` with business-specific rules

Example:
```
.devin/ai-employee/tenant-templates/acme-corp-123/
├── business-context.md
├── team-members.md
└── custom-rules.md
```

The AI will automatically load and use this documentation when responding to users from that tenant.

## Best Practices

- Keep documentation concise and factual
- Use Hinglish for friendly personality guidance
- Include specific examples when possible
- Update documentation as business context changes
- Test responses after updating documentation
