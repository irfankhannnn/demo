import { appendFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const logFile = join(__dirname, "dump-tools.log");

// Clear previous log
writeFileSync(logFile, "");

function log(...args) {
  const msg = args
    .map((a) => (typeof a === "string" ? a : JSON.stringify(a, null, 2)))
    .join(" ");

  appendFileSync(logFile, msg + "\n");
  console.log(...args);
}

process.on("uncaughtException", (err) => {
  appendFileSync(
    logFile,
    "\n===== UNCAUGHT EXCEPTION =====\n" + (err?.stack || err) + "\n",
  );
});

process.on("unhandledRejection", (err) => {
  appendFileSync(
    logFile,
    "\n===== UNHANDLED REJECTION =====\n" + (err?.stack || err) + "\n",
  );
});

log("Script started");

try {
  const { buildGeminiToolDefinitions, buildAnthropicToolDefinitions } =
    await import("../agents/agentRuntime.js");

  const { buildSystemPrompt } = await import("../agents/prompts.js");

  const { ALLOWED_TOOLS } = await import("../skillInvoker.js");

  const tenantId = "acme-corporation-edc6e9feb8";

  const systemPrompt = buildSystemPrompt("whatsapp", tenantId, "friendly");

  const geminiTools = buildGeminiToolDefinitions();
  const anthropicTools = buildAnthropicToolDefinitions();

  const report = [];

  report.push("=== TOOL DEFINITIONS DUMP ===");
  report.push(`Allowed tools: ${ALLOWED_TOOLS.length}`);
  report.push("");

  for (const tool of geminiTools) {
    report.push(`--- ${tool.name} ---`);
    report.push(tool.description);
    report.push(JSON.stringify(tool.parameters, null, 2));
    report.push("");
  }

  report.push("");
  report.push("System Prompt:");
  report.push(systemPrompt);

  const outputFile = join(dirname(__dirname), "tool-definitions-dump.txt");

  writeFileSync(outputFile, report.join("\n"));

  log("Output written to:", outputFile);
  log("Gemini tools:", geminiTools.length);
  log("Anthropic tools:", anthropicTools.length);
  log("Done.");
} catch (err) {
  appendFileSync(logFile, "\n===== ERROR =====\n" + (err?.stack || err) + "\n");

  console.error(err);
}
