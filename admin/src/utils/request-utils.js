/**
 * Admin request utility helpers.
 *
 * Responsibilities:
 * - Parse JSON request payloads with validation errors.
 * - Parse raw request bodies for multipart uploads.
 * - Format validation errors into HTTP responses.
 */

const { json, readJsonBody: readJsonBodyBase } = require("../../../shared/utils/http-helpers");

/**
 * Builds a JSON body reader that returns storage validation errors.
 *
 * @param {object} storage - Storage module exposing ValidationError.
 * @returns {function(import('http').IncomingMessage, number=): Promise<object>} JSON body reader.
 */
function createJsonBodyReader(storage) {
  /**
   * Reads JSON request body with size limit.
   *
   * @param {import('http').IncomingMessage} req - HTTP request.
   * @param {number} [maxBytes=2000000] - Max payload size.
   * @returns {Promise<object>} Parsed body.
   */
  return function readJsonBody(req, maxBytes = 2_000_000) {
    return readJsonBodyBase(req, {
      maxBytes,
      onTooLarge: () => new storage.ValidationError([{ path: "body", message: "Body too large", code: "too_large" }]),
      onInvalidJson: () => new storage.ValidationError([{ path: "body", message: "Invalid JSON body", code: "invalid_json" }]),
    });
  };
}

/**
 * Builds a raw body reader with upload size enforcement.
 *
 * @param {object} storage - Storage module exposing ValidationError.
 * @param {number} maxUploadSize - Max upload bytes.
 * @returns {function(import('http').IncomingMessage, number=): Promise<Buffer>} Raw body reader.
 */
function createRawBodyReader(storage, maxUploadSize) {
  /**
   * Reads raw request body into a buffer.
   *
   * @param {import('http').IncomingMessage} req - HTTP request.
   * @param {number} [maxBytes=maxUploadSize+1048576] - Max payload size.
   * @returns {Promise<Buffer>} Raw body buffer.
   */
  return function readRawBody(req, maxBytes = maxUploadSize + 1024 * 1024) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      let total = 0;

      req.on("data", (chunk) => {
        total += chunk.length;
        if (total > maxBytes) {
          reject(new storage.ValidationError([{ path: "file", message: "Upload too large", code: "too_large" }]));
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });

      req.on("end", () => resolve(Buffer.concat(chunks)));
      req.on("error", (err) => reject(err));
    });
  };
}

/**
 * Sends a normalized validation error response.
 *
 * @param {import('http').ServerResponse} res - HTTP response.
 * @param {Error} err - Error object.
 * @param {object} storage - Storage module exposing ValidationError.
 * @returns {void}
 */
function sendValidationError(res, err, storage) {
  if (err instanceof storage.ValidationError) {
    const statusCode = err.issues.some((item) => item?.code === "not_found") ? 404 : 400;
    return json(res, statusCode, {
      error: "validation_failed",
      issues: err.issues,
    });
  }

  return json(res, 400, {
    error: "validation_failed",
    issues: [{ path: "request", message: err.message || "Invalid request", code: "invalid_request" }],
  });
}

module.exports = {
  createJsonBodyReader,
  createRawBodyReader,
  sendValidationError,
};
