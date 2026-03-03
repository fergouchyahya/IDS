/**
 * Player health route handler.
 *
 * Responsibilities:
 * - Return service health and sync status.
 */

const { json } = require("../../../shared/utils/http-helpers");

/**
 * Handles GET /health requests.
 *
 * @param {import('http').IncomingMessage} req - HTTP request.
 * @param {import('http').ServerResponse} res - HTTP response.
 * @param {URL} url - Parsed request URL.
 * @param {object} deps - Handler dependencies.
 */
function handleHealth(req, res, url, deps) {
  return json(res, 200, {
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptimeMs: Date.now() - deps.startedAt,
    runtime: deps.stateMachine.getStatus(),
    adminSync: deps.syncService.getStatus(),
  });
}

module.exports = {
  handleHealth,
};
