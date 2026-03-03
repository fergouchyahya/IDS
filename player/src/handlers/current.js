/**
 * Player current-state route handler.
 *
 * Responsibilities:
 * - Return current state payload.
 */

const { json } = require("../../../shared/utils/http-helpers");

/**
 * Handles GET /current requests.
 *
 * @param {import('http').IncomingMessage} req - HTTP request.
 * @param {import('http').ServerResponse} res - HTTP response.
 * @param {URL} url - Parsed request URL.
 * @param {object} deps - Handler dependencies.
 */
function handleCurrent(req, res, url, deps) {
  return json(res, 200, deps.stateMachine.getStatus());
}

module.exports = {
  handleCurrent,
};
