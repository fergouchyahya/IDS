/**
 * Admin media handlers.
 *
 * Responsibilities:
 * - Serve media files from upload directory.
 * - Handle multipart media uploads.
 */

const fs = require("fs");
const { json } = require("../../../shared/utils/http-helpers");

/**
 * Parses and decodes a path component with prefix removed.
 *
 * @param {string} pathname - Request path.
 * @param {string} prefix - Prefix to remove.
 * @returns {string} Parsed component.
 */
function parsePathnameComponent(pathname, prefix) {
  return decodeURIComponent(pathname.slice(prefix.length));
}

/**
 * Handles GET /media/:filename request.
 *
 * @param {import('http').IncomingMessage} req - HTTP request.
 * @param {import('http').ServerResponse} res - HTTP response.
 * @param {URL} url - Parsed URL.
 * @param {object} deps - Handler dependencies.
 */
function handleGetMedia(req, res, url, deps) {
  const filename = parsePathnameComponent(url.pathname, "/media/");
  if (!filename || filename.includes("/") || filename.includes("..")) {
    return json(res, 400, {
      error: "validation_failed",
      issues: [{ path: "filename", message: "Invalid media filename", code: "invalid_path" }],
    });
  }

  const media = deps.services.media.getMediaFile(filename);
  if (!media) {
    return json(res, 404, {
      error: "validation_failed",
      issues: [{ path: "filename", message: "Media file not found", code: "not_found" }],
    });
  }

  res.writeHead(200, {
    "Content-Type": media.mimeType,
    "Content-Length": media.size,
    "Cache-Control": "public, max-age=604800",
  });
  fs.createReadStream(media.filePath).pipe(res);
}

/**
 * Handles POST /api/media/upload request.
 *
 * @param {import('http').IncomingMessage} req - HTTP request.
 * @param {import('http').ServerResponse} res - HTTP response.
 * @param {URL} url - Parsed URL.
 * @param {object} deps - Handler dependencies.
 * @returns {Promise<void>}
 */
async function handleMediaUpload(req, res, url, deps) {
  try {
    const contentType = req.headers["content-type"] || "";
    if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
      throw new deps.storage.ValidationError([
        {
          path: "file",
          message: "content-type must be multipart/form-data",
          code: "invalid_content_type",
        },
      ]);
    }

    const rawBody = await deps.readRawBody(req);
    const uploaded = deps.services.media.upload({ bodyBuffer: rawBody, contentType, reqLike: req });
    return json(res, 201, uploaded);
  } catch (e) {
    deps.logger.warn("media_upload_failed", { message: e?.message });
    return deps.sendValidationError(res, e);
  }
}

module.exports = {
  handleGetMedia,
  handleMediaUpload,
};
