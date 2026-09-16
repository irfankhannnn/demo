# OpenClaw Architectural Patterns & Design Principles
## A Reference Guide for RealtyFlow Architecture Evolution

**Generated:** June 25, 2026  
**Scope:** Core architectural strengths, design patterns, and lessons for extensible systems  
**Audience:** RealtyFlow architects and senior engineers

---

## Part 1: Core Architectural Strengths

### 1.1 Separation of Concerns with Clear Boundaries

OpenClaw implements a **layered architecture with strict import boundaries** that prevents circular dependencies and keeps concerns separated:

#### Plugin SDK Boundary (`src/plugin-sdk/`)
- **Principle:** Extensions can ONLY import from `openclaw/plugin-sdk/*`, never from core internals
- **Mechanism:** Progressive disclosure via narrow subpaths (e.g., `plugin-entry`, `channel-core`, `provider-entry`)
- **Benefit:** Prevents ad hoc core dependencies, keeps startup fast via lazy loading
- **Implementation:** 200+ generated subpaths in `scripts/lib/plugin-sdk-entrypoints.json`

**RealtyFlow Application:**
```typescript
// ✅ GOOD - Narrow, purpose-built subpath
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { defineChannelPluginEntry } from "openclaw/plugin-sdk/channel-core";

// ❌ BAD - Broad convenience barrel (avoid)
import { definePlugin, defineChannel, defineProvider } from "openclaw/plugin-sdk";

// ❌ FORBIDDEN - Direct core imports
import { pluginRegistry } from "openclaw/src/plugins/registry";
```

#### Channel Boundary (`src/channels/`)
- **Principle:** Core owns the shared `message` tool; channels own discovery and execution
- **Mechanism:** Typed adapters (config, auth, messaging, outbound, pairing, security)
- **Benefit:** Avoids tool proliferation, consistent message handling across channels
- **Implementation:** `src/channels/plugins/types.plugin.ts:53-96` defines the contract

#### Provider Boundary (`src/plugins/`)
- **Principle:** Core owns the generic inference loop; providers own specific behavior
- **Mechanism:** Provider-specific hooks for auth, model resolution, request transformation
- **Benefit:** No hardcoded provider logic in core, clean separation of concerns
- **Implementation:** `src/plugins/types.ts` defines provider contracts

#### Gateway Protocol Boundary (`src/gateway/protocol/`)
- **Principle:** Typed wire protocol with additive evolution only
- **Mechanism:** TypeBox schemas generate JSON Schema and Swift models
- **Benefit:** Type safety across client/server, breaking changes explicit
- **Implementation:** `src/gateway/protocol/schema.ts` exports all schemas

### 1.2 Control Plane vs Runtime Plane Separation

OpenClaw separates **metadata-driven discovery** from **execution-only runtime**:

#### Control Plane (Metadata-Driven)
```
Manifest Discovery
    ↓
Config Validation (without plugin execution)
    ↓
Activation Planning (from metadata)
    ↓
Enablement Decision
```

**Key Insight:** Validation, discovery, and planning work from manifest metadata WITHOUT loading plugin code.

#### Runtime Plane (Execution-Only)
```
Narrow Targeted Loaders
    ↓
Plugin Runtime Resolution
    ↓
Capability Registration
    ↓
Feature Execution
```

**Key Insight:** Actual execution only happens when needed, via narrow, focused loaders.

**RealtyFlow Application:**
```typescript
// Control Plane: Validate config from manifest
const manifest = loadPluginManifest(pluginPath);
const configValid = validateConfigAgainstSchema(userConfig, manifest.configSchema);
const isActivated = shouldActivatePlugin(manifest, userConfig);

// Runtime Plane: Only load if activated
if (isActivated) {
  const plugin = await loadPluginRuntime(pluginPath);
  plugin.register(api);
}
```

### 1.3 Type Safety and Contract Enforcement

OpenClaw uses **strong TypeScript with branded types** to prevent subtle bugs:

#### Branded Config States
```typescript
// Prevents mixing config states
declare const openClawConfigStateBrand: unique symbol;

type BrandedConfigState<TState extends string> = OpenClawConfig & {
  readonly [openClawConfigStateBrand]?: TState;
};

export type SourceConfig = BrandedConfigState<"source">;      // Raw user config
export type ResolvedSourceConfig = BrandedConfigState<"resolved">;  // After normalization
export type RuntimeConfig = BrandedConfigState<"runtime">;    // After materialization

// Compiler prevents: const x: RuntimeConfig = sourceConfig; // ERROR
```

