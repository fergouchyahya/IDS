/**
 * IDS — Player Core 
 * File: player/src/index.js
 *
 * PURPOSE
 *   Minimal Player entrypoint that proves we can:
 *     - load a config from disk
 *     - validate it against the shared JSON Schema
 *     - normalize it into a deterministic internal model
 *     - print a stable campaign summary
 *     - (Phase 3) accept simulated events over HTTP and run a strict FSM
 *
 * WHY THIS EXISTS
 *   We want correctness before any UI/rendering. The Player must be able to reject
 *   invalid configs early and behave predictably for valid configs. Then we add
 *   event reaction without hardware, still without rendering.
 *
 * LIFECYCLE
 *   1) Parse args/env to locate a config file
 *   2) Load JSON
 *   3) Validate JSON against shared schema (Ajv2020)
 *   4) Convert to internal model (Campaign + RenderItem)
 *   5) Enforce logical constraints (e.g., no duplicate `order`)
 *   6) Print deterministic summary
 *   7) If --serve is enabled: start local HTTP event server + FSM
 *
 * INPUTS
 *   - Config path via:
 *       --config <path>
 *       IDS_CONFIG=<path>
 *   - Mode via:
 *       --mode dev|prod
 *       IDS_MODE=dev|prod
 *   - Server via:
 *       --serve
 *       --port <number>   (default 7070)
 *
 * OUTPUTS
 *   - Human-readable console logs
 *   - Exit codes:
 *       0 success
 *       1 invalid config or logical errors
 *       2 usage / missing files
 *
 * BOUNDARIES
 *   - No rendering (yet)
 *   - No real hardware integration (events are simulated)
 *
 * HOW TO RUN (from repo root)
 *   node player/src/index.js --config shared/contract/examples/config.welcome.json --mode dev
 *
 *   Start event simulation server:
 *   node player/src/index.js --config shared/contract/examples/config.welcome.json --serve
 */

const fs = require("fs");
const path = require("path");

const Ajv2020 = require("ajv/dist/2020");
const addFormats = require("ajv-formats");

const { createServer } = require("./server");
const DummyRenderer = require("./renderer/DummyRenderer");
const { Scheduler } = require("./scheduler");
// -------------------------
// CLI / ENV parsing
// -------------------------

function parseArgs(argv) {
  const args = {
    configPath: process.env.IDS_CONFIG || null,
    adminUrl: process.env.IDS_ADMIN_URL || null,
    configId: process.env.IDS_CONFIG_ID || null,
    guidedFlow: process.env.IDS_GUIDED_FLOW === "1",
    mode: process.env.IDS_MODE || "dev",
    serve: false,
    port: 7070,
    inactivitySec: process.env.IDS_INACTIVITY_SEC
      ? Number(process.env.IDS_INACTIVITY_SEC)
      : null,
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];

    if (a === "--config" && i + 1 < argv.length) {
      args.configPath = argv[++i];
      continue;
    }

    if (a === "--mode" && i + 1 < argv.length) {
      args.mode = argv[++i];
      continue;
    }

    if (a === "--admin-url" && i + 1 < argv.length) {
      args.adminUrl = argv[++i];
      continue;
    }

    if (a === "--config-id" && i + 1 < argv.length) {
      args.configId = argv[++i];
      continue;
    }

    if (a === "--serve") {
      args.serve = true;
      continue;
    }

    if (a === "--guided-flow") {
      args.guidedFlow = true;
      continue;
    }

    if (a === "--port" && i + 1 < argv.length) {
      const p = Number(argv[++i]);
      if (!Number.isInteger(p) || p <= 0 || p > 65535) {
        args.portInvalid = true;
      } else {
        args.port = p;
      }
      continue;
    }

    if (a === "--inactivity" && i + 1 < argv.length) {
      const s = Number(argv[++i]);
      if (!Number.isInteger(s) || s <= 0) {
        args.inactivityInvalid = true;
      } else {
        args.inactivitySec = s;
      }
      continue;
    }

    if (a === "--help" || a === "-h") {
      args.help = true;
      continue;
    }

    args.unknown = args.unknown || [];
    args.unknown.push(a);
  }

  return args;
}

