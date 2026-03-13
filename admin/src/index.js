/**
 * IDS Admin — Entry Point (Phase 6)
 * Starts the admin HTTP API.
 */

const { createServer } = require("./server");
const { createLogger } = require("../../shared/utils/logger");
const { getConfig } = require("../../shared/config");

const logger = createLogger("ids-admin-entry");
const config = getConfig();
const adminConfig = config.getAdmin();
const port = Number(adminConfig.port);

if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  logger.error("invalid_port", { env: "ADMIN_PORT", value: process.env.ADMIN_PORT });
  process.exit(2);
}

createServer({ port, host: adminConfig.host });