**RealtyFlow Application:**
```typescript
// Define branded states for config lifecycle
type AgencySourceConfig = AgencyConfig & { readonly _state: "source" };
type AgencyResolvedConfig = AgencyConfig & { readonly _state: "resolved" };
type AgencyRuntimeConfig = AgencyConfig & { readonly _state: "runtime" };

// Enforce state transitions
function resolveAgencyConfig(source: AgencySourceConfig): AgencyResolvedConfig {
  // Normalize, validate, resolve env vars
  return { ...source, _state: "resolved" };
}

function materializeAgencyConfig(resolved: AgencyResolvedConfig): AgencyRuntimeConfig {
  // Apply defaults, load secrets
  return { ...resolved, _state: "runtime" };
}
```

#### Typed Error Hierarchy
```typescript
// Prevents error type confusion
export class AcpRuntimeError extends Error {
  readonly code: AcpRuntimeErrorCode;
  override readonly cause?: unknown;
}

// Type guards for error matching
export function isAcpRuntimeError(err: unknown): err is AcpRuntimeError {
  return err instanceof AcpRuntimeError;
}
```

### 1.4 Capability-Based Registration Model

OpenClaw uses **explicit capability registration** instead of ad hoc extensions:

#### Capability Types
```typescript
// Clear, enumerated capability types
export type CapabilityType =
  | "text-inference"
  | "cli-backend"
  | "speech"
  | "realtime-transcription"
  | "realtime-voice"
  | "media-understanding"
  | "image-generation"
  | "music-generation"
  | "video-generation"
  | "web-fetch"
  | "web-search"
  | "channel-messaging";
```

#### Plugin Shapes
```typescript
// Classification of plugin behavior
export type PluginShape =
  | "plain-capability"      // Single capability type
  | "hybrid-capability"     // Multiple capability types
  | "hook-only"            // Legacy compatibility
  | "non-capability";      // Tools, commands, services
```

**RealtyFlow Application:**
```typescript
// Define capability types for RealtyFlow
export type RealtyFlowCapability =
  | "lead-scoring"
  | "lead-routing"
  | "property-search"
  | "contact-enrichment"
  | "document-processing"
  | "video-generation"
  | "sms-delivery"
  | "email-delivery"
  | "whatsapp-messaging";

// Plugin registration
api.registerCapability({
  type: "lead-scoring",
  provider: "claude-haiku",
  config: { model: "claude-3-5-haiku", maxTokens: 1024 },
});
```

---

## Part 2: Design Patterns

### 2.1 Manifest-First Plugin Discovery

**Pattern:** Validate plugins from metadata before loading runtime code.

#### Manifest Structure
```json
{
  "id": "voice-call",
  "name": "Voice Call",
  "version": "1.0.0",
  "configSchema": {
    "type": "object",
    "properties": { "apiKey": { "type": "string" } }
  },
  "providers": ["openrouter"],
  "channels": ["voice-call"],
  "enabledByDefault": true,
  "providerAuthEnvVars": {
    "openrouter": ["OPENROUTER_API_KEY"]
  }
}
```

#### Discovery Pipeline
```
1. Load manifest (JSON only, no code execution)
2. Validate config against schema
3. Plan activation (enabled/disabled/auto)
4. Load plugin runtime (only if activated)
5. Register capabilities
```

**RealtyFlow Application:**
```typescript
// Phase 1: Load manifest (no code execution)
const manifest = JSON.parse(readFileSync("plugin.json", "utf-8"));

// Phase 2: Validate config
const configValid = ajv.validate(manifest.configSchema, userConfig);
if (!configValid) {
  return { error: "Invalid config", details: ajv.errors };
}

// Phase 3: Plan activation
const shouldActivate = manifest.enabledByDefault && !userConfig.disabled;

// Phase 4: Load runtime (only if activated)
if (shouldActivate) {
  const { register } = await import("./index.js");
  register(api);
}
```

### 2.2 Plugin SDK Pattern with Narrow Subpaths

**Pattern:** Prevent circular dependencies and keep startup fast via progressive disclosure.

#### Subpath Organization
```
openclaw/plugin-sdk/
├── plugin-entry.ts           # Main entry point
├── channel-core.ts           # Channel plugins
├── channel-setup.ts          # Setup wizards
├── channel-pairing.ts        # Pairing flows
├── provider-entry.ts         # Provider plugins
├── provider-auth.ts          # Auth methods
├── provider-catalog.ts       # Model catalog
└── ... (200+ subpaths)
```

