/**
 * IDS — Player Core 
 * File: player/src/index.js
 *
 * PURPOSE
 *   Minimal Player entrypoint that proves we can:
 *     - load a config from disk
 *     - validate it against the shared JSON Schema
 *     - normalize it into a deterministic internal model
 *     - print a stable playlist summary
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
 *   4) Convert to internal model (Playlist + RenderItem)
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

// -------------------------
// CLI / ENV parsing
// -------------------------

function parseArgs(argv) {
  const args = {
    configPath: process.env.IDS_CONFIG || null,
    mode: process.env.IDS_MODE || "dev",
    serve: false,
    port: 7070,
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

    if (a === "--serve") {
      args.serve = true;
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
  console.log("  node player/src/index.js --config <path> [--mode dev|prod] [--serve] [--port <n>]");
  console.log("");
  console.log("Environment:");
  console.log("  IDS_CONFIG=<path>");
  console.log("  IDS_MODE=dev|prod");
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

class Playlist {
  constructor({ campaignId, campaignName, campaignPriority, generatedAt, items }) {
    this.campaignId = campaignId;
    this.campaignName = campaignName;
    this.campaignPriority = campaignPriority;
    this.generatedAt = generatedAt;
    this.items = items; // RenderItem[]
  }
}

function toInternalModel(config) {
  const items = config.items.map((it) => new RenderItem(it));

  // Deterministic ordering: sort by explicit `order`, then contentId as tie-breaker
  items.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return String(a.contentId).localeCompare(String(b.contentId));
  });

  return new Playlist({
    campaignId: config.campaignId,
    campaignName: config.campaignName,
    campaignPriority: config.campaignPriority,
    generatedAt: config.generatedAt,
    items,
  });
}

function assertNoDuplicateOrder(items) {
  const seen = new Set();
  for (const it of items) {
    if (seen.has(it.order)) {
      throw new Error(`Duplicate item order detected: order=${it.order}`);
    }
    seen.add(it.order);
  }
}

// -------------------------
// Output
// -------------------------

function printSummary(playlist, mode) {
  console.log("=== IDS Player — Playlist Summary ===");
  console.log(`Mode: ${mode}`);
  console.log(`Campaign: ${playlist.campaignName} (${playlist.campaignId})`);
  console.log(`Priority: ${playlist.campaignPriority}`);
  console.log(`GeneratedAt: ${playlist.generatedAt}`);
  console.log(`Items: ${playlist.items.length}`);
  console.log("");

  for (const it of playlist.items) {
    console.log(
      `#${it.order} [${it.type}] id=${it.contentId} duration=${it.durationSec}s data=${it.data}`
    );
  }
}

// -------------------------
// Main
// -------------------------

function main() {
  const args = parseArgs(process.argv);

  if (args.help) {
    printUsage();
    process.exit(0);
  }

  if (args.portInvalid) {
    console.error("Invalid port. Use --port <1..65535>.");
    process.exit(2);
  }

  if (args.unknown && args.unknown.length > 0) {
    console.error("Unknown arguments:", args.unknown.join(" "));
    printUsage();
    process.exit(2);
  }

  if (!args.configPath) {
    console.error("Missing config path. Use --config <path> or IDS_CONFIG=<path>.");
    printUsage();
    process.exit(2);
  }

  const mode = args.mode;
  if (mode !== "dev" && mode !== "prod") {
    console.error("Invalid mode. Use --mode dev|prod (or IDS_MODE=dev|prod).");
    process.exit(2);
  }

  const configPath = path.resolve(process.cwd(), args.configPath);
  if (!fs.existsSync(configPath)) {
    console.error("Config file not found:", configPath);
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

  try {
    schema = readJsonFile(schemaPath);
  } catch (e) {
    console.error("Failed to read schema JSON:", e.message);
    process.exit(2);
  }

  try {
    config = readJsonFile(configPath);
  } catch (e) {
    console.error("Failed to read config JSON:", e.message);
    process.exit(2);
  }

  // Validate
  const validate = buildValidator(schema);
  const ok = validate(config);

  if (!ok) {
    console.error("Config is INVALID against schema:");
    console.error(formatAjvErrors(validate.errors));
    process.exit(1);
  }

  // Convert + logical checks
  let playlist;
  try {
    playlist = toInternalModel(config);
    assertNoDuplicateOrder(playlist.items);
  } catch (e) {
    console.error("Config is valid JSON+schema, but fails logical checks:");
    console.error("-", e.message);
    process.exit(1);
  }

  // Summary
  printSummary(playlist, mode);

  // Phase 3: start event server if requested
  if (args.serve) {
    createServer({ port: args.port });
  } else {
    process.exit(0);
  }
}

main();

