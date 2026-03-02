/**
 * IDS Player — Entry Point
 */

const fs = require("fs");
const path = require("path");

const { createServer, normalizeRuntimeConfig } = require("./server");
const { createLogger } = require("../../shared/utils/logger");

const logger = createLogger("ids-player-entry");

function loadJson(configPath) {
  if (!fs.existsSync(configPath)) {
    logger.error("config_missing", { configPath });
    process.exit(2);
  }

  const raw = fs.readFileSync(configPath, "utf8");
  try {
    return JSON.parse(raw);
  } catch (e) {
    logger.error("config_invalid_json", { message: e.message, configPath });
    process.exit(1);
  }
}

function parseCli(argv) {
  const args = {
    configPath: process.env.IDS_CONFIG || "shared/contract/examples/config.welcome.json",
    port: Number(process.env.PLAYER_PORT || 7070),
    adminUrl: process.env.IDS_ADMIN_URL || "",
    detectorConfigJson: process.env.IDS_DETECTOR_CONFIG || "",
    detectorConfigFile: "",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--config" && argv[i + 1]) {
      args.configPath = argv[i + 1];
      i += 1;
      continue;
    }

    if (token === "--port" && argv[i + 1]) {
      args.port = Number(argv[i + 1]);
      i += 1;
      continue;
    }

    if (token === "--admin-url" && argv[i + 1]) {
      args.adminUrl = argv[i + 1];
      i += 1;
      continue;
    }

    if (token === "--detector-config-json" && argv[i + 1]) {
      args.detectorConfigJson = argv[i + 1];
      i += 1;
      continue;
    }

    if (token === "--detector-config-file" && argv[i + 1]) {
      args.detectorConfigFile = argv[i + 1];
      i += 1;
      continue;
    }

    if (!token.startsWith("--")) {
      args.configPath = token;
    }
  }

  if (!Number.isInteger(args.port) || args.port <= 0 || args.port > 65535) {
    logger.error("invalid_port", { env: "PLAYER_PORT", value: process.env.PLAYER_PORT, parsed: args.port });
    process.exit(2);
  }

  return args;
}

const cli = parseCli(process.argv.slice(2));
const configPath = path.resolve(process.cwd(), cli.configPath);
const config = loadJson(configPath);

let detectorConfig = {};
if (cli.detectorConfigFile) {
  const detectorConfigPath = path.resolve(process.cwd(), cli.detectorConfigFile);
  detectorConfig = loadJson(detectorConfigPath);
} else if (cli.detectorConfigJson) {
  try {
    detectorConfig = JSON.parse(cli.detectorConfigJson);
  } catch (e) {
    logger.error("detector_config_invalid_json", {
      message: e.message,
      source: cli.detectorConfigJson === process.env.IDS_DETECTOR_CONFIG ? "IDS_DETECTOR_CONFIG" : "--detector-config-json",
    });
    process.exit(2);
  }
}

if (!normalizeRuntimeConfig(config)) {
  logger.error("config_shape_invalid", {
    message: "Expected runtime-config shape or legacy campaigns shape.",
    configPath,
  });
  process.exit(1);
}

logger.info("boot_config_loaded", { configPath });

createServer({
  config,
  port: cli.port,
  adminUrl: cli.adminUrl || undefined,
  detectorConfig,
});