#### Import Rules
```typescript
// ✅ GOOD - Narrow, specific subpath
import { defineChannelPluginEntry } from "openclaw/plugin-sdk/channel-core";
import { createProviderApiKeyAuthMethod } from "openclaw/plugin-sdk/provider-auth";

// ❌ BAD - Broad barrel (causes circular deps)
import { defineChannel, defineProvider } from "openclaw/plugin-sdk";

// ❌ FORBIDDEN - Core internals
import { channelRegistry } from "openclaw/src/channels/registry";
```

**RealtyFlow Application:**
```typescript
// Create narrow subpaths for RealtyFlow extensions
export {
  // Lead scoring
  defineLeadScorerPlugin,
  createLeadScorerAuthMethod,
} from "./lead-scorer-entry.js";

export {
  // Lead routing
  defineLeadRouterPlugin,
  createLeadRouterAuthMethod,
} from "./lead-router-entry.js";

export {
  // Property search
  definePropertySearchPlugin,
} from "./property-search-entry.js";
```

### 2.3 Schema-Based Configuration with UI Hints

**Pattern:** Use JSON Schema with UI metadata for automatic form generation.

#### Config Schema with Hints
```typescript
export const configSchema = Type.Object({
  apiKey: Type.String({
    title: "API Key",
    description: "Your API key from provider",
    examples: ["sk-..."],
    sensitive: true,  // Hide in UI
  }),
  model: Type.String({
    title: "Model",
    description: "Model to use",
    enum: ["gpt-4", "gpt-3.5-turbo"],
    default: "gpt-4",
  }),
  maxTokens: Type.Integer({
    title: "Max Tokens",
    description: "Maximum tokens in response",
    minimum: 1,
    maximum: 4096,
    default: 1024,
  }),
});
```

#### Generated UI Form
```
┌─────────────────────────────────┐
│ Configuration                    │
├─────────────────────────────────┤
│ API Key: [••••••••••••••••••••] │ (hidden)
│ Model: [gpt-4 ▼]               │ (dropdown)
│ Max Tokens: [1024]             │ (number input)
│                                 │
│ [Save] [Cancel]                │
└─────────────────────────────────┘
```

**RealtyFlow Application:**
```typescript
import { Type } from "@sinclair/typebox";

export const agencyConfigSchema = Type.Object({
  aiPersonality: Type.String({
    title: "AI Personality",
    description: "How the AI assistant should communicate",
    enum: ["professional", "friendly", "direct"],
    default: "professional",
  }),
  followupAgentMode: Type.String({
    title: "Follow-up Agent Mode",
    description: "How to send follow-up messages",
    enum: ["draft", "autosend"],
    default: "draft",
  }),
  businessHoursStart: Type.String({
    title: "Business Hours Start",
    description: "When to start auto-replies (24-hour format)",
    pattern: "^[0-2][0-9]:[0-5][0-9]$",
    default: "09:00",
  }),
  businessHoursEnd: Type.String({
    title: "Business Hours End",
    description: "When to stop auto-replies (24-hour format)",
    pattern: "^[0-2][0-9]:[0-5][0-9]$",
    default: "18:00",
  }),
});
```

### 2.4 Diagnostic Events for Observability

**Pattern:** Structured event stream for real-time observability without blocking.

#### Event Types
```typescript
export type DiagnosticEventType =
  | "model.usage"           // Token usage and cost
  | "webhook.received"      // Webhook ingress
  | "webhook.processed"     // Webhook handled
  | "webhook.error"         // Webhook error
  | "message.queued"        // Message enqueued
  | "message.processed"     // Message processed
  | "session.state"         // Session state change
  | "session.stuck"         // Session stuck warning
  | "tool.loop"            // Tool loop detected
  | "diagnostic.heartbeat"; // System heartbeat
```

#### Event Emission
```typescript
export function emitDiagnosticEvent(event: DiagnosticEvent): void {
  // Non-blocking emission
  // Handlers registered via onDiagnosticEvent()
  // Recursion guard: if (state.dispatchDepth > 100) return;
}

export function onDiagnosticEvent(
  handler: (event: DiagnosticEvent) => void
): void {
  // Register event handler
  // Multiple handlers supported
}
```

