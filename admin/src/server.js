/**
 * IDS Admin — HTTP API + web UI.
 */

const fs = require("fs");
const path = require("path");
const http = require("http");
const crypto = require("crypto");

const { json, text, readJsonBody: readJsonBodyBase } = require("../../shared/utils/http-helpers");
const { createLogger } = require("../../shared/utils/logger");
const { renderAdminPage } = require("./render-admin-page");
const { createAdminRouter } = require("./router");
const storage = require("./storage");

const logger = createLogger("ids-admin-server");

const ADMIN_UI_JS_PATH = path.resolve(__dirname, "../public/admin-ui.js");
const DATA_DIR = process.env.IDS_ADMIN_DATA_DIR
  ? path.resolve(process.env.IDS_ADMIN_DATA_DIR)
  : path.resolve(__dirname, "../data");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const MAX_UPLOAD_SIZE = 20 * 1024 * 1024;

function ensureUploadDir() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function readJsonBody(req, maxBytes = 2_000_000) {
  return readJsonBodyBase(req, {
    maxBytes,
    onTooLarge: () => new storage.ValidationError([{ path: "body", message: "Body too large", code: "too_large" }]),
    onInvalidJson: () => new storage.ValidationError([{ path: "body", message: "Invalid JSON body", code: "invalid_json" }]),
  });
}

function readRawBody(req, maxBytes = MAX_UPLOAD_SIZE + 1024 * 1024) {
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
}

function sendValidationError(res, err) {
  if (err instanceof storage.ValidationError) {
    return json(res, 400, {
      error: "validation_failed",
      issues: err.issues,
    });
  }

  return json(res, 400, {
    error: "validation_failed",
    issues: [{ path: "request", message: err.message || "Invalid request", code: "invalid_request" }],
  });
}

function sanitizeFilename(filename) {
  return String(filename || "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

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

function isAllowedMimeType(mimeType) {
  return /^image\//.test(mimeType) || /^video\//.test(mimeType);
}

function buildAbsoluteUrl(req, pathname) {
  const configured = process.env.IDS_PUBLIC_ADMIN_URL;
  if (configured) {
    return `${configured.replace(/\/$/, "")}${pathname}`;
  }

  const host = req.headers.host || "127.0.0.1:8081";
  const proto = req.headers["x-forwarded-proto"] || "http";
  return `${proto}://${host}${pathname}`;
}

function parseMultipartFile(bodyBuffer, contentType) {
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

    const fileBuffer = Buffer.from(contentText, "latin1");

    return {
      originalName,
      mimeType,
      buffer: fileBuffer,
      size: fileBuffer.length,
    };
  }

  throw new storage.ValidationError([{ path: "file", message: "Missing file field in multipart payload", code: "required" }]);
}

function processUploadMultipart({ bodyBuffer, contentType, reqLike }) {
  const file = parseMultipartFile(bodyBuffer, contentType);

  if (file.size < 1) {
    throw new storage.ValidationError([{ path: "file", message: "File is empty", code: "empty_file" }]);
  }

  if (file.size > MAX_UPLOAD_SIZE) {
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

  ensureUploadDir();
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), file.buffer);

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

function createServer({ port = 8081 } = {}) {
  ensureUploadDir();
  const startedAt = Date.now();

  const handleRequest = createAdminRouter({
    json,
    text,
    logger,
    startedAt,
    renderAdminPage,
    adminUiJsPath: ADMIN_UI_JS_PATH,
    uploadDir: UPLOAD_DIR,
    resolveMimeByExtension,
    readRawBody,
    readJsonBody,
    processUploadMultipart,
    sendValidationError,
    storage,
  });

  const server = http.createServer(async (req, res) => {
    try {
      await handleRequest(req, res);
    } catch (error) {
      logger.error("unhandled_request_error", {
        message: error?.message,
        method: req.method,
        url: req.url,
      });
      if (!res.headersSent) {
        json(res, 500, { error: "internal_error" });
      }
    }
  });

  server.listen(port, "127.0.0.1", () => {
    logger.info("server_listening", { url: `http://127.0.0.1:${port}` });
  });

  return server;
}

module.exports = { createServer, MAX_UPLOAD_SIZE, UPLOAD_DIR, processUploadMultipart };
