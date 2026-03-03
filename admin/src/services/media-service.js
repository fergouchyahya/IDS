/**
 * Media service.
 *
 * Responsibilities:
 * - Provide media upload and file resolution operations.
 */

const fs = require("fs");
const path = require("path");

/**
 * Creates media service.
 *
 * @param {object} deps - Service dependencies.
 * @param {string} deps.uploadDir - Upload directory.
 * @param {function(string): string} deps.resolveMimeByExtension - MIME resolver.
 * @param {function(object): object} deps.processUploadMultipart - Upload processor.
 * @returns {object} Media service API.
 */
function createMediaService({ uploadDir, resolveMimeByExtension, processUploadMultipart }) {
  /**
   * Resolves an uploaded file for serving.
   *
   * @param {string} filename - Media filename.
   * @returns {object|null} Resolved media descriptor or null.
   */
  function getMediaFile(filename) {
    const filePath = path.join(uploadDir, filename);
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      return null;
    }

    const stat = fs.statSync(filePath);
    return {
      filePath,
      mimeType: resolveMimeByExtension(filename),
      size: stat.size,
    };
  }

  /**
   * Processes a multipart media upload.
   *
   * @param {object} payload - Multipart upload payload.
   * @returns {object} Uploaded media metadata.
   */
  function upload(payload) {
    return processUploadMultipart(payload);
  }

  return {
    getMediaFile,
    upload,
  };
}

module.exports = {
  createMediaService,
};
