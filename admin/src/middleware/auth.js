/**
 * API key authentication middleware.
 *
 * Checks the Authorization header against IDS_ADMIN_API_KEY env var.
 * Returns true if authorized, false if rejected (response already sent).
 */

const { json } = require("../../../shared/utils/http-helpers");

const API_KEY = process.env.IDS_ADMIN_API_KEY || "";

/**
 * Checks if the request carries a valid API key.
 *
 * @param {import('http').IncomingMessage} req - HTTP request.
 * @param {import('http').ServerResponse} res - HTTP response.
 * @returns {boolean} True if authorized, false if rejected.
 */
function checkAuth(req, res) {
  if (!API_KEY) {
    // No key configured — auth is disabled (development mode).
    return true;
  }

  const header = req.headers["authorization"] || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (token === API_KEY) {
    return true;
  }

  json(res, 401, { error: "unauthorized", message: "Invalid or missing API key" });
  return false;
}

module.exports = { checkAuth };
