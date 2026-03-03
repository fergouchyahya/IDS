/**
 * Player UI route handler.
 *
 * Responsibilities:
 * - Render the main player page.
 */

const { renderUI } = require("../services/render-service");
const { html } = require("../utils/http-response");

/**
 * Handles GET / requests by returning player HTML.
 *
 * @param {import('http').IncomingMessage} req - HTTP request.
 * @param {import('http').ServerResponse} res - HTTP response.
 * @param {URL} url - Parsed request URL.
 * @param {object} deps - Handler dependencies.
 */
function handleUi(req, res, url, deps) {
  return html(res, 200, renderUI(deps.stateMachine, {
    forceDebug: url.searchParams.get("debug") === "1",
    detectorToken: deps.detectorToken,
    detectorConfig: deps.detectorConfig,
  }));
}

module.exports = {
  handleUi,
};
