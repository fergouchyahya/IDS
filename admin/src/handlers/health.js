/**
 * Admin health handler.
 *
 * Responsibilities:
 * - Return service health and storage summary.
 */

const { json } = require("../../../shared/utils/http-helpers");

/**
 * Handles GET /health request.
 *
 * @param {import('http').IncomingMessage} req - HTTP request.
 * @param {import('http').ServerResponse} res - HTTP response.
 * @param {object} deps - Handler dependencies.
 */
function handleHealth(req, res, deps) {
  return json(res, 200, deps.services.health.getHealthPayload(deps.startedAt));
}

module.exports = {
  handleHealth,
};
