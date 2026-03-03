/**
 * Admin media utility helpers.
 *
 * Responsibilities:
 * - Validate and parse multipart uploads.
 * - Persist uploaded media files.
 * - Resolve MIME types for serving files.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

/**
 * Ensures upload directory exists.
 *
 * @param {string} uploadDir - Upload directory path.
 */
function ensureUploadDir(uploadDir) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

/**
 * Sanitizes uploaded filename into a safe base name.
 *
 * @param {string} filename - Original filename.
 * @returns {string} Safe filename base.
 */
function sanitizeFilename(filename) {
  return String(filename || "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

/**
 * Returns extension by MIME type.
 *
 * @param {string} mime - MIME type.
 * @returns {string} File extension.
 */
function getExtFromMime(mime) {
  if (mime === "image/jpeg") return ".jpg";
  if (mime === "image/png") return ".png";
  if (mime === "image/webp") return ".webp";
  if (mime === "image/gif") return ".gif";
  if (mime === "video/mp4") return ".mp4";
  if (mime === "video/webm") return ".webm";
  if (mime === "video/quicktime") return ".mov";
  return "";
}

/**
 * Returns whether MIME type is accepted for uploads.
 *
 * @param {string} mimeType - MIME type.
 * @returns {boolean} True when accepted.
 */
function isAllowedMimeType(mimeType) {
  return /^image\//.test(mimeType) || /^video\//.test(mimeType);
}

/**
 * Builds absolute URL for a stored media path.
 *
 * @param {import('http').IncomingMessage} req - HTTP request.
 * @param {string} pathname - Media pathname.
 * @returns {string} Absolute URL.
 */
function buildAbsoluteUrl(req, pathname) {
  const configured = process.env.IDS_PUBLIC_ADMIN_URL;
  if (configured) {
    return `${configured.replace(/\/$/, "")}${pathname}`;
  }

  const host = req.headers.host || "127.0.0.1:8081";
  const proto = req.headers["x-forwarded-proto"] || "http";
  return `${proto}://${host}${pathname}`;
}

/**
 * Parses multipart body and extracts the file field.
 *
 * @param {Buffer} bodyBuffer - Raw multipart request body.
 * @param {string} contentType - Content-Type header.
 * @param {object} storage - Storage module exposing ValidationError.
 * @returns {object} Parsed file payload.
 */
function parseMultipartFile(bodyBuffer, contentType, storage) {
  const boundaryMatch = /boundary=([^;]+)/i.exec(contentType || "");
  if (!boundaryMatch) {
    throw new storage.ValidationError([{ path: "file", message: "Missing multipart boundary", code: "invalid_multipart" }]);
  }

  const boundary = boundaryMatch[1].trim();
  const body = bodyBuffer.toString("latin1");
  const delimiter = `--${boundary}`;
  const parts = body.split(delimiter);

  for (const partRaw of parts) {
    const part = partRaw.trim();
    if (!part || part === "--") continue;

    const headerEnd = part.indexOf("\r\n\r\n");
    if (headerEnd < 0) continue;

    const headerText = part.slice(0, headerEnd);
    const contentText = part.slice(headerEnd + 4).replace(/\r\n--$/, "");

    const disposition = /content-disposition:\s*form-data;([^\r\n]+)/i.exec(headerText);
    if (!disposition) continue;

    const nameMatch = /name="([^"]+)"/i.exec(disposition[1]);
    const filenameMatch = /filename="([^"]*)"/i.exec(disposition[1]);

    if (!nameMatch || nameMatch[1] !== "file") continue;

    const mimeMatch = /content-type:\s*([^\r\n]+)/i.exec(headerText);
    const mimeType = (mimeMatch?.[1] || "application/octet-stream").trim().toLowerCase();
    const originalName = filenameMatch?.[1] || "upload.bin";

    return {
      originalName,
      mimeType,
      buffer: Buffer.from(contentText, "latin1"),
      size: Buffer.byteLength(contentText, "latin1"),
    };
  }

  throw new storage.ValidationError([{ path: "file", message: "Missing file field in multipart payload", code: "required" }]);
}

/**
 * Processes multipart upload and persists media file.
 *
 * @param {object} options - Upload processing options.
 * @param {Buffer} options.bodyBuffer - Raw multipart body.
 * @param {string} options.contentType - Content-Type header.
 * @param {import('http').IncomingMessage} options.reqLike - Request-like object.
 * @param {string} options.uploadDir - Upload directory.
 * @param {number} options.maxUploadSize - Max upload size in bytes.
 * @param {object} options.storage - Storage module exposing ValidationError.
 * @returns {object} Uploaded media metadata.
 */
function processUploadMultipart({ bodyBuffer, contentType, reqLike, uploadDir, maxUploadSize, storage }) {
  const file = parseMultipartFile(bodyBuffer, contentType, storage);

  if (file.size < 1) {
    throw new storage.ValidationError([{ path: "file", message: "File is empty", code: "empty_file" }]);
  }

  if (file.size > maxUploadSize) {
    throw new storage.ValidationError([{ path: "file", message: "File exceeds 20MB limit", code: "too_large" }]);
  }

  if (!isAllowedMimeType(file.mimeType)) {
    throw new storage.ValidationError([
      { path: "file", message: "Only image/* and video/* uploads are allowed", code: "invalid_mime_type" },
    ]);
  }

  const safeBaseName = sanitizeFilename(file.originalName.replace(/\.[^.]+$/, "")) || "media";
  const ext = getExtFromMime(file.mimeType) || path.extname(file.originalName).toLowerCase() || ".bin";
  const mediaId = crypto.randomBytes(6).toString("hex");
  const filename = `${safeBaseName}-${mediaId}${ext}`;

  ensureUploadDir(uploadDir);
  fs.writeFileSync(path.join(uploadDir, filename), file.buffer);

  const urlPath = `/media/${filename}`;
  const absoluteUrl = buildAbsoluteUrl(reqLike || { headers: {} }, urlPath);

  return {
    mediaId,
    url: absoluteUrl,
    urlPath,
    mimeType: file.mimeType,
    size: file.size,
    filename,
  };
}

/**
 * Resolves MIME type by file extension for serving media files.
 *
 * @param {string} filename - Media filename.
 * @returns {string} MIME type.
 */
function resolveMimeByExtension(filename) {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".mov")) return "video/quicktime";
  return "application/octet-stream";
}

module.exports = {
  ensureUploadDir,
  sanitizeFilename,
  getExtFromMime,
  isAllowedMimeType,
  buildAbsoluteUrl,
  parseMultipartFile,
  processUploadMultipart,
  resolveMimeByExtension,
};
