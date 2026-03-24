/**
 * Player HTTP response helpers.
 *
 * Responsibilities:
 * - Send HTML responses with correct content type and length.
 */

/**
 * Sends an HTML response.
 *
 * @param {import('http').ServerResponse} res - HTTP response object.
 * @param {number} code - HTTP status code.
 * @param {string} body - HTML body.
 */
function html(res, code, body) {
  res.writeHead(code, {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

module.exports = {
  html,
};
