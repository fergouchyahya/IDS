/**
 * IDS Admin — Entry Point (Phase 6)
 * Starts the admin HTTP API.
 */

const { createServer } = require("./server");

const port = process.env.ADMIN_PORT ? Number(process.env.ADMIN_PORT) : 8081;

if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  console.error("Invalid ADMIN_PORT. Use 1..65535.");
  process.exit(2);
}

createServer({ port });