**RealtyFlow Application:**
```typescript
// Emit diagnostic events for observability
emitDiagnosticEvent({
  type: "model.usage",
  timestamp: Date.now(),
  sequenceNumber: nextSeq++,
  tenantId,
  sessionKey,
  data: {
    provider: "bedrock",
    model: "claude-haiku",
    inputTokens: 250,
    outputTokens: 150,
    totalTokens: 400,
    costUsd: 0.0015,
    durationMs: 1250,
  },
});

emitDiagnosticEvent({
  type: "tool.loop",
  timestamp: Date.now(),
  tenantId,
  sessionKey,
  data: {
    toolName: "search_leads",
    level: "warning",
    action: "warn",
    detector: "generic_repeat",
    count: 3,
    message: "Tool called 3 times in a row",
  },
});
```

### 2.5 Graceful Degradation and Error Boundaries

**Pattern:** Extension failures don't crash the system; errors are isolated and reported.

#### Error Boundary Pattern
```typescript
export async function withErrorBoundary<T>(params: {
  run: () => Promise<T>;
  fallbackValue: T;
  onError?: (err: unknown) => void;
}): Promise<T> {
  try {
    return await params.run();
  } catch (err) {
    params.onError?.(err);
    return params.fallbackValue;
  }
}

// Usage
const result = await withErrorBoundary({
  run: () => loadPluginRuntime(pluginPath),
  fallbackValue: null,
  onError: (err) => logger.error("Plugin load failed", err),
});
```

#### Plugin Load Failure Handling
```typescript
// Plugin failures don't crash the system
const pluginResults = plugins.map((plugin) =>
  withErrorBoundary({
    run: () => plugin.register(api),
    fallbackValue: { status: "failed" },
    onError: (err) => {
      diagnostics.recordPluginFailure(plugin.id, err);
      metrics.pluginLoadFailed(plugin.id);
    },
  })
);

// System continues even if some plugins fail
const successCount = pluginResults.filter((r) => r.status === "success").length;
logger.info(`Loaded ${successCount}/${plugins.length} plugins`);
```

**RealtyFlow Application:**
```typescript
// Graceful degradation for agent invocation
export async function invokeAgentWithFallback(
  tenantId: string,
  agentId: string,
  prompt: string
): Promise<AgentResult> {
  // Try primary agent
  const result = await withErrorBoundary({
    run: () => invokeAgent(tenantId, agentId, prompt),
    fallbackValue: null,
    onError: (err) => {
      logger.warn("Agent invocation failed", { tenantId, agentId, error: err });
      emitDiagnosticEvent({
        type: "agent.error",
        tenantId,
        data: { agentId, error: String(err) },
      });
    },
  });

  // If primary fails, try fallback
  if (!result) {
    return {
      ok: false,
      error: "Agent unavailable",
      fallback: true,
    };
  }

  return result;
}
```

### 2.6 SecretRef System for Secret Management

**Pattern:** Provider-based secret management with path resolution and type safety.

#### SecretRef Structure
```typescript
export type SecretRef = {
  source: "env" | "file" | "exec";
  provider: string;
  id: string;
};

export type SecretInput = string | SecretRef;
```

#### Secret Resolution
```typescript
export async function resolveSecret(
  ref: SecretRef,
  env: NodeJS.ProcessEnv
): Promise<string> {
  switch (ref.source) {
    case "env":
      // Resolve from environment variable
      return env[ref.id] || throwMissingSecret(ref);

    case "file":
      // Resolve from file (JSON pointer path)
      const content = readFileSync(ref.id, "utf-8");
      return JSON.parse(content).apiKey;

    case "exec":
      // Resolve from command execution
      const { stdout } = execSync(ref.id);
      return stdout.trim();
  }
}
```

**RealtyFlow Application:**
```typescript
// Define secrets in config
const config = {
  models: {
    providers: {
      bedrock: {
        apiKey: {
          source: "env",
          provider: "default",
          id: "AWS_ACCESS_KEY_ID",
        },
      },
      gemini: {
        apiKey: {
          source: "file",
          provider: "vault",
          id: "/secrets/gemini-api-key.json",
        },
      },
    },
  },
};

// Resolve at startup
const secrets = await resolveSecrets(config);
const bedrockKey = secrets.models.providers.bedrock.apiKey;
const geminiKey = secrets.models.providers.gemini.apiKey;
```

---

## Part 3: Implementation Roadmap for RealtyFlow

### Phase 1: Foundation (2-3 weeks)

**Objective:** Establish architectural boundaries and manifest-first design.

