/**
 * IDS Admin HTML renderer.
 *
 * Responsibilities:
 * - Load static admin HTML from public/index.html.
 */

const fs = require("fs");
const path = require("path");

const ADMIN_HTML_PATH = path.resolve(__dirname, "../public/index.html");

/**
 * Returns admin HTML page contents.
 *
 * @returns {string} HTML document.
 */
function renderAdminPage() {
  return fs.readFileSync(ADMIN_HTML_PATH, "utf8");
}

module.exports = { renderAdminPage };
