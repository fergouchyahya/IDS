/**
 * Admin state and runtime-config handlers.
 *
 * Responsibilities:
 * - Return full persisted state.
 * - Return player runtime config projection.
 */

const { json } = require("../../../shared/utils/http-helpers");

/**
 * Handles GET /api/state request.
 *
 * @param {import('http').IncomingMessage} req - HTTP request.
 * @param {import('http').ServerResponse} res - HTTP response.
 * @param {object} deps - Handler dependencies.
 * @returns {Promise<void>}
 */
async function handleApiState(req, res, deps) {
  return json(res, 200, await deps.services.state.getApiState());
}

/**
 * Handles GET /runtime-config request.
 *
 * @param {import('http').IncomingMessage} req - HTTP request.
 * @param {import('http').ServerResponse} res - HTTP response.
 * @param {object} deps - Handler dependencies.
 * @returns {Promise<void>}
 */
async function handleRuntimeConfigProjection(req, res, deps) {
  return json(res, 200, await deps.services.state.getRuntimeConfig());
}

module.exports = {
  handleApiState,
  handleRuntimeConfigProjection,
};