#### 1.1 Define Plugin Boundaries
```typescript
// Create plugin-sdk/ with narrow subpaths
export {
  defineLeadScorerPlugin,
  defineLeadRouterPlugin,
  definePropertySearchPlugin,
} from "./plugin-sdk/index.js";

// Prevent core imports
// ESLint rule: no-restricted-imports
// "openclaw/src/**": "Use plugin-sdk instead"
```

#### 1.2 Create Manifest System
```typescript
// Define manifest schema
export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  configSchema: JSONSchema;
  capabilities: CapabilityType[];
  enabledByDefault: boolean;
}

// Implement manifest loader
export function loadPluginManifest(path: string): PluginManifest {
  const raw = JSON.parse(readFileSync(`${path}/plugin.json`, "utf-8"));
  return validateManifest(raw);
}
```

#### 1.3 Implement Config Validation
```typescript
// Use Zod for runtime validation
import { z } from "zod";

export const agencyConfigSchema = z.object({
  aiPersonality: z.enum(["professional", "friendly", "direct"]),
  followupAgentMode: z.enum(["draft", "autosend"]),
  businessHoursStart: z.string().regex(/^\d{2}:\d{2}$/),
  businessHoursEnd: z.string().regex(/^\d{2}:\d{2}$/),
});

// Generate JSON Schema for UI
export const agencyConfigJsonSchema = zodToJsonSchema(agencyConfigSchema);
```

### Phase 2: Observability (2-3 weeks)

**Objective:** Implement diagnostic events and structured logging.

#### 2.1 Define Event Types
```typescript
export type RealtyFlowEvent =
  | { type: "agent.invoked"; agentId: string; tenantId: string }
  | { type: "agent.completed"; agentId: string; durationMs: number }
  | { type: "agent.error"; agentId: string; error: string }
  | { type: "tool.called"; toolName: string; input: unknown }
  | { type: "tool.completed"; toolName: string; durationMs: number }
  | { type: "tool.loop"; toolName: string; count: number }
  | { type: "webhook.received"; eventType: string }
  | { type: "webhook.processed"; durationMs: number }
  | { type: "webhook.error"; error: string };
```

#### 2.2 Implement Event Emitter
```typescript
const eventHandlers = new Map<string, Set<(event: RealtyFlowEvent) => void>>();

export function onEvent(
  type: RealtyFlowEvent["type"],
  handler: (event: RealtyFlowEvent) => void
): void {
  if (!eventHandlers.has(type)) {
    eventHandlers.set(type, new Set());
  }
  eventHandlers.get(type)!.add(handler);
}

export function emitEvent(event: RealtyFlowEvent): void {
  const handlers = eventHandlers.get(event.type) || new Set();
  for (const handler of handlers) {
    try {
      handler(event);
    } catch (err) {
      logger.error("Event handler failed", { event, error: err });
    }
  }
}
```

#### 2.3 Add Subsystem Logging
```typescript
export function createSubsystemLogger(subsystem: string) {
  return {
    debug: (msg: string, data?: any) => logger.debug(`[${subsystem}] ${msg}`, data),
    info: (msg: string, data?: any) => logger.info(`[${subsystem}] ${msg}`, data),
    warn: (msg: string, data?: any) => logger.warn(`[${subsystem}] ${msg}`, data),
    error: (msg: string, data?: any) => logger.error(`[${subsystem}] ${msg}`, data),
  };
}

// Usage
const agentLogger = createSubsystemLogger("agent");
const toolLogger = createSubsystemLogger("tool");

agentLogger.info("Agent invoked", { agentId, tenantId });
toolLogger.info("Tool called", { toolName, input });
```

### Phase 3: Type Safety (2-3 weeks)

**Objective:** Implement branded types and error hierarchy.

#### 3.1 Define Branded Config States
```typescript
declare const configStateBrand: unique symbol;

type BrandedConfig<TState extends string> = AgencyConfig & {
  readonly [configStateBrand]?: TState;
};

export type SourceAgencyConfig = BrandedConfig<"source">;
export type ResolvedAgencyConfig = BrandedConfig<"resolved">;
export type RuntimeAgencyConfig = BrandedConfig<"runtime">;

// Enforce state transitions
function resolveAgencyConfig(source: SourceAgencyConfig): ResolvedAgencyConfig {
  // Normalize, validate, resolve env vars
  return { ...source, [configStateBrand]: "resolved" };
}

function materializeAgencyConfig(resolved: ResolvedAgencyConfig): RuntimeAgencyConfig {
  // Apply defaults, load secrets
  return { ...resolved, [configStateBrand]: "runtime" };
}
```

