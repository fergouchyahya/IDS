/**
 * IDS Admin — Entry Point (Phase 6)
 * Starts the admin HTTP API.
 */

const { createServer } = require("./server");
const { createLogger } = require("../../shared/utils/logger");

const logger = createLogger("ids-admin-entry");

const port = process.env.ADMIN_PORT ? Number(process.env.ADMIN_PORT) : 8081;

if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  logger.error("invalid_port", { env: "ADMIN_PORT", value: process.env.ADMIN_PORT });
  process.exit(2);
}

createServer({ port });