function printUsage() {
  console.log("IDS Player (Phase 2+3 — core logic + simulated events)");
  console.log("");
  console.log("Usage:");
  console.log(
    "  node player/src/index.js [--config <path> | --admin-url <url> [--config-id <id>] | --guided-flow] [--mode dev|prod] [--serve] [--port <n>] [--inactivity <sec>]"
  );
  console.log("");
  console.log("Environment:");
  console.log("  IDS_CONFIG=<path>");
  console.log("  IDS_ADMIN_URL=<http://127.0.0.1:8081>");
  console.log("  IDS_CONFIG_ID=<configId>");
  console.log("  IDS_GUIDED_FLOW=1");
  console.log("  IDS_MODE=dev|prod");
  console.log("  IDS_INACTIVITY_SEC=<seconds>");
}

// -------------------------
// Config loading + validation
// -------------------------

function readJsonFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function buildValidator(schema) {
  const ajv = new Ajv2020({
    strict: false,
    allErrors: true,
  });
  addFormats(ajv);
  return ajv.compile(schema);
}

function formatAjvErrors(errors) {
  if (!errors || errors.length === 0) return "Unknown validation error";
  return errors
    .map((e) => {
      const where = e.instancePath && e.instancePath.length > 0 ? e.instancePath : "/";
      return `- ${where} ${e.message}`;
    })
    .join("\n");
}

async function fetchJson(url) {
  const response = await fetch(url);
  const body = await response.text();
  let parsed;
  try {
    parsed = body ? JSON.parse(body) : {};
  } catch (e) {
    throw new Error(`Invalid JSON from ${url}`);
  }
  if (!response.ok) {
    const message = parsed && parsed.error ? parsed.error : `HTTP ${response.status}`;
    throw new Error(`Admin request failed (${url}): ${message}`);
  }
  return parsed;
}

function pickLatestConfigMeta(configs) {
  if (!Array.isArray(configs) || configs.length === 0) return null;
  return [...configs].sort((a, b) => {
    const tA = Date.parse(a.createdAt || 0);
    const tB = Date.parse(b.createdAt || 0);
    if (Number.isFinite(tA) && Number.isFinite(tB) && tA !== tB) return tB - tA;
    return String(b.configId || "").localeCompare(String(a.configId || ""));
  })[0];
}

async function loadConfigFromAdmin({ adminUrl, configId }) {
  const base = String(adminUrl || "").replace(/\/+$/, "");
  if (!base) throw new Error("Missing admin URL");

  let resolvedId = configId;
  if (!resolvedId) {
    const listResponse = await fetchJson(`${base}/configs`);
    const latest = pickLatestConfigMeta(listResponse.configs);
    if (!latest || !latest.configId) {
      throw new Error("Admin has no uploaded configs");
    }
    resolvedId = latest.configId;
  }

  const record = await fetchJson(`${base}/configs/${encodeURIComponent(resolvedId)}`);
  if (!record || !record.config) {
    throw new Error(`Admin response for configId=${resolvedId} is missing config payload`);
  }

  return { config: record.config, sourceLabel: `${base}/configs/${resolvedId}` };
}

// -------------------------
// Internal model
// -------------------------

class RenderItem {
  constructor({ contentId, type, data, durationSec, order }) {
    this.contentId = contentId;
    this.type = type;
    this.data = data;
    this.durationSec = durationSec;
    this.order = order;
  }
}

class Campaign {
  constructor({ campaignId, campaignName, campaignPriority, generatedAt, items }) {
    this.campaignId = campaignId;
    this.campaignName = campaignName;
    this.campaignPriority = campaignPriority;
    this.generatedAt = generatedAt;
    this.items = items; // RenderItem[]
  }
}

function toInternalModel(config) {
  const campaigns = config.campaigns.map((c) => {
    const items = c.items.map((it) => new RenderItem(it));

    // Deterministic ordering: sort by explicit `order`, then contentId as tie-breaker
    items.sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      return String(a.contentId).localeCompare(String(b.contentId));
    });

    return new Campaign({
      campaignId: c.campaignId,
      campaignName: c.campaignName,
      campaignPriority: c.campaignPriority,
      generatedAt: c.generatedAt,
      items,
    });
  });

  // Deterministic campaign ordering (priority desc, then campaignId)
  campaigns.sort((a, b) => {
    if (a.campaignPriority !== b.campaignPriority) return b.campaignPriority - a.campaignPriority;
    return String(a.campaignId).localeCompare(String(b.campaignId));
  });

  return campaigns;
}

function assertNoDuplicateOrder(campaigns) {
  for (const campaign of campaigns) {
    const seen = new Set();
    for (const it of campaign.items) {
      if (seen.has(it.order)) {
        throw new Error(
          `Duplicate item order detected: campaign=${campaign.campaignId} order=${it.order}`
        );
      }
      seen.add(it.order);
    }
  }
}