#### 3.2 Create Error Hierarchy
```typescript
export class RealtyFlowError extends Error {
  readonly code: string;
  readonly context?: Record<string, any>;

  constructor(code: string, message: string, context?: Record<string, any>) {
    super(message);
    this.code = code;
    this.context = context;
  }
}

export class AgentError extends RealtyFlowError {
  constructor(message: string, context?: Record<string, any>) {
    super("AGENT_ERROR", message, context);
  }
}

export class ToolError extends RealtyFlowError {
  constructor(message: string, context?: Record<string, any>) {
    super("TOOL_ERROR", message, context);
  }
}

// Type guards
export function isAgentError(err: unknown): err is AgentError {
  return err instanceof AgentError;
}
```

### Phase 4: Plugin System (3-4 weeks)

**Objective:** Implement capability-based plugin registration.

#### 4.1 Define Capability Types
```typescript
export type RealtyFlowCapability =
  | "lead-scoring"
  | "lead-routing"
  | "property-search"
  | "contact-enrichment"
  | "document-processing"
  | "video-generation"
  | "sms-delivery"
  | "email-delivery"
  | "whatsapp-messaging";

export interface CapabilityRegistry {
  register(capability: RealtyFlowCapability, handler: any): void;
  get(capability: RealtyFlowCapability): any | null;
  list(): RealtyFlowCapability[];
}
```

#### 4.2 Implement Plugin Loader
```typescript
export async function loadPlugin(pluginPath: string): Promise<void> {
  // Phase 1: Load manifest
  const manifest = JSON.parse(
    readFileSync(`${pluginPath}/plugin.json`, "utf-8")
  );

  // Phase 2: Validate config
  const configValid = validateConfig(manifest.configSchema, userConfig);
  if (!configValid) {
    throw new Error("Invalid plugin config");
  }

  // Phase 3: Plan activation
  const shouldActivate = manifest.enabledByDefault && !userConfig.disabled;
  if (!shouldActivate) {
    return;
  }

  // Phase 4: Load runtime
  const { register } = await import(`${pluginPath}/index.js`);
  register(api);
}
```

#### 4.3 Create Plugin API
```typescript
export interface PluginAPI {
  registerCapability(
    type: RealtyFlowCapability,
    handler: (input: any) => Promise<any>
  ): void;

  registerTool(tool: {
    name: string;
    description: string;
    execute: (input: any) => Promise<any>;
  }): void;

  onEvent(
    type: string,
    handler: (event: any) => void
  ): void;

  logger: SubsystemLogger;
}

export function definePlugin(config: {
  id: string;
  register: (api: PluginAPI) => void;
}) {
  return config;
}
```

---

## Part 4: Key Takeaways

### 1. Manifest-First Design
- Validate plugins from metadata before code execution
- Enables discovery, planning, and activation without runtime overhead
- Supports UI-driven configuration and plugin marketplace

### 2. Typed Boundaries
- Use branded types to prevent config state confusion
- Enforce import boundaries with ESLint rules
- Create narrow SDK subpaths to prevent circular dependencies

### 3. Capability-Based Registration
- Define explicit capability types instead of ad hoc extensions
- Plugins register capabilities, not arbitrary hooks
- Core orchestrates capabilities, plugins own behavior

### 4. Diagnostic Events
- Emit structured events for observability
- Non-blocking event emission with handler isolation
- Real-time visibility into system behavior

### 5. Graceful Degradation
- Extension failures don't crash the system
- Error boundaries isolate plugin issues
- Fallback mechanisms for critical paths

### 6. Schema-Driven Configuration
- Use JSON Schema with UI hints for automatic forms
- Zod for runtime validation
- Generated documentation from schema

### 7. Separation of Concerns
- Control plane (metadata) separate from runtime (execution)
- Clear boundaries between core and extensions
- Progressive disclosure in documentation

---

## Conclusion

OpenClaw's architecture demonstrates sophisticated design principles for building extensible, maintainable systems. The manifest-first approach, typed boundaries, and capability-based registration model are particularly valuable patterns for RealtyFlow's evolution toward a more modular, plugin-driven architecture.

By adopting these patterns incrementally, RealtyFlow can:
- Reduce coupling between components
- Enable third-party extensions safely
- Improve observability and debugging
- Maintain type safety across boundaries
- Scale the codebase without complexity explosion

The 4-phase implementation roadmap provides a structured path to adopt these patterns without disrupting current operations.

