/**
 * IDS Admin HTTP route dispatcher.
 *
 * Responsibilities:
 * - Parse request URL.
 * - Delegate routes to domain handlers.
 * - Return 404 for unknown routes.
 */

const { json } = require("../../shared/utils/http-helpers");
const { handleRoot, handleAdminUiScript, handlePublicAsset } = require("./handlers/ui");
const { handleHealth } = require("./handlers/health");
const { handleApiState, handleRuntimeConfigProjection } = require("./handlers/state");
const { handleGetMedia, handleMediaUpload } = require("./handlers/media");
const { handleCreateCampaign, handleUpdateCampaign, handleDeleteCampaign } = require("./handlers/campaigns");
const { handleSetActive, handleSetSettings, handleSetMenuCampaign } = require("./handlers/config");
const { handleUpsertStudent, handleImportStudents, handleGetStudentCampaign, handleDeleteStudent } = require("./handlers/students");

/**
 * Creates admin router function bound to runtime dependencies.
 *
 * @param {object} deps - Shared dependencies.
 * @returns {function(import('http').IncomingMessage, import('http').ServerResponse): Promise<void>} Request handler.
 */
function createAdminRouter(deps) {
  /**
   * Routes a single HTTP request.
   *
   * @param {import('http').IncomingMessage} req - HTTP request.
   * @param {import('http').ServerResponse} res - HTTP response.
   * @returns {Promise<void>}
   */
  return async function handleRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/") {
      return handleRoot(req, res, deps);
    }

    if (req.method === "GET" && url.pathname === "/admin-ui.js") {
      return handleAdminUiScript(req, res, deps);
    }

    if (
      req.method === "GET"
      && (url.pathname === "/styles.css" || url.pathname.startsWith("/services/") || url.pathname.startsWith("/components/"))
    ) {
      return handlePublicAsset(req, res, url, deps);
    }

    if (req.method === "GET" && url.pathname === "/health") {
      return handleHealth(req, res, deps);
    }

    if (req.method === "GET" && url.pathname === "/api/state") {
      return handleApiState(req, res, deps);
    }

    if (req.method === "GET" && url.pathname === "/runtime-config") {
      return handleRuntimeConfigProjection(req, res, deps);
    }

    if (req.method === "GET" && url.pathname.startsWith("/media/")) {
      return handleGetMedia(req, res, url, deps);
    }

    if (req.method === "POST" && url.pathname === "/api/media/upload") {
      return handleMediaUpload(req, res, url, deps);
    }

    if (req.method === "POST" && url.pathname === "/api/campaigns") {
      return handleCreateCampaign(req, res, deps);
    }

    if (req.method === "PUT" && url.pathname.startsWith("/api/campaigns/")) {
      return handleUpdateCampaign(req, res, url, deps);
    }

    if (req.method === "DELETE" && url.pathname.startsWith("/api/campaigns/")) {
      return handleDeleteCampaign(req, res, url, deps);
    }

    if (req.method === "POST" && url.pathname === "/api/active") {
      return handleSetActive(req, res, deps);
    }

    if (req.method === "POST" && url.pathname === "/api/settings") {
      return handleSetSettings(req, res, deps);
    }

    if (req.method === "POST" && url.pathname === "/api/menu-campaign") {
      return handleSetMenuCampaign(req, res, deps);
    }

    if (req.method === "POST" && url.pathname === "/api/students") {
      return handleUpsertStudent(req, res, deps);
    }

    if (req.method === "POST" && url.pathname === "/api/students/import") {
      return handleImportStudents(req, res, deps);
    }

    if (req.method === "GET" && /^\/api\/students\/[^/]+\/campaign$/.test(url.pathname)) {
      return handleGetStudentCampaign(req, res, url, deps);
    }

    if (req.method === "DELETE" && url.pathname.startsWith("/api/students/")) {
      return handleDeleteStudent(req, res, url, deps);
    }

    return json(res, 404, { error: `not_found: ${url.pathname}` });
  };
}

module.exports = {
  createAdminRouter,
};
