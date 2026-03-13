/**
 * Player HTTP server composition root.
 *
 * Responsibilities:
 * - Wire runtime services and dependencies.
 * - Start HTTP server and route requests.
 * - Manage shutdown lifecycle.
 */

const http = require("http");
const crypto = require("crypto");
const { createLogger } = require("../../shared/utils/logger");
const { createPlayerRouter } = require("./router");
const { PlayerStateMachine, STATE } = require("./services/state-machine");
const { normalizeRuntimeConfig, normalizeDetectorConfig } = require("./services/config-service");
const { createAdminSyncService } = require("./services/admin-sync-service");
const { renderUI } = require("./services/render-service");
const { isMovementInputEvent, isDetectorAllowedEvent } = require("./detector/event-utils");

const logger = createLogger("ids-player-server");

/**
 * Creates and starts the IDS player server.
 *
 * @param {object} [options={}] - Server options.
 * @param {object} options.config - Runtime config object.
 * @param {string} [options.host="127.0.0.1"] - Listening host.
 * @param {number} [options.port=7070] - Listening port.
 * @param {string} [options.adminUrl] - Admin URL for sync.
 * @param {number} [options.syncIntervalMs=4000] - Runtime sync interval.
 * @param {object} [options.detectorConfig] - Detector config overrides.
 * @returns {import('http').Server} Started HTTP server.
 */
function createServer({ config, host = "127.0.0.1", port = 7070, adminUrl, syncIntervalMs = 4000, detectorConfig } = {}) {
  const stateMachine = new PlayerStateMachine(config);
  const detectorToken = crypto.randomBytes(18).toString("hex");
  const resolvedDetectorConfig = normalizeDetectorConfig(detectorConfig);
  const startedAt = Date.now();

  const syncService = createAdminSyncService({
    adminUrl,
    stateMachine,
    logger,
    syncIntervalMs,
  });

  stateMachine.scheduleInactivityTimer();
  syncService.start();

  const route = createPlayerRouter({
    stateMachine,
    detectorToken,
    detectorConfig: resolvedDetectorConfig,
    startedAt,
    syncService,
    logger,
  });

  /**
   * Handles incoming HTTP requests through the router.
   *
   * @param {import('http').IncomingMessage} req - HTTP request.
   * @param {import('http').ServerResponse} res - HTTP response.
   * @returns {Promise<void>}
   */
  async function handleIncomingRequest(req, res) {
    await route(req, res);
  }

  /**
   * Handles server close lifecycle cleanup.
   */
  function handleServerClose() {
    stateMachine.stop();
    syncService.stop();
  }

  /**
   * Handles successful server listen event.
   */
  function handleServerListening() {
    const address = server.address();
    const boundPort = typeof address === "object" && address ? address.port : port;
    logger.info("server_listening", { url: `http://${host}:${boundPort}` });
    logger.info("flow", {
      value: "IDLE -> movement_detected -> MENU -> (visitor_selected|nfc_tap) -> INFO -> inactivity -> IDLE",
    });
    if (adminUrl) logger.info("runtime_sync_enabled", { runtimeConfigUrl: `${adminUrl}/runtime-config` });
  }

  const server = http.createServer(handleIncomingRequest);

  server.on("close", handleServerClose);
  server.listen(port, host, handleServerListening);

  return server;
}

module.exports = {
  createServer,
  PlayerStateMachine,
  STATE,
  normalizeRuntimeConfig,
  normalizeDetectorConfig,
  renderUI,
  isMovementInputEvent,
  isDetectorAllowedEvent,
};