// -------------------------
// Output
// -------------------------

function printSummary(campaigns, mode) {
  console.log("=== IDS Player — Campaign Summary ===");
  console.log(`Mode: ${mode}`);
  console.log(`Campaigns: ${campaigns.length}`);
  console.log("");

  for (const c of campaigns) {
    console.log(`Campaign: ${c.campaignName} (${c.campaignId})`);
    console.log(`Priority: ${c.campaignPriority}`);
    console.log(`GeneratedAt: ${c.generatedAt}`);
    console.log(`Items: ${c.items.length}`);
    for (const it of c.items) {
      console.log(
        `  #${it.order} [${it.type}] id=${it.contentId} duration=${it.durationSec}s data=${it.data}`
      );
    }
    console.log("");
  }
}

// -------------------------
// Main
// -------------------------

async function main() {
  const args = parseArgs(process.argv);

  if (args.help) {
    printUsage();
    process.exit(0);
  }

  if (args.portInvalid) {
    console.error("Invalid port. Use --port <1..65535>.");
    process.exit(2);
  }

  if (args.inactivityInvalid) {
    console.error("Invalid inactivity timeout. Use --inactivity <seconds>.");
    process.exit(2);
  }

  if (args.unknown && args.unknown.length > 0) {
    console.error("Unknown arguments:", args.unknown.join(" "));
    printUsage();
    process.exit(2);
  }

  if (args.guidedFlow) {
    if (!args.serve) {
      console.error("Guided flow requires --serve.");
      process.exit(2);
    }
    createServer({
      port: args.port,
      guidedFlow: true,
    });
    return;
  }

  if (!args.configPath && !args.adminUrl) {
    console.error("Missing config source. Use --config <path> or --admin-url <url>.");
    printUsage();
    process.exit(2);
  }

  const mode = args.mode;
  if (mode !== "dev" && mode !== "prod") {
    console.error("Invalid mode. Use --mode dev|prod (or IDS_MODE=dev|prod).");
    process.exit(2);
  }

  // Load shared schema from shared/contract (single source of truth)
  const schemaPath = path.resolve(process.cwd(), "shared/contract/schema/config.schema.json");
  if (!fs.existsSync(schemaPath)) {
    console.error("Schema file not found:", schemaPath);
    console.error("Expected at: shared/contract/schema/config.schema.json");
    process.exit(2);
  }

  let schema;
  let config;
  let configSource = null;

  try {
    schema = readJsonFile(schemaPath);
  } catch (e) {
    console.error("Failed to read schema JSON:", e.message);
    process.exit(2);
  }

  if (args.adminUrl) {
    try {
      const loaded = await loadConfigFromAdmin({
        adminUrl: args.adminUrl,
        configId: args.configId,
      });
      config = loaded.config;
      configSource = loaded.sourceLabel;
      console.log(`Loaded config from Admin: ${configSource}`);
    } catch (e) {
      console.error("Failed to load config from Admin:", e.message);
      process.exit(2);
    }
  } else {
    const configPath = path.resolve(process.cwd(), args.configPath);
    if (!fs.existsSync(configPath)) {
      console.error("Config file not found:", configPath);
      process.exit(2);
    }
    try {
      config = readJsonFile(configPath);
      configSource = configPath;
    } catch (e) {
      console.error("Failed to read config JSON:", e.message);
      process.exit(2);
    }
  }
  console.log(`Config source: ${configSource}`);

  // Validate
  const validate = buildValidator(schema);
  const ok = validate(config);

  if (!ok) {
    console.error("Config is INVALID against schema:");
    console.error(formatAjvErrors(validate.errors));
    process.exit(1);
  }

  // Convert + logical checks
  let campaigns;
  try {
    campaigns = toInternalModel(config);
    assertNoDuplicateOrder(campaigns);
  } catch (e) {
    console.error("Config is valid JSON+schema, but fails logical checks:");
    console.error("-", e.message);
    process.exit(1);
  }

  // Summary
  printSummary(campaigns, mode);

  // Phase 3: start event server if requested
  if (args.serve) {
    const renderer = new DummyRenderer();
    const inactivityMs =
      Number.isInteger(args.inactivitySec) && args.inactivitySec > 0
        ? args.inactivitySec * 1000
        : undefined;
    const scheduler = new Scheduler({ renderer, campaigns, inactivityMs });
    createServer({
      scheduler,
      port: args.port,
    });
  } else {
    process.exit(0);
  }
}

main().catch((e) => {
  console.error("Fatal error:", e.message);
  process.exit(1);
});
