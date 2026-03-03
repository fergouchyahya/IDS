/**
 * Player route dispatcher.
 *
 * Responsibilities:
 * - Map HTTP method/path to handlers.
 * - Provide a single async request entrypoint.
 */

const { json } = require("../../shared/utils/http-helpers");
const { handleUi } = require("./handlers/ui");
const { handleCurrent } = require("./handlers/current");
const { handleHealth } = require("./handlers/health");
const { handleEvents } = require("./handlers/events");
const { handleDetectorMovement, handleDetectorEvents } = require("./handlers/detector");
const { handleRuntimeConfig } = require("./handlers/runtime-config");

/**
 * Creates a router bound to shared runtime dependencies.
 *
 * @param {object} deps - Shared dependencies.
 * @returns {function(import('http').IncomingMessage, import('http').ServerResponse): Promise<void>} Request handler.
 */
function createPlayerRouter(deps) {
  /**
   * Routes one HTTP request.
   *
   * @param {import('http').IncomingMessage} req - HTTP request.
   * @param {import('http').ServerResponse} res - HTTP response.
   * @returns {Promise<void>}
   */
  return async function route(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/") {
      return handleUi(req, res, url, deps);
    }

    if (req.method === "GET" && url.pathname === "/current") {
      return handleCurrent(req, res, url, deps);
    }

    if (req.method === "GET" && url.pathname === "/health") {
      return handleHealth(req, res, url, deps);
    }

    if (req.method === "POST" && url.pathname === "/events") {
      return handleEvents(req, res, url, deps);
    }

    if (req.method === "POST" && url.pathname === "/detector/movement") {
      return handleDetectorMovement(req, res, url, deps);
    }

    if (req.method === "POST" && url.pathname === "/detector/events") {
      return handleDetectorEvents(req, res, url, deps);
    }

    if (req.method === "POST" && url.pathname === "/runtime-config") {
      return handleRuntimeConfig(req, res, url, deps);
    }

    return json(res, 404, { error: "not_found" });
  };
}

module.exports = {
  createPlayerRouter,
};
