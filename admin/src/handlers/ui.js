/**
 * Admin UI and static asset handlers.
 *
 * Responsibilities:
 * - Serve root admin HTML.
 * - Serve admin UI JavaScript bundle.
 */

const fs = require("fs");
const path = require("path");
const { text } = require("../../../shared/utils/http-helpers");

/**
 * Handles GET / request.
 *
 * @param {import('http').IncomingMessage} req - HTTP request.
 * @param {import('http').ServerResponse} res - HTTP response.
 * @param {object} deps - Handler dependencies.
 */
function handleRoot(req, res, deps) {
  return text(res, 200, deps.renderAdminPage(), "text/html; charset=utf-8");
}

/**
 * Handles GET /admin-ui.js request.
 *
 * @param {import('http').IncomingMessage} req - HTTP request.
 * @param {import('http').ServerResponse} res - HTTP response.
 * @param {object} deps - Handler dependencies.
 */
function handleAdminUiScript(req, res, deps) {
  const script = fs.readFileSync(deps.adminUiJsPath, "utf8");
  return text(res, 200, script, "application/javascript; charset=utf-8");
}

/**
 * Handles static public assets under /styles.css, /services/* and /components/*.
 *
 * @param {import('http').IncomingMessage} req - HTTP request.
 * @param {import('http').ServerResponse} res - HTTP response.
 * @param {URL} url - Parsed URL.
 * @param {object} deps - Handler dependencies.
 */
function handlePublicAsset(req, res, url, deps) {
  const pathname = url.pathname;
  const relativePath = pathname.startsWith("/") ? pathname.slice(1) : pathname;
  const assetPath = path.resolve(deps.publicDir, relativePath);

  if (!assetPath.startsWith(path.resolve(deps.publicDir))) {
    return text(res, 403, "forbidden", "text/plain; charset=utf-8");
  }
  if (!fs.existsSync(assetPath) || !fs.statSync(assetPath).isFile()) {
    return text(res, 404, "not_found", "text/plain; charset=utf-8");
  }

  const content = fs.readFileSync(assetPath, "utf8");
  const contentType = pathname.endsWith(".css")
    ? "text/css; charset=utf-8"
    : "application/javascript; charset=utf-8";
  return text(res, 200, content, contentType);
}

module.exports = {
  handleRoot,
  handleAdminUiScript,
  handlePublicAsset,
};
