/**
 * IDS Player — Entry Point
 *
 * Loads a campaign config and starts an HTTP server for:
 * - GET /fetch → return current campaign item
 * - POST /events → trigger state transitions
 */

const fs = require("fs");
const path = require("path");
const Ajv2020 = require("ajv/dist/2020");
const addFormats = require("ajv-formats");

const { createServer } = require("./server");

function loadAndValidateConfig(configPath) {
  if (!fs.existsSync(configPath)) {
    console.error(`Config file not found: ${configPath}`);
    process.exit(2);
  }

  const raw = fs.readFileSync(configPath, "utf8");
  let config;
  try {
    config = JSON.parse(raw);
  } catch (e) {
    console.error(`Invalid JSON: ${e.message}`);
    process.exit(1);
  }

  const schemaPath = path.resolve(__dirname, "../../shared/contract/schema/config.schema.json");
  const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);

  const ok = validate(config);
  if (!ok) {
    console.error("Validation failed:");
    validate.errors?.forEach((e) => {
      console.error(`  ${e.instancePath || "/"} ${e.message}`);
    });
    process.exit(1);
  }

  return config;
}

const configPath = process.argv[2] || process.env.IDS_CONFIG || "config.json";
const port = Number(process.env.PLAYER_PORT || 7070);

const config = loadAndValidateConfig(configPath);
console.log(`[Player] Config loaded: ${config.campaigns.length} campaign(s)`);

createServer({ config, port });
